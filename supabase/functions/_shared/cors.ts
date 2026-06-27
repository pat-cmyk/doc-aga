// Shared CORS helper for all edge functions.
//
// Replaces the previous wildcard `Access-Control-Allow-Origin: *` with an
// env-configurable allowlist. The incoming request's Origin is echoed back only
// when it is on the allowlist; otherwise we fall back to the primary configured
// origin (which a disallowed browser origin will not match, so the browser
// blocks it — while server-to-server and Capacitor-native callers, which send no
// Origin and aren't subject to CORS, keep working).
//
// Configure via the ALLOWED_ORIGINS secret (comma-separated) in Supabase /
// Lovable Cloud, e.g.:
//   ALLOWED_ORIGINS=https://doc-aga.goldenforage.com,https://doc-aga.lovable.app
// If unset, the DEFAULT_ALLOWED_ORIGINS below are used so production keeps
// working out of the box.

const DEFAULT_ALLOWED_ORIGINS = [
  "https://doc-aga.goldenforage.com",
  "https://doc-aga.lovable.app",
  "http://localhost:8080", // vite dev
  "http://localhost:4173", // vite preview
];

// Default request headers we accept on the preflight. Individual functions can
// pass a wider set (e.g. the x-supabase-client-* headers) as the second arg.
export const DEFAULT_ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type";

function allowedOrigins(): string[] {
  const env = Deno.env.get("ALLOWED_ORIGINS");
  if (!env) return DEFAULT_ALLOWED_ORIGINS;
  return env.split(",").map((o) => o.trim()).filter(Boolean);
}

/**
 * Build CORS response headers for a given request, echoing the Origin only when
 * it is allowlisted. Call once per request inside the handler:
 *
 *   const corsHeaders = buildCorsHeaders(req);
 *   if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
 */
export function buildCorsHeaders(
  req: Request,
  allowHeaders: string = DEFAULT_ALLOW_HEADERS,
): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const list = allowedOrigins();

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };

  if (origin && list.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else if (list.length > 0) {
    headers["Access-Control-Allow-Origin"] = list[0];
  }

  return headers;
}
