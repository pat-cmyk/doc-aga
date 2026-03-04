import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Package, Milk, ShoppingCart, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface MilkRecordSuccessScreenProps {
  open: boolean;
  onClose: () => void;
  totalLiters: number;
  animalCount: number;
  session: string;
  isRejected?: boolean;
  onAction: (action: "view_inventory" | "record_another" | "record_sale" | "done") => void;
}

export function MilkRecordSuccessScreen({
  open,
  onClose,
  totalLiters,
  animalCount,
  session,
  isRejected,
  onAction,
}: MilkRecordSuccessScreenProps) {
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-xl">
        <SheetHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-in zoom-in duration-300">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
          </div>

          <SheetTitle className="flex flex-col gap-0.5">
            <span className="text-xl text-primary">
              {isRejected ? "Rejected Milk Recorded" : "Milk Recorded!"}
            </span>
            <span className="text-sm text-muted-foreground font-normal">
              {isRejected ? "Naitala ang rejected na gatas" : "Naitala ang gatas"}
            </span>
          </SheetTitle>

          <div className="flex flex-col gap-0.5 mt-1">
            <span className="text-sm text-muted-foreground">
              {totalLiters}L ({session}) — {animalCount} animal{animalCount > 1 ? "s" : ""}
            </span>
          </div>
        </SheetHeader>

        {/* Next Steps */}
        <div className="space-y-3">
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">What's next?</p>
            <p className="text-xs text-muted-foreground">Ano ang susunod?</p>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="default"
              size="lg"
              className="w-full justify-start gap-3 h-16"
              onClick={() => onAction("view_inventory")}
            >
              <Package className="h-5 w-5" />
              <div className="flex flex-col items-start gap-0.5">
                <span className="font-medium text-base">View Inventory</span>
                <span className="text-xs text-primary-foreground/80">Tingnan ang stock ng gatas</span>
              </div>
            </Button>

            {!isRejected && (
              <Button
                variant="outline"
                size="lg"
                className="w-full justify-start gap-3 h-16"
                onClick={() => onAction("record_sale")}
              >
                <ShoppingCart className="h-5 w-5" />
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-medium text-base">Record Sale</span>
                  <span className="text-xs text-muted-foreground">Magtala ng benta</span>
                </div>
              </Button>
            )}

            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start gap-3 h-16"
              onClick={() => onAction("record_another")}
            >
              <Milk className="h-5 w-5" />
              <div className="flex flex-col items-start gap-0.5">
                <span className="font-medium text-base">Record Another</span>
                <span className="text-xs text-muted-foreground">Mag-record ulit</span>
              </div>
            </Button>
          </div>

          <Button
            variant="ghost"
            className="w-full text-muted-foreground mt-2 h-12"
            onClick={() => onAction("done")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-sm">Done</span>
              <span className="text-xs">Tapos na</span>
            </div>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
