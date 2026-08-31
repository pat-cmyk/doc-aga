/**
 * Floating widget host for the farm shell (UX redesign Phase 2).
 *
 * Groups the floating layer in one place instead of App.tsx's route-based
 * conditional. The pulsing FloatingVoiceTrainingButton is intentionally NOT
 * here — it became a dismissible card on Home (VoiceTrainingCard). Phase 4
 * consolidates positioning/stacking further.
 */
import { UnifiedActionsFab } from "@/components/UnifiedActionsFab";
import { QueueStatus } from "@/components/QueueStatus";
import { SyncConflictResolution } from "@/components/sync";

export function FloatingDock() {
  return (
    <>
      <UnifiedActionsFab />
      <QueueStatus />
      <SyncConflictResolution />
    </>
  );
}
