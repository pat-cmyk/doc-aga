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

function maskToken(token: string): string {
  if (!token || token.length < 8) return "****";
  return `****${token.slice(-4)}`;
}

function extractIp(req: Request): string | null {
  const raw = req.headers.get("cf-connecting-ip")
    ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? null;
  if (!raw) return null;
  const ipv4 = /^\d{1,3}(\.\d{1,3}){3}$/;
  const ipv6 = /^[a-f0-9:]+$/i;
  if (ipv4.test(raw) || ipv6.test(raw)) return raw;
  return null;
}

function mapAcceptError(msg: string): string {
  const m = (msg ?? "").toLowerCase();
  if (m.includes("not_authenticated")) return "EMAIL_MISMATCH"; // shouldn't reach here but safe
  if (m.includes("email_mismatch")) return "EMAIL_MISMATCH";
  if (m.includes("invitation_accepted") || m.includes("already_accepted")) return "TOKEN_ALREADY_ACCEPTED";
  if (m.includes("invitation_expired") || m.includes("token_expired") || m.includes("expired")) return "TOKEN_EXPIRED";
  if (m.includes("invitation_revoked") || m.includes("revoked")) return "TOKEN_REVOKED";
  if (m.includes("invitation_not_found") || m.includes("invalid_token") || m.includes("not_found")) return "TOKEN_NOT_FOUND";
  return "INTERNAL";
}

function statusFor(code: string): number {
  switch (code) {
    case "TOKEN_EXPIRED":
    case "TOKEN_REVOKED": return 410;
    case "TOKEN_NOT_FOUND": return 404;
    case "EMAIL_MISMATCH":
    case "TOKEN_ALREADY_ACCEPTED": return 409;
    default: return 500;
  }
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

function resolveRedirect(invite: InviteLookup): string {
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
    const { error } = await userClient.rpc("accept_user_invitation", { _token: token });
    if (error) return { error: mapAcceptError(error.message) };
    return { farm_id: null };
  }
  if (invite.type === "farm") {
    const { data, error } = await userClient.rpc("accept_farm_invitation", { p_token: token });
    if (error) return { error: mapAcceptError(error.message) };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.success) return { error: mapAcceptError(row?.error_code ?? "accept_failed") };
    return { farm_id: row.farm_id };
  }
  if (invite.type === "coop") {
    const { data, error } = await userClient.rpc("accept_cooperative_invitation", { _token: token });
    if (error) return { error: mapAcceptError(error.message) };
    if (typeof data === "string" && data.startsWith("error:")) {
      return { error: mapAcceptError(data.replace(/^error:/, "")) };
    }
    return { farm_id: null };
  }
  return { error: "INTERNAL" };
}

async function writeAcceptedIp(
  admin: ReturnType<typeof createClient>,
  invite: InviteLookup,
  token: string,
  userId: string,
  ip: string | null,
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

  const ip = extractIp(req);

  const tRate = rateCheck(tokenRate, token, RATE_LIMIT_TOKEN_MAX);
  if (!tRate.allowed) {
    console.log("invite_rate_limited", { token: maskToken(token), ip });
    return json({ code: "rate_limited", retry_after: tRate.retryAfter }, 429);
  }
  const iRate = rateCheck(ipRate, ip ?? "unknown", RATE_LIMIT_IP_MAX);
  if (!iRate.allowed) {
    console.log("invite_rate_limited", { token: maskToken(token), ip });
    return json({ code: "rate_limited", retry_after: iRate.retryAfter }, 429);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const invite = await loadInvite(admin, token);
  if (!invite) {
    console.log("invite_lookup_miss", { token: maskToken(token), status: undefined });
    return json({ code: "TOKEN_NOT_FOUND" }, 404);
  }
  if (invite.status === "expired") {
    console.log("invite_lookup_miss", { token: maskToken(token), status: invite.status });
    return json({ code: "TOKEN_EXPIRED" }, 410);
  }
  if (invite.status === "revoked") {
    console.log("invite_lookup_miss", { token: maskToken(token), status: invite.status });
    return json({ code: "TOKEN_REVOKED" }, 410);
  }
  if (invite.status === "accepted") {
    console.log("invite_lookup_miss", { token: maskToken(token), status: invite.status });
    return json({ code: "TOKEN_ALREADY_ACCEPTED" }, 409);
  }
  if (invite.status !== "pending") {
    console.log("invite_lookup_miss", { token: maskToken(token), status: invite.status });
    return json({ code: "TOKEN_NOT_FOUND" }, 404);
  }

  // Branch: existing user (authed) vs new user (has password) — implemented in B4 + B5
  const authHeader = req.headers.get("Authorization");
  const hasAuth = !!authHeader && authHeader.startsWith("Bearer ");
  if (hasAuth) {
    const jwt = authHeader!.replace("Bearer ", "");
    const { data: { user }, error: uErr } = await admin.auth.getUser(jwt);
    if (uErr || !user?.email) {
      console.log("invite_email_mismatch", { token: maskToken(token), expected_domain: invite.email.split("@")[1] });
      return json({ code: "EMAIL_MISMATCH" }, 409);
    }
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      console.log("invite_email_mismatch", { token: maskToken(token), expected_domain: invite.email.split("@")[1] });
      return json({ code: "EMAIL_MISMATCH" }, 409);
    }
    const acceptResult = await runAcceptAsUser(invite, jwt, token);
    if (acceptResult.error) return json({ code: acceptResult.error }, statusFor(acceptResult.error));
    try {
      await writeAcceptedIp(admin, invite, token, user.id, ip);
    } catch (_e) {
      console.error("writeAcceptedIp failed", { type: invite.type, token: maskToken(token) });
    }
    console.log("invite_accepted", { type: invite.type, role: invite.role, token: maskToken(token) });
    return json({
      session: null, // client already has a session; no need to re-issue
      redirectTo: resolveRedirect(invite),
      invite: { type: invite.type, role: invite.role, target_name: invite.target_name },
    });
  }

  // New-user branch
  if (!password) return json({ code: "bad_request", message: "password required" }, 400);
  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) return json({ code: "WEAK_PASSWORD", reason: pwCheck.reason }, 422);

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name ?? invite.email.split("@")[0] },
  });
  if (cErr) {
    console.error("invite_create_user_failed", { token: maskToken(token), error: cErr.message });
    if (/already (been )?registered|already exists|duplicate/i.test(cErr.message)) {
      return json({ code: "USER_EXISTS_SIGN_IN_REQUIRED" }, 409);
    }
    return json({ code: "INTERNAL", message: cErr.message }, 500);
  }
  if (!created?.user) return json({ code: "INTERNAL", message: "user_creation_failed" }, 500);

  // Sign in to mint a session the client can install
  const { data: session, error: sErr } = await admin.auth.signInWithPassword({
    email: invite.email,
    password,
  });
  if (sErr || !session?.session) {
    console.error("invite_signin_failed", { token: maskToken(token), error: sErr?.message });
    return json({ code: "INTERNAL", message: sErr?.message }, 500);
  }

  const acceptResult = await runAcceptAsUser(invite, session.session.access_token, token);
  if (acceptResult.error) return json({ code: acceptResult.error }, statusFor(acceptResult.error));

  try {
    await writeAcceptedIp(admin, invite, token, created.user.id, ip);
  } catch (_e) {
    console.error("writeAcceptedIp failed", { type: invite.type, token: maskToken(token) });
  }

  console.log("invite_accepted", { type: invite.type, role: invite.role, token: maskToken(token) });
  return json({
    session: {
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
    },
    redirectTo: resolveRedirect(invite),
    invite: { type: invite.type, role: invite.role, target_name: invite.target_name },
  });
});
