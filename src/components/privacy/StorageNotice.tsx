import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "docaga_storage_notice_ack";

/**
 * One-time, dismissible notice that the offline-first app stores data on the
 * device (IndexedDB/localStorage). Lightweight transparency for the privacy
 * checklist — not a tracking-cookie consent gate (we set no advertising cookies).
 */
export function StorageNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // localStorage unavailable (private mode / SSR) — just don't show it.
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="On-device storage notice"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4 pb-safe"
    >
      <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card shadow-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm text-muted-foreground flex-1">
          Doc Aga stores data on your device (offline cache &amp; preferences) so it
          works without internet. Learn more in our{" "}
          <Link to="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <Button size="sm" onClick={dismiss} className="shrink-0 self-end sm:self-auto">
          Got it
        </Button>
      </div>
    </div>
  );
}
