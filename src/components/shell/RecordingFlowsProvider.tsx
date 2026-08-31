/**
 * Recording-flow opener (UX redesign Phase 4).
 *
 * SSOT for opening the bulk recording dialogs. Every entry point (FAB, Home
 * quick actions, onboarding checklist, dashboard alert widgets) calls
 * useRecordingFlows() and ONE dialog instance per type — hosted here, inside
 * the farm shell — opens. Replaces per-widget dialog copies and the old
 * 'open-fab-dialog' window CustomEvent.
 *
 * Single-animal dialogs (RecordSingleMilkDialog etc.) stay local to their
 * animal-scoped hosts: they need per-animal props and also serve the admin
 * drill-down, which lives outside this provider.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useFarm } from "@/contexts/FarmContext";
import { RecordBulkMilkDialog } from "@/components/milk-recording/RecordBulkMilkDialog";
import { RecordBulkFeedDialog } from "@/components/feed-recording/RecordBulkFeedDialog";
import { RecordBulkHealthDialog } from "@/components/health-recording/RecordBulkHealthDialog";
import { RecordBulkBCSDialog } from "@/components/body-condition/RecordBulkBCSDialog";

export type BulkRecordingType = "milk" | "feed" | "health" | "bcs";

interface RecordingFlowsApi {
  /** Open the canonical bulk recording dialog for a record type. */
  openBulkRecording: (type: BulkRecordingType) => void;
}

const RecordingFlowsContext = createContext<RecordingFlowsApi | null>(null);

export function useRecordingFlows(): RecordingFlowsApi {
  const ctx = useContext(RecordingFlowsContext);
  if (!ctx) {
    throw new Error("useRecordingFlows must be used inside the farm shell (RecordingFlowsProvider)");
  }
  return ctx;
}

export function RecordingFlowsProvider({ children }: { children: ReactNode }) {
  const { farmId } = useFarm();
  const [activeDialog, setActiveDialog] = useState<BulkRecordingType | null>(null);

  const api = useMemo<RecordingFlowsApi>(
    () => ({ openBulkRecording: (type) => setActiveDialog(type) }),
    [],
  );

  const openChangeFor = (type: BulkRecordingType) => (open: boolean) =>
    setActiveDialog(open ? type : null);

  return (
    <RecordingFlowsContext.Provider value={api}>
      {children}
      {farmId && (
        <>
          <RecordBulkMilkDialog
            open={activeDialog === "milk"}
            onOpenChange={openChangeFor("milk")}
            farmId={farmId}
          />
          <RecordBulkFeedDialog
            open={activeDialog === "feed"}
            onOpenChange={openChangeFor("feed")}
            farmId={farmId}
          />
          <RecordBulkHealthDialog
            open={activeDialog === "health"}
            onOpenChange={openChangeFor("health")}
            farmId={farmId}
          />
          <RecordBulkBCSDialog
            open={activeDialog === "bcs"}
            onOpenChange={openChangeFor("bcs")}
            farmId={farmId}
          />
        </>
      )}
    </RecordingFlowsContext.Provider>
  );
}
