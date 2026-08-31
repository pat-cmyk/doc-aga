/**
 * Register an overlay with the hardware-back stack (UX redesign Phase 4).
 *
 * While `open` is true, the Android back button closes this overlay instead
 * of navigating (see useAndroidBackButton + src/lib/backClose.ts). Overlays
 * stack LIFO, so nested sheets close innermost-first.
 */
import { useEffect, useRef } from "react";
import { registerBackHandler } from "@/lib/backClose";

export function useBackClose(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    return registerBackHandler(() => closeRef.current());
  }, [open]);
}
