// supabase/functions/agent-match/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_TURNS = 8;

const COMPACT_SYSTEM_SUFFIX = `

ÖZET KURALLAR:
- Kısa mesajlar (2-3 cümle max)
- 6 turdan sonra karar ver
- Format:
  VERDICT: match|no_match
  SCORE: 0-100 (genel uyum)
  BREAKDOWN:
    values: 0-100 (temel değerler, hayat felsefesi)
    communication: 0-100 (iletişim tarzı uyumu)
    lifestyle: 0-100 (yaşam tarzı, rutinler, sosyal alışkanlıklar)
    humor: 0-100 (mizah anlayışı)
  REASON: tek cümle`;

interface Message {
  role: "user" | "assistant";
  content: string;
  speaker: "agent_a" | "agent_b";
}

interface CompatibilityBreakdown {
  values: number;
  communication: number;
  lifestyle: number;
  humor: number;
}

interface AgentVerdict {
  verdict: "match" | "no_match" | "uncertain";
  score: number;
  reason: string;
  breakdown: CompatibilityBreakdown | null;
}

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

async function callClaude(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  model: string
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 500,
          system: systemPrompt + COMPACT_SYSTEM_SUFFIX,
          messages,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const data = await response.json();

      if (!response.ok) {
        // 429 (rate limit) veya 5xx hatalarda retry yap
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`Claude API error ${response.status}: ${JSON.stringify(data)}`);
        }
        // 4xx (client error) hatalarda retry yapma
        throw new Error(`Claude API client error ${response.status}: ${JSON.stringify(data)}`);
      }

      if (!data.content || data.content.length === 0) {
        throw new Error(`Empty content from model ${model}: ${JSON.stringify(data)}`);
      }

      return data.content[0].text;
    } catch (err: any) {
      lastError = err;
      // Client error'larda retry yapma
      if (err.message?.includes('client error')) throw err;

      console.warn(`Claude API attempt ${attempt + 1}/${MAX_RETRIES} failed:`, err.message);
      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error("callClaude failed after retries");
}

function parseVerdict(text: string): AgentVerdict | null {
  if (!text.includes("VERDICT:")) return null;

  const verdictMatch = text.match(/VERDICT:\s*(match|no_match|uncertain)/i);
  const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
  const reasonMatch = text.match(/REASON:\s*(.+?)(?:\n|$)/i);

  if (!verdictMatch) return null;

  // 4-metrik compatibility breakdown parsing
  const metrics: Array<keyof CompatibilityBreakdown> = ['values', 'communication', 'lifestyle', 'humor'];
  const breakdown: Partial<CompatibilityBreakdown> = {};
  for (const m of metrics) {
    const regex = new RegExp(`${m}:\\s*(\\d+)`, 'i');
    const match = text.match(regex);
    if (match) breakdown[m] = parseInt(match[1]);
  }

  // Tüm 4 metrik varsa dolu object, yoksa null
  const fullBreakdown: CompatibilityBreakdown | null =
    Object.keys(breakdown).length === 4
      ? breakdown as CompatibilityBreakdown
      : null;

  return {
    verdict: verdictMatch[1].toLowerCase() as "match" | "no_match" | "uncertain",
    score: scoreMatch ? parseInt(scoreMatch[1]) : 50,
    reason: reasonMatch ? reasonMatch[1].trim() : "",
    breakdown: fullBreakdown,
  };
}

function buildMessagesForAgent(
  fullHistory: Message[],
  currentAgent: "agent_a" | "agent_b"
): { role: "user" | "assistant"; content: string }[] {
  const mapped = fullHistory.map((msg) => ({
    role: msg.speaker === currentAgent ? "assistant" : "user",
    content: msg.content,
  }));

  if (mapped.length > 0 && mapped[mapped.length - 1].role === "assistant") {
    return mapped.slice(0, -1);
  }

  return mapped;
}

async function runAgentConversation(conversationId: string, model: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: conv } = await supabase
    .from("agent_conversations")
    .select(`
      *,
      agent_a:agent_a_id(system_prompt, user_id),
      agent_b:agent_b_id(system_prompt, user_id)
    `)
    .eq("id", conversationId)
    .single();

  if (!conv) throw new Error("Conversation not found");

  const messages: Message[] = conv.messages || [];
  let agentAVerdict: AgentVerdict | null = null;
  let agentBVerdict: AgentVerdict | null = null;
  let turnCount = conv.turn_count || 0;

  if (messages.length === 0) {
    const opening = await callClaude(
      conv.agent_a.system_prompt,
      [{ role: "user", content: "Merhaba! Ben de bir dating agentiyim. Kullanicilarimizin uyumlu olup olmadigini anlamak icin seninle tanismak istedim." }],
      model
    );
    messages.push({ role: "assistant", content: opening, speaker: "agent_a" });
    turnCount++;

    await supabase.from("agent_conversations")
      .update({ messages, turn_count: turnCount })
      .eq("id", conversationId);
  }

  while (turnCount < MAX_TURNS && !agentAVerdict && !agentBVerdict) {
    const lastSpeaker = messages[messages.length - 1].speaker;
    const currentSpeaker = lastSpeaker === "agent_a" ? "agent_b" : "agent_a";
    const currentPrompt = currentSpeaker === "agent_a"
      ? conv.agent_a.system_prompt
      : conv.agent_b.system_prompt;

    let systemPrompt = currentPrompt;
    if (turnCount >= MAX_TURNS - 2) {
      systemPrompt += "\n\nYeterli bilgi topladın. Şimdi VERDICT formatında karar ver.";
    }

    const agentMessages = buildMessagesForAgent(messages, currentSpeaker);
    const response = await callClaude(systemPrompt, agentMessages, model);

    messages.push({ role: "assistant", content: response, speaker: currentSpeaker });

    const verdict = parseVerdict(response);
    if (verdict) {
      if (currentSpeaker === "agent_a") agentAVerdict = verdict;
      else agentBVerdict = verdict;
    }

    turnCount++;

    await supabase.from("agent_conversations")
      .update({ messages, turn_count: turnCount })
      .eq("id", conversationId);

    if (agentAVerdict && agentBVerdict) break;

    await new Promise((r) => setTimeout(r, 500));
  }

  const forceVerdict = async (speaker: "agent_a" | "agent_b") => {
    const prompt = speaker === "agent_a" ? conv.agent_a.system_prompt : conv.agent_b.system_prompt;
    const agentMessages = buildMessagesForAgent(messages, speaker);
    if (agentMessages.length === 0) {
      return { verdict: "uncertain" as const, score: 50, reason: "Yeterli bilgi toplanamadi" };
    }
    const resp = await callClaude(
      prompt + "\nHemen VERDICT: match veya no_match formatinda karar ver. SCORE: 0-100. REASON: tek cumle.",
      agentMessages,
      model
    );
    return parseVerdict(resp) || { verdict: "uncertain" as const, score: 50, reason: "Yeterli bilgi toplanamadi" };
  };

  if (!agentAVerdict) agentAVerdict = await forceVerdict("agent_a");
  if (!agentBVerdict) agentBVerdict = await forceVerdict("agent_b");

  const finalResult =
    agentAVerdict.verdict === "match" && agentBVerdict.verdict === "match"
      ? "matched"
      : "not_matched";

  // Compatibility breakdown: Her iki agent'ın breakdown'larının ortalaması alınır
  let mergedBreakdown: CompatibilityBreakdown | null = null;
  if (agentAVerdict.breakdown && agentBVerdict.breakdown) {
    mergedBreakdown = {
      values: Math.round((agentAVerdict.breakdown.values + agentBVerdict.breakdown.values) / 2),
      communication: Math.round((agentAVerdict.breakdown.communication + agentBVerdict.breakdown.communication) / 2),
      lifestyle: Math.round((agentAVerdict.breakdown.lifestyle + agentBVerdict.breakdown.lifestyle) / 2),
      humor: Math.round((agentAVerdict.breakdown.humor + agentBVerdict.breakdown.humor) / 2),
    };
  } else if (agentAVerdict.breakdown) {
    mergedBreakdown = agentAVerdict.breakdown;
  } else if (agentBVerdict.breakdown) {
    mergedBreakdown = agentBVerdict.breakdown;
  }

  await supabase.from("agent_conversations").update({
    messages,
    turn_count: turnCount,
    agent_a_score: agentAVerdict.score,
    agent_a_verdict: agentAVerdict.verdict,
    agent_a_reasoning: agentAVerdict.reason,
    agent_b_score: agentBVerdict.score,
    agent_b_verdict: agentBVerdict.verdict,
    agent_b_reasoning: agentBVerdict.reason,
    compatibility_breakdown: mergedBreakdown,
    final_result: finalResult,
    completed_at: new Date().toISOString(),
  }).eq("id", conversationId);

  await supabase.from("match_queue")
    .update({ status: "completed" })
    .eq("id", conv.queue_id);

  if (finalResult === "matched") {
    await supabase.from("matches").insert({
      user_a_id: conv.agent_a.user_id,
      user_b_id: conv.agent_b.user_id,
      conversation_id: conversationId,
    });
    console.log(`MATCH: ${conv.agent_a.user_id} <-> ${conv.agent_b.user_id}`);

    try {
      const avgScore = Math.round(((agentAVerdict.score || 0) + (agentBVerdict.score || 0)) / 2);
      const { data: userA } = await supabase.from("users").select("name, push_token, notifications_enabled").eq("id", conv.agent_a.user_id).single();
      const { data: userB } = await supabase.from("users").select("name, push_token, notifications_enabled").eq("id", conv.agent_b.user_id).single();

      const notifications: any[] = [];
      if (userA?.push_token && userA?.notifications_enabled !== false) {
        notifications.push({ to: userA.push_token, title: "Yeni esleme! 🎉", body: `Agentin ${userB?.name || "biri"} ile eslesti — ${avgScore} uyum puani`, sound: "default" });
      }
      if (userB?.push_token && userB?.notifications_enabled !== false) {
        notifications.push({ to: userB.push_token, title: "Yeni esleme! 🎉", body: `Agentin ${userA?.name || "biri"} ile eslesti — ${avgScore} uyum puani`, sound: "default" });
      }
      if (notifications.length > 0) {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(notifications),
        });
      }
    } catch (notifErr) {
      console.error("Bildirim hatasi:", notifErr);
    }
  } else {
    console.log(`No match | A:${agentAVerdict.verdict}(${agentAVerdict.score}) B:${agentBVerdict.verdict}(${agentBVerdict.score})`);
  }

  return { finalResult, agentAVerdict, agentBVerdict, model };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const { conversation_id, model = "claude-haiku-4-5" } = await req.json();

    if (!conversation_id) {
      return new Response(JSON.stringify({ error: "conversation_id required" }), { status: 400 });
    }

    const result = await runAgentConversation(conversation_id, model);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Agent match error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
