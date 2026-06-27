import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile widget for public-facing forms (bot/abuse protection).
 *
 * Progressive enforcement: if VITE_TURNSTILE_SITE_KEY is not configured the
 * widget renders nothing and `isTurnstileEnabled` is false, so forms keep
 * working unchanged. Once the site key (and the server-side TURNSTILE_SECRET)
 * are set, the widget appears and callers should require a token before submit.
 */
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

export const isTurnstileEnabled = Boolean(SITE_KEY);

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as unknown as { turnstile?: unknown }).turnstile) {
    return Promise.resolve();
  }
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Turnstile script"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: Record<string, unknown>,
  ) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
}

interface TurnstileWidgetProps {
  /** Called with the verification token once the challenge is solved. */
  onVerify: (token: string) => void;
  /** Called when the token expires or errors — clear any stored token. */
  onExpire?: () => void;
  className?: string;
}

export function TurnstileWidget({
  onVerify,
  onExpire,
  className,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Keep latest callbacks without re-rendering the widget.
  const cbRef = useRef({ onVerify, onExpire });
  cbRef.current = { onVerify, onExpire };

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const turnstile = (window as unknown as { turnstile?: TurnstileApi })
          .turnstile;
        if (!turnstile || widgetIdRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (token: string) => cbRef.current.onVerify(token),
          "expired-callback": () => cbRef.current.onExpire?.(),
          "error-callback": () => cbRef.current.onExpire?.(),
        });
      })
      .catch(() => {
        // Script blocked/offline — fail open so the form is still usable.
      });

    return () => {
      cancelled = true;
      const turnstile = (window as unknown as { turnstile?: TurnstileApi })
        .turnstile;
      if (turnstile && widgetIdRef.current) {
        try {
          turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
      widgetIdRef.current = null;
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={containerRef} className={className} />;
}
