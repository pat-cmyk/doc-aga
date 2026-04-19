// supabase/functions/accept-invitation/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const RATE_LIMIT_TOKEN_MAX = 10;
const RATE_LIMIT_IP_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const tokenRate = new Map<string, { count: number; resetAt: number }>();
const ipRate = new Map<string, { count: number; resetAt: number }>();

function rateCheck(
  map: Map<string, { count: number; resetAt: number }>,
  key: string,
  max: number,
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const rec = map.get(key);
  if (!rec || now > rec.resetAt) {
    map.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  if (rec.count >= max) {
    return { allowed: false, retryAfter: Math.ceil((rec.resetAt - now) / 1000) };
  }
  rec.count++;
  return { allowed: true };
}

const COMMON_PASSWORDS = new Set<string>([
  "password", "12345678", "qwerty123", "password1", "iloveyou",
  "admin123", "welcome1", "letmein1", "abc12345", "111111111",
  // short embedded sample; full list pulled at build via env if needed
]);

function validatePassword(pw: string): { ok: boolean; reason?: string } {
  if (!pw || pw.length < 8) return { ok: false, reason: "too_short" };
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) return { ok: false, reason: "too_common" };
  return { ok: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  return json({ error: "not_implemented" }, 501); // replaced in B3
});
