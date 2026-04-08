// supabase/functions/onboarding-chat/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tehlikeli prompt kalıplarını temizle
function sanitizeInput(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const patterns = [
    /OVERRIDE/gi,
    /IGNORE\s+(ABOVE|ALL|PREVIOUS|INSTRUCTIONS)/gi,
    /SYSTEM\s*:/gi,
    /NEW\s+INSTRUCTIONS?/gi,
    /FORGET\s+(EVERYTHING|ALL|ABOVE)/gi,
    /YOU\s+ARE\s+NOW/gi,
    /ACT\s+AS/gi,
    /PRETEND/gi,
    /DISREGARD/gi,
  ];
  let sanitized = text.trim().slice(0, 2000);
  for (const p of patterns) {
    sanitized = sanitized.replace(p, '[removed]');
  }
  return sanitized;
}

// Basit per-IP rate limit (in-memory, Deno edge function yaşam süresi boyunca)
const ipRequests = new Map<string, number[]>();
const RATE_LIMIT_MAX = 30; // 30 istek
const RATE_LIMIT_WINDOW = 60000; // 1 dakika

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (ipRequests.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    ipRequests.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  ipRequests.set(ip, timestamps);
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Rate limit kontrolü
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please wait.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { system_prompt, messages } = await req.json();

    // Input sanitization
    const cleanPrompt = sanitizeInput(system_prompt || '');
    const cleanMessages = (messages || []).map((m: any) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: typeof m.content === 'string' ? m.content.slice(0, 2000) : '',
    }));

    // Mesaj sayısı limiti
    if (cleanMessages.length > 30) {
      return new Response(
        JSON.stringify({ error: 'Too many messages in conversation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 400,
        system: cleanPrompt,
        messages: cleanMessages,
      }),
    });

    const data = await response.json();

    if (!data.content?.[0]?.text) {
      throw new Error(`Claude error: ${JSON.stringify(data)}`);
    }

    return new Response(
      JSON.stringify({ response: data.content[0].text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Onboarding chat error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
