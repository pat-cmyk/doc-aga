// Shared Cloudflare Turnstile server-side verification helper.
//
// Progressive enforcement: if the TURNSTILE_SECRET secret is not configured,
// verification is skipped (ok: true) so existing flows keep working until the
// secret is set in Supabase / Lovable Cloud. Once configured, a missing or
// invalid token is rejected.
//
// Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileResult {
  ok: boolean;
  reason?: string;
}

export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  const secret = Deno.env.get("TURNSTILE_SECRET");

  // Not yet enforced — let the request through.
  if (!secret) return { ok: true, reason: "not_configured" };

  if (!token) return { ok: false, reason: "missing_token" };

  const form = new URLSearchParams();
  form.append("secret", secret);
  form.append("response", token);
  if (remoteIp) form.append("remoteip", remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data = await res.json();
    if (data.success) return { ok: true };
    return {
      ok: false,
      reason:
        (Array.isArray(data["error-codes"]) && data["error-codes"].join(",")) ||
        "verification_failed",
    };
  } catch (_e) {
    return { ok: false, reason: "verify_request_failed" };
  }
}
