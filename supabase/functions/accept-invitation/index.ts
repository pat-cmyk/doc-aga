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

type InviteLookup = {
  type: "farm" | "user" | "coop";
  status: "pending" | "accepted" | "revoked" | "expired" | "declined";
  email: string;
  role: string;
  role_label: string;
  inviter_name: string;
  inviter_email: string;
  target_name: string;
  invited_at: string;
  expires_at: string;
};

type AcceptRequest = {
  token: string;
  full_name?: string;
  password?: string;
};

async function loadInvite(
  admin: ReturnType<typeof createClient>,
  token: string,
): Promise<InviteLookup | null> {
  const { data, error } = await admin.rpc("lookup_invitation", { p_token: token });
  if (error || !data || !Array.isArray(data) || data.length === 0) return null;
  return data[0] as InviteLookup;
}

function resolveRedirect(invite: InviteLookup, extra: { farm_id?: string | null }): string {
  if (invite.type === "user") {
    const map: Record<string, string> = {
      admin: "/admin",
      government: "/government",
      merchant: "/merchant",
      distributor: "/distributor",
      cooperative: "/cooperative",
    };
    return map[invite.role] ?? "/";
  }
  if (invite.type === "farm") {
    return invite.role === "farmhand" ? "/farmhand" : "/";
  }
  return "/"; // coop
}

async function runAcceptAsUser(
  invite: InviteLookup,
  userJwt: string,
  token: string,
): Promise<{ error?: string; farm_id?: string | null }> {
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: `Bearer ${userJwt}` } }, auth: { persistSession: false } },
  );

  if (invite.type === "user") {
    const { data, error } = await userClient.rpc("accept_user_invitation", { _token: token });
    if (error) return { error: error.message };
    return { farm_id: null };
  }
  if (invite.type === "farm") {
    const { data, error } = await userClient.rpc("accept_farm_invitation", { p_token: token });
    if (error) return { error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.success) return { error: row?.error_code ?? "accept_failed" };
    return { farm_id: row.farm_id };
  }
  if (invite.type === "coop") {
    const { error } = await userClient
      .from("cooperative_memberships")
      .update({ invitation_status: "accepted", accepted_at: new Date().toISOString() })
      .eq("invitation_token", token);
    if (error) return { error: error.message };
    return { farm_id: null };
  }
  return { error: "unsupported" };
}

async function writeAcceptedIp(
  admin: ReturnType<typeof createClient>,
  invite: InviteLookup,
  token: string,
  userId: string,
  ip: string,
) {
  if (invite.type === "user") {
    await admin.from("user_invitations").update({ accepted_ip: ip }).eq("invitation_token", token);
  } else if (invite.type === "farm") {
    await admin.from("farm_memberships").update({ accepted_ip: ip, user_id: userId }).eq("invitation_token", token);
  } else {
    await admin.from("cooperative_memberships").update({ accepted_ip: ip }).eq("invitation_token", token);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: AcceptRequest;
  try { body = await req.json(); } catch { return json({ code: "bad_request" }, 400); }
  const { token, full_name, password } = body ?? {};
  if (!token) return json({ code: "bad_request" }, 400);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const tRate = rateCheck(tokenRate, token, RATE_LIMIT_TOKEN_MAX);
  if (!tRate.allowed) return json({ code: "rate_limited", retry_after: tRate.retryAfter }, 429);
  const iRate = rateCheck(ipRate, ip, RATE_LIMIT_IP_MAX);
  if (!iRate.allowed) return json({ code: "rate_limited", retry_after: iRate.retryAfter }, 429);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const invite = await loadInvite(admin, token);
  if (!invite) return json({ code: "TOKEN_NOT_FOUND" }, 404);
  if (invite.status === "expired") return json({ code: "TOKEN_EXPIRED" }, 410);
  if (invite.status === "revoked") return json({ code: "TOKEN_REVOKED" }, 410);
  if (invite.status === "accepted") return json({ code: "TOKEN_ALREADY_ACCEPTED" }, 409);
  if (invite.status !== "pending") return json({ code: "TOKEN_NOT_FOUND" }, 404);

  // Branch: existing user (authed) vs new user (has password) — implemented in B4 + B5
  const authHeader = req.headers.get("Authorization");
  const hasAuth = !!authHeader && authHeader.startsWith("Bearer ");
  if (hasAuth) {
    const jwt = authHeader!.replace("Bearer ", "");
    const { data: { user }, error: uErr } = await admin.auth.getUser(jwt);
    if (uErr || !user?.email) return json({ code: "EMAIL_MISMATCH" }, 409);
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return json({ code: "EMAIL_MISMATCH" }, 409);
    }
    const acceptResult = await runAcceptAsUser(invite, jwt, token);
    if (acceptResult.error) return json({ code: acceptResult.error }, 409);
    await writeAcceptedIp(admin, invite, token, user.id, ip);
    return json({
      session: null, // client already has a session; no need to re-issue
      redirectTo: resolveRedirect(invite, { farm_id: acceptResult.farm_id }),
      invite: { type: invite.type, role: invite.role, target_name: invite.target_name },
    });
  }

  return json({ code: "not_implemented", invite }, 501); // new-user branch lands in Task B5
});
