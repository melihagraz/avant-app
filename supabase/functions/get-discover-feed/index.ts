// supabase/functions/get-discover-feed/index.ts
// Returns filtered list of discoverable users for the Discover feed

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FEED_LIMIT = 20;

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

    // Get current user's preferences
    const { data: me } = await supabase
      .from("users")
      .select("seeking, age_min, age_max, city, gender")
      .eq("id", authUser.id)
      .single();

    if (!me) {
      return new Response(JSON.stringify({ error: "user profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update last_active_at (best effort, ignore errors)
    try {
      await supabase
        .from("users")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", authUser.id);
    } catch {}

    // Build query
    let query = supabase
      .from("users")
      .select("id, name, age, city, gender, photos, prompts, dating_intention, family_plans, education, religion, job, last_active_at")
      .eq("is_discoverable", true)
      .neq("id", authUser.id);

    // Age filter
    if (me.age_min) query = query.gte("age", me.age_min);
    if (me.age_max) query = query.lte("age", me.age_max);

    // Gender filter (seeking)
    if (me.seeking && Array.isArray(me.seeking) && me.seeking.length > 0 && !me.seeking.includes("any")) {
      query = query.in("gender", me.seeking);
    }

    // Sort by recency
    query = query.order("last_active_at", { ascending: false }).limit(FEED_LIMIT * 3);

    const { data: candidates, error: fetchErr } = await query;
    if (fetchErr) {
      console.error("fetch candidates error:", fetchErr);
      return new Response(JSON.stringify({ error: "fetch failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exclude already liked/passed users
    const { data: alreadyActedOn } = await supabase
      .from("user_likes")
      .select("liked_id")
      .eq("liker_id", authUser.id);
    const excludedIds = new Set((alreadyActedOn || []).map((r) => r.liked_id));

    // Exclude users already in matches with current user
    const { data: existingMatches } = await supabase
      .from("matches")
      .select("user_a_id, user_b_id")
      .or(`user_a_id.eq.${authUser.id},user_b_id.eq.${authUser.id}`);
    for (const m of existingMatches || []) {
      excludedIds.add(m.user_a_id === authUser.id ? m.user_b_id : m.user_a_id);
    }

    const filtered = (candidates || [])
      .filter((u) => !excludedIds.has(u.id))
      .slice(0, FEED_LIMIT);

    return new Response(
      JSON.stringify({
        profiles: filtered,
        count: filtered.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("get-discover-feed error:", err);
    return new Response(JSON.stringify({ error: err?.message || "internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
