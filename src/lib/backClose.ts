/**
 * Hardware-back dismissal registry (UX redesign Phase 2).
 *
 * Overlays (sheets, dialogs, the Doc Aga chat) register a close handler while
 * open; the Android back button closes the top-most overlay before it
 * navigates. Module-level on purpose — the Capacitor listener lives outside
 * React's render cycle and only ever needs the top of the stack.
 */
type BackHandler = () => void;

const stack: BackHandler[] = [];

/** Register a close handler; returns an unregister function. */
export function registerBackHandler(handler: BackHandler): () => void {
  stack.push(handler);
  return () => {
    const idx = stack.lastIndexOf(handler);
    if (idx !== -1) stack.splice(idx, 1);
  };
}

/** Pop and return the top-most handler, or null when nothing is open. */
export function popBackHandler(): BackHandler | null {
  return stack.pop() ?? null;
}

/** Test hook: number of registered handlers. */
export function backHandlerCount(): number {
  return stack.length;
}

export type BackAction = "close-overlay" | "exit-confirm" | "history-back" | "go-home";

/**
 * Pure decision for a hardware back press:
 * 1. an open overlay closes first;
 * 2. a root tab asks for the double-press exit confirmation;
 * 3. anywhere else goes back through history, falling back to /home when the
 *    app was cold-started on a deep link (nothing earlier in history).
 */
export function decideBackAction(input: {
  hasOverlay: boolean;
  isRootTab: boolean;
  historyIndex: number;
}): BackAction {
  if (input.hasOverlay) return "close-overlay";
  if (input.isRootTab) return "exit-confirm";
  if (input.historyIndex > 0) return "history-back";
  return "go-home";
}
