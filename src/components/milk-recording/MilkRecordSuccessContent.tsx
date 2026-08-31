/**
 * In-dialog milk success state (UX redesign Phase 4).
 *
 * Replaces MilkRecordSuccessScreen — a Sheet that opened as the recording
 * Dialog closed (modal-over-modal). The recording dialog now swaps to this
 * content in place; navigation goes through the router.
 */
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, CloudOff, Package, Milk, ArrowLeft } from "lucide-react";

interface MilkRecordSuccessContentProps {
  totalLiters: number;
  animalCount: number;
  session: string;
  isRejected?: boolean;
  /** Saved to the offline queue — will sync automatically. */
  isQueued?: boolean;
  onRecordAnother: () => void;
  onViewInventory: () => void;
  onDone: () => void;
}

export function MilkRecordSuccessContent({
  totalLiters,
  animalCount,
  session,
  isRejected,
  isQueued,
  onRecordAnother,
  onViewInventory,
  onDone,
}: MilkRecordSuccessContentProps) {
  return (
    <div className="flex flex-col">
      <DialogHeader className="text-center pb-4 sm:text-center">
        <div className="flex justify-center mb-3">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-in zoom-in duration-300">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
        </div>
        <DialogTitle className="flex flex-col gap-0.5 items-center">
          <span className="text-xl text-primary">
            {isRejected ? "Rejected Milk Recorded" : "Milk Recorded!"}
          </span>
          <span className="text-sm text-muted-foreground font-normal">
            {isRejected ? "Naitala ang rejected na gatas" : "Naitala ang gatas"}
          </span>
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          {totalLiters}L ({session}) — {animalCount} animal{animalCount > 1 ? "s" : ""}
        </p>
        {isQueued && (
          <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-secondary">
            <CloudOff className="h-3.5 w-3.5" />
            Saved offline — syncs automatically / Nai-save offline
          </p>
        )}
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Button
          variant="default"
          size="lg"
          className="w-full justify-start gap-3 h-14"
          onClick={onViewInventory}
        >
          <Package className="h-5 w-5" />
          <div className="flex flex-col items-start gap-0.5">
            <span className="font-medium">View Inventory</span>
            <span className="text-xs text-primary-foreground/80">Tingnan ang stock ng gatas</span>
          </div>
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full justify-start gap-3 h-14"
          onClick={onRecordAnother}
        >
          <Milk className="h-5 w-5" />
          <div className="flex flex-col items-start gap-0.5">
            <span className="font-medium">Record Another</span>
            <span className="text-xs text-muted-foreground">Mag-record ulit</span>
          </div>
        </Button>
        <Button variant="ghost" className="w-full text-muted-foreground h-12" onClick={onDone}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Done / Tapos na
        </Button>
      </div>
    </div>
  );
}
