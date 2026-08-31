/**
 * Android hardware back handling (UX redesign Phase 2).
 *
 * The pre-shell app had no Capacitor backButton listener at all, so the OS
 * default applied: back exited the app from anywhere. With URL-routed screens
 * the standard Android contract is now implementable:
 *   1. an open overlay (sheet/dialog registered via src/lib/backClose.ts) closes;
 *   2. a sub-page goes back through history (falling back to /home when the
 *      app was cold-started on a deep link);
 *   3. a root tab asks for a second press within 2s, then exits.
 *
 * Registered once in FarmShell.
 */
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { toast } from "sonner";
import { decideBackAction, popBackHandler, backHandlerCount } from "@/lib/backClose";
import { isRootTab } from "@/components/shell/routes";

const EXIT_CONFIRM_WINDOW_MS = 2000;

export function useAndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const lastExitPressRef = useRef(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle: PluginListenerHandle | undefined;
    let removed = false;

    CapacitorApp.addListener("backButton", () => {
      const historyState = window.history.state as { idx?: number } | null;
      const action = decideBackAction({
        hasOverlay: backHandlerCount() > 0,
        isRootTab: isRootTab(pathRef.current),
        historyIndex: typeof historyState?.idx === "number" ? historyState.idx : 0,
      });

      switch (action) {
        case "close-overlay":
          popBackHandler()?.();
          break;
        case "history-back":
          navigate(-1);
          break;
        case "go-home":
          navigate("/home", { replace: true });
          break;
        case "exit-confirm": {
          const now = Date.now();
          if (now - lastExitPressRef.current < EXIT_CONFIRM_WINDOW_MS) {
            CapacitorApp.exitApp();
          } else {
            lastExitPressRef.current = now;
            toast("Press back again to exit", {
              description: "Pindutin ulit para lumabas",
              duration: EXIT_CONFIRM_WINDOW_MS,
            });
          }
          break;
        }
      }
    }).then((h) => {
      if (removed) h.remove();
      else handle = h;
    });

    return () => {
      removed = true;
      handle?.remove();
    };
  }, [navigate]);
}
