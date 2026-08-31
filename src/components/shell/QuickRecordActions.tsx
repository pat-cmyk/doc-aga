/**
 * One-tap record buttons for Home (UX redesign Phase 2, opener since Phase 4).
 *
 * The farmhand dashboard always had these; owners had to open the FAB first
 * (three taps for the highest-frequency user). Both roles get the same 1-tap
 * row, opening the shell's canonical bulk dialogs via useRecordingFlows().
 */
import { Droplets, Wheat, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecordingFlows } from "./RecordingFlowsProvider";

export function QuickRecordActions(_props: { farmId?: string }) {
  const { openBulkRecording } = useRecordingFlows();

  return (
    <div className="grid grid-cols-3 gap-2">
      <Button
        variant="outline"
        className="h-auto min-h-[64px] py-3 flex flex-col items-center gap-1.5"
        onClick={() => openBulkRecording("milk")}
      >
        <Droplets className="h-5 w-5 text-primary" />
        <span className="text-xs font-medium">Record Milk</span>
      </Button>
      <Button
        variant="outline"
        className="h-auto min-h-[64px] py-3 flex flex-col items-center gap-1.5"
        onClick={() => openBulkRecording("feed")}
      >
        <Wheat className="h-5 w-5 text-secondary" />
        <span className="text-xs font-medium">Record Feed</span>
      </Button>
      <Button
        variant="outline"
        className="h-auto min-h-[64px] py-3 flex flex-col items-center gap-1.5"
        onClick={() => openBulkRecording("health")}
      >
        <Heart className="h-5 w-5 text-destructive" />
        <span className="text-xs font-medium">Record Health</span>
      </Button>
    </div>
  );
}
