import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { showErrorToastLegacy } from "@/lib/errorHandling";
import { useCooperativeMemberFarms } from "@/hooks/useCooperative";
import { useCoopFeedInventory } from "@/hooks/useCoopFeedInventory";
import { useAddCoopFeedDisbursement } from "@/hooks/useCoopFeedDisbursement";
import { Loader2, Truck } from "lucide-react";

interface Props {
  cooperativeId: string;
}

export const RecordFeedDisbursementDialog = ({ cooperativeId }: Props) => {
  const [open, setOpen] = useState(false);
  const [farmId, setFarmId] = useState("");
  const [feedInventoryId, setFeedInventoryId] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [notes, setNotes] = useState("");

  const { toast } = useToast();
  const { data: memberFarms } = useCooperativeMemberFarms(cooperativeId);
  const { data: feedInventory } = useCoopFeedInventory(cooperativeId);
  const addDisbursement = useAddCoopFeedDisbursement();

  const acceptedFarms = memberFarms?.filter((f: any) => f.invitation_status === "accepted") || [];
  const selectedFeed = feedInventory?.find((f) => f.id === feedInventoryId);
  const totalCost = quantityKg && selectedFeed
    ? (parseFloat(quantityKg) * selectedFeed.cost_per_kg).toFixed(2)
    : "0.00";

  const resetForm = () => {
    setFarmId("");
    setFeedInventoryId("");
    setQuantityKg("");
    setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId || !feedInventoryId || !quantityKg) return;

    try {
      await addDisbursement.mutateAsync({
        cooperativeId,
        farmId,
        coopFeedInventoryId: feedInventoryId,
        quantityKg: parseFloat(quantityKg),
        notes: notes || undefined,
      });

      const farmName = acceptedFarms.find((f: any) => f.farm_id === farmId)?.farm_name || "farm";
      toast({
        title: "Feed Released",
        description: `${quantityKg}kg of ${selectedFeed?.feed_type} released to ${farmName} — ₱${totalCost}`,
      });

      resetForm();
      setOpen(false);
    } catch (error: any) {
      if (error.message?.includes("insufficient_stock")) {
        toast({
          title: "Insufficient Stock",
          description: "Not enough feed in hub inventory for this disbursement.",
          variant: "destructive",
        });
      } else if (error.message?.includes("farm_not_member")) {
        toast({
          title: "Farm Not a Member",
          description: "This farm is not an accepted member of the cooperative.",
          variant: "destructive",
        });
      } else {
        showErrorToastLegacy(toast, error, "recording feed disbursement");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Truck className="mr-2 h-4 w-4" />
          Record Release
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Feed Release</DialogTitle>
          <DialogDescription>
            Release feed from the hub to a member farm. This will deduct from hub inventory and add
            to the farm's feed inventory automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Member Farm</Label>
            <Select value={farmId} onValueChange={setFarmId}>
              <SelectTrigger>
                <SelectValue placeholder="Select farm" />
              </SelectTrigger>
              <SelectContent>
                {acceptedFarms.map((farm: any) => (
                  <SelectItem key={farm.farm_id} value={farm.farm_id}>
                    {farm.farm_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Feed Stock</Label>
            <Select value={feedInventoryId} onValueChange={setFeedInventoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select feed from hub inventory" />
              </SelectTrigger>
              <SelectContent>
                {feedInventory?.map((feed) => (
                  <SelectItem key={feed.id} value={feed.id}>
                    {feed.feed_type} ({feed.category}) — {feed.quantity_kg.toFixed(1)}kg @ ₱{feed.cost_per_kg.toFixed(2)}/kg
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedFeed && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p>Available: <span className="font-medium">{selectedFeed.quantity_kg.toFixed(1)} kg</span></p>
              <p>Cost: <span className="font-medium">₱{selectedFeed.cost_per_kg.toFixed(2)}/kg</span></p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity to Release (kg)</Label>
            <Input
              id="quantity"
              type="number"
              step="0.1"
              min="0.1"
              max={selectedFeed?.quantity_kg || undefined}
              placeholder="0.0"
              value={quantityKg}
              onChange={(e) => setQuantityKg(e.target.value)}
              required
            />
          </div>

          <div className="rounded-lg bg-muted p-3 text-center">
            <p className="text-sm text-muted-foreground">Total Cost (In-Kind Loan)</p>
            <p className="text-xl font-bold">₱{totalCost}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full" disabled={addDisbursement.isPending}>
            {addDisbursement.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Release Feed to Farm"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
