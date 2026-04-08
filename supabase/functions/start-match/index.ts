// supabase/functions/start-match/index.ts
// Pre-filter + Haiku ile maliyet optimize edilmiş eşleştirme

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const AGENT_MATCH_URL = `${SUPABASE_URL}/functions/v1/agent-match`;

// Maliyet sabitleri (cent cinsinden)
const HAIKU_INPUT_COST_PER_MTK = 0.025;   // $0.025/MTok
const HAIKU_OUTPUT_COST_PER_MTK = 0.125;  // $0.125/MTok
const AVG_INPUT_TOKENS = 4400;
const AVG_OUTPUT_TOKENS = 800;
const COST_PER_CONVERSATION_CENTS = Math.ceil(
  (AVG_INPUT_TOKENS / 1_000_000 * HAIKU_INPUT_COST_PER_MTK +
   AVG_OUTPUT_TOKENS / 1_000_000 * HAIKU_OUTPUT_COST_PER_MTK) * 100
); // ~0.02 cent

const DAILY_BUDGET_CENTS = 50; // Kullanıcı başı günlük max $0.50

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { user_id } = await req.json();

  if (!user_id) {
    return new Response(JSON.stringify({ error: "user_id required" }), { status: 400 });
  }

  // 0. Per-user rate limit: max 3 istek / 10 dakika
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: recentRequests } = await supabase
    .from("filter_stats")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user_id)
    .gte("created_at", tenMinAgo);

  if (recentRequests && recentRequests >= 3) {
    return new Response(JSON.stringify({ error: "Too many requests. Please wait." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Günlük bütçe kontrolü
  const { data: stats } = await supabase
    .from("filter_stats")
    .select("cost_cents, agent_conversations_started")
    .eq("user_id", user_id)
    .eq("date", new Date().toISOString().split("T")[0])
    .single();

  if (stats && stats.cost_cents >= DAILY_BUDGET_CENTS) {
    console.log(`User ${user_id} günlük bütçeye ulaştı: ${stats.cost_cents} cent`);
    return new Response(JSON.stringify({
      message: "Günlük eşleşme limiti doldu",
      conversations_today: stats.agent_conversations_started,
      cost_today_cents: stats.cost_cents,
    }));
  }

  // 2. PRE-FILTER: DB sorgusu ile uygun adayları bul (API yok, ücretsiz)
  const remainingBudget = DAILY_BUDGET_CENTS - (stats?.cost_cents || 0);
  const maxConversations = Math.min(
    Math.floor(remainingBudget / Math.max(COST_PER_CONVERSATION_CENTS, 1)),
    20 - (stats?.agent_conversations_started || 0), // günlük max 20
    15 // tek seferde max 15
  );

  const { data: candidates } = await supabase.rpc("get_filtered_candidates", {
    p_user_id: user_id,
    p_limit: (Number.isFinite(maxConversations) && maxConversations > 0 ? maxConversations : 10),
  });

  if (!candidates?.length) {
    return new Response(JSON.stringify({
      message: "Şu an uygun aday yok",
      filtered_count: 0,
    }));
  }

  console.log(`Pre-filter: ${candidates.length} aday seçildi (günlük limit içinde)`);

  // 3. Kullanıcının agent'ını al
  const { data: myAgent } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", user_id)
    .single();

  if (!myAgent) {
    return new Response(JSON.stringify({ error: "Agent bulunamadı" }), { status: 404 });
  }

  // 4. Pre-filter skoruna göre sırala, en yüksek uyumlu olanlarla başla
  const sortedCandidates = candidates.sort(
    (a: any, b: any) => b.filter_score - a.filter_score
  );

  // 5. Her uygun aday için konuşma başlat
  let startedCount = 0;
  const errors = [];

  for (const candidate of sortedCandidates) {
    try {
      // Queue'ya ekle (duplicate kontrolü unique constraint ile)
      const { data: queueEntry, error: queueError } = await supabase
        .from("match_queue")
        .insert({
          agent_a_id: myAgent.id,
          agent_b_id: candidate.candidate_agent_id,
          status: "in_progress",
        })
        .select()
        .single();

      if (queueError) {
        if (queueError.code === "23505") continue; // zaten var, atla
        throw queueError;
      }

      // Konuşma oluştur
      const { data: conv } = await supabase
        .from("agent_conversations")
        .insert({
          queue_id: queueEntry.id,
          agent_a_id: myAgent.id,
          agent_b_id: candidate.candidate_agent_id,
        })
        .select()
        .single();

      // Maliyet takibi güncelle
      await supabase.rpc("track_conversation_cost", {
        p_user_id: user_id,
        p_cost_cents: COST_PER_CONVERSATION_CENTS,
        p_candidates_total: candidates.length,
        p_candidates_filtered: sortedCandidates.length,
      });

      // Agent match'i async başlat (fire and forget)
      fetch(AGENT_MATCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({
          conversation_id: conv.id,
          model: "claude-haiku-4-5-20251001", // Haiku — 12x ucuz
        }),
      }).catch(console.error);

      startedCount++;
    } catch (err) {
      errors.push({ candidate: candidate.candidate_user_id, error: err.message });
    }
  }

  return new Response(
    JSON.stringify({
      started: startedCount,
      candidates_evaluated: candidates.length,
      estimated_cost_cents: startedCount * COST_PER_CONVERSATION_CENTS,
      errors: errors.length ? errors : undefined,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
