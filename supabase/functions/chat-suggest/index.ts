// supabase/functions/chat-suggest/index.ts
// Generates 3 personalized message suggestions for a chat conversation
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RETRIES = 2;

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
      }

      const data = await response.json();
      return data.content?.[0]?.text || "";
    } catch (err) {
      lastError = err as Error;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error("Claude API failed");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const { match_id } = await req.json();
    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Check premium
    const { data: userData } = await supabaseUser
      .from("users")
      .select("is_premium, name")
      .eq("id", user.id)
      .single();

    if (!userData?.is_premium) {
      return new Response(JSON.stringify({ error: "premium_required" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Fetch match data
    const { data: matchData } = await supabaseUser
      .from("matches")
      .select("*, conversation:conversation_id(agent_a_reasoning, agent_a_score, agent_b_score, compatibility_breakdown)")
      .eq("id", match_id)
      .single();

    if (!matchData) {
      return new Response(JSON.stringify({ error: "match_not_found" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Fetch other user
    const otherId = matchData.user_a_id === user.id ? matchData.user_b_id : matchData.user_a_id;
    const { data: otherUserData } = await supabaseUser
      .from("users")
      .select("name, city, prompts")
      .eq("id", otherId)
      .single();

    // Fetch recent messages
    const { data: recentMessages } = await supabaseUser
      .from("human_messages")
      .select("sender_id, content, created_at")
      .eq("match_id", match_id)
      .order("created_at", { ascending: false })
      .limit(20);

    const messagesContext = (recentMessages || [])
      .reverse()
      .map((m) => `${m.sender_id === user.id ? "Ben" : otherUserData?.name || "Onlar"}: ${m.content}`)
      .join("\n");

    const score = matchData.conversation
      ? Math.round(((matchData.conversation.agent_a_score || 0) + (matchData.conversation.agent_b_score || 0)) / 2)
      : 0;

    const systemPrompt = `Sen bir dating kocu asistaninsin. Kullanici bir dating uygulamasinda birisiyle konusuyor.
Gorev: 3 kisa, dogal ve kisisellestirilmis mesaj onerisi uret.
Her oneri sicak, samimi ve konusmaya uygun olmali.
Mesajlar Turkce olmali.
JSON formatinda cevap ver: [{"emoji":"...", "text":"..."}]
Sadece JSON dondur, baska bir sey yazma.`;

    const userPrompt = `Benim adim: ${userData.name}
Karsi tarafin adi: ${otherUserData?.name || "bilinmiyor"}
Karsi tarafin sehri: ${otherUserData?.city || "bilinmiyor"}
Uyumluluk skoru: %${score}
Agent analizi: ${matchData.conversation?.agent_a_reasoning || "yok"}

Son mesajlar:
${messagesContext || "(henuz mesaj yok)"}

Bu konusmaya uygun 3 mesaj oner.`;

    const result = await callClaude(systemPrompt, userPrompt);

    // Parse JSON
    let suggestions;
    try {
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      suggestions = [
        { emoji: "\u{1F44B}", text: "Merhaba! Seni daha iyi tanimak isterim." },
        { emoji: "\u2615", text: "Bir kahve icmeye ne dersin?" },
        { emoji: "\u{1F30D}", text: "En son nereye seyahat ettin?" },
      ];
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("chat-suggest error:", err);
    return new Response(
      JSON.stringify({
        suggestions: [
          { emoji: "\u{1F44B}", text: "Merhaba! Profilini cok begendim." },
          { emoji: "\u2615", text: "Bir kahve icmeye ne dersin?" },
          { emoji: "\u{1F4F8}", text: "Harika fotograflarin var! Neresi burasi?" },
        ],
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
