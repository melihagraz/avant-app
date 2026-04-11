// supabase/functions/process-like/index.ts
// Handles manual likes from Discover feed: like, super_like, pass
// Checks for mutual likes and creates a match if both users like each other

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FREE_LIKES_PER_DAY = 15;
const FREE_SUPER_LIKES_PER_DAY = 1;
const PREMIUM_SUPER_LIKES_PER_DAY = 3;

// Sanitize prompt-injection-like patterns from comments
function sanitizeComment(text: string): string {
  if (!text || typeof text !== "string") return "";
  const patterns = [
    /OVERRIDE/gi,
    /IGNORE\s+(ABOVE|ALL|PREVIOUS|INSTRUCTIONS)/gi,
    /SYSTEM\s*:/gi,
    /VERDICT:\s*(match|no_match)/gi,
  ];
  let sanitized = text.trim().slice(0, 200);
  for (const p of patterns) sanitized = sanitized.replace(p, "[removed]");
  return sanitized;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !authUser) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body = await req.json();
    const { liked_id, action, comment, target_photo_index, target_prompt_key } = body;

    // Validation
    if (!liked_id || typeof liked_id !== "string") {
      return new Response(JSON.stringify({ error: "liked_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["like", "super_like", "pass"].includes(action)) {
      return new Response(JSON.stringify({ error: "invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (authUser.id === liked_id) {
      return new Response(JSON.stringify({ error: "cannot like yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (action === "super_like") {
      if (!comment || typeof comment !== "string" || comment.trim().length < 5) {
        return new Response(JSON.stringify({ error: "super_like requires comment (min 5 chars)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Premium check
    const { data: liker } = await supabase
      .from("users")
      .select("is_premium, name")
      .eq("id", authUser.id)
      .single();
    const isPremium = !!liker?.is_premium;

    // Rate limit check (only for like + super_like, not pass)
    const today = new Date().toISOString().split("T")[0];
    let stats = null;
    if (action !== "pass") {
      const { data: existingStats } = await supabase
        .from("daily_like_stats")
        .select("*")
        .eq("user_id", authUser.id)
        .eq("date", today)
        .maybeSingle();
      stats = existingStats;

      if (action === "like" && !isPremium && stats && stats.like_count >= FREE_LIKES_PER_DAY) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "daily_like_limit_reached",
            remaining_likes: 0,
            remaining_super_likes: Math.max(0, FREE_SUPER_LIKES_PER_DAY - (stats?.super_like_count || 0)),
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (action === "super_like") {
        const limit = isPremium ? PREMIUM_SUPER_LIKES_PER_DAY : FREE_SUPER_LIKES_PER_DAY;
        if (stats && stats.super_like_count >= limit) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: "daily_super_like_limit_reached",
              remaining_likes: Math.max(0, FREE_LIKES_PER_DAY - (stats?.like_count || 0)),
              remaining_super_likes: 0,
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Insert the like/pass row
    const cleanComment = action === "super_like" ? sanitizeComment(comment) : null;
    const { error: insertErr } = await supabase.from("user_likes").insert({
      liker_id: authUser.id,
      liked_id,
      action,
      comment: cleanComment,
      target_photo_index: target_photo_index ?? null,
      target_prompt_key: target_prompt_key ?? null,
    });

    if (insertErr) {
      // Likely UNIQUE violation (already liked/passed)
      console.error("user_likes insert error:", insertErr);
      return new Response(
        JSON.stringify({ ok: false, error: "already_acted_on_this_user" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment daily counters (only for like / super_like)
    if (action === "like" || action === "super_like") {
      if (stats) {
        await supabase
          .from("daily_like_stats")
          .update({
            like_count: action === "like" ? stats.like_count + 1 : stats.like_count,
            super_like_count: action === "super_like" ? stats.super_like_count + 1 : stats.super_like_count,
          })
          .eq("id", stats.id);
      } else {
        await supabase.from("daily_like_stats").insert({
          user_id: authUser.id,
          date: today,
          like_count: action === "like" ? 1 : 0,
          super_like_count: action === "super_like" ? 1 : 0,
        });
      }
    }

    // Check for mutual like (only for like / super_like, not pass)
    let matched = false;
    let matchId: string | null = null;

    if (action === "like" || action === "super_like") {
      const { data: reciprocal } = await supabase
        .from("user_likes")
        .select("id, action")
        .eq("liker_id", liked_id)
        .eq("liked_id", authUser.id)
        .in("action", ["like", "super_like"])
        .maybeSingle();

      if (reciprocal) {
        // Mutual like → create match
        // Avoid duplicate match: check if a match already exists between these two users
        const { data: existingMatch } = await supabase
          .from("matches")
          .select("id")
          .or(`and(user_a_id.eq.${authUser.id},user_b_id.eq.${liked_id}),and(user_a_id.eq.${liked_id},user_b_id.eq.${authUser.id})`)
          .maybeSingle();

        if (existingMatch) {
          matched = true;
          matchId = existingMatch.id;
        } else {
          const { data: newMatch, error: matchErr } = await supabase
            .from("matches")
            .insert({
              user_a_id: authUser.id,
              user_b_id: liked_id,
              conversation_id: null, // Manual match, no agent conversation
            })
            .select("id")
            .single();

          if (!matchErr && newMatch) {
            matched = true;
            matchId = newMatch.id;

            // Send push notification to the other user
            const { data: liked } = await supabase
              .from("users")
              .select("push_token, name, notifications_enabled")
              .eq("id", liked_id)
              .single();

            if (liked?.push_token && liked.notifications_enabled !== false) {
              try {
                await fetch(EXPO_PUSH_URL, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    to: liked.push_token,
                    title: "Yeni eşleşme! 💜",
                    body: `${liker?.name || "Biri"} ile eşleştin!`,
                    sound: "default",
                    data: { match_id: matchId, type: "manual_match" },
                  }),
                });
              } catch (notifErr) {
                console.error("push notification failed:", notifErr);
              }
            }
          }
        }
      }
    }

    // Get updated counters for response
    const { data: updatedStats } = await supabase
      .from("daily_like_stats")
      .select("like_count, super_like_count")
      .eq("user_id", authUser.id)
      .eq("date", today)
      .maybeSingle();

    const remainingLikes = isPremium
      ? 9999
      : Math.max(0, FREE_LIKES_PER_DAY - (updatedStats?.like_count || 0));
    const remainingSuperLikes = Math.max(
      0,
      (isPremium ? PREMIUM_SUPER_LIKES_PER_DAY : FREE_SUPER_LIKES_PER_DAY) - (updatedStats?.super_like_count || 0)
    );

    return new Response(
      JSON.stringify({
        ok: true,
        matched,
        match_id: matchId,
        remaining_likes: remainingLikes,
        remaining_super_likes: remainingSuperLikes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("process-like error:", err);
    return new Response(JSON.stringify({ error: err?.message || "internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
