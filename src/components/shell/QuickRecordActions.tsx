/**
 * One-tap record buttons for Home (UX redesign Phase 2).
 *
 * The farmhand dashboard always had these; owners had to open the FAB first
 * (three taps for the highest-frequency user). Now both roles get the same
 * 1-tap row on Home, reusing the existing bulk recording dialogs.
 */
import { useState } from "react";
import { Droplets, Wheat, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecordBulkMilkDialog } from "@/components/milk-recording/RecordBulkMilkDialog";
import { RecordBulkFeedDialog } from "@/components/feed-recording/RecordBulkFeedDialog";
import { RecordBulkHealthDialog } from "@/components/health-recording/RecordBulkHealthDialog";

interface QuickRecordActionsProps {
  farmId: string;
}

export function QuickRecordActions({ farmId }: QuickRecordActionsProps) {
  const [isMilkOpen, setIsMilkOpen] = useState(false);
  const [isFeedOpen, setIsFeedOpen] = useState(false);
  const [isHealthOpen, setIsHealthOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          className="h-auto min-h-[64px] py-3 flex flex-col items-center gap-1.5"
          onClick={() => setIsMilkOpen(true)}
        >
          <Droplets className="h-5 w-5 text-primary" />
          <span className="text-xs font-medium">Record Milk</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto min-h-[64px] py-3 flex flex-col items-center gap-1.5"
          onClick={() => setIsFeedOpen(true)}
        >
          <Wheat className="h-5 w-5 text-secondary" />
          <span className="text-xs font-medium">Record Feed</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto min-h-[64px] py-3 flex flex-col items-center gap-1.5"
          onClick={() => setIsHealthOpen(true)}
        >
          <Heart className="h-5 w-5 text-destructive" />
          <span className="text-xs font-medium">Record Health</span>
        </Button>
      </div>

      <RecordBulkMilkDialog open={isMilkOpen} onOpenChange={setIsMilkOpen} farmId={farmId} />
      <RecordBulkFeedDialog open={isFeedOpen} onOpenChange={setIsFeedOpen} farmId={farmId} />
      <RecordBulkHealthDialog open={isHealthOpen} onOpenChange={setIsHealthOpen} farmId={farmId} />
    </>
  );
}
