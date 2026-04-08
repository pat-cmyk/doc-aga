import { useState, useEffect } from "react";
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
import { useAddCoopMilkReceiving } from "@/hooks/useCoopMilkCollection";
import { useActiveCoopPrice } from "@/hooks/useCoopPriceSchedule";
import { Loader2, Plus } from "lucide-react";
import { format } from "date-fns";

interface Props {
  cooperativeId: string;
}

const SESSION_OPTIONS = [
  { value: "AM", label: "AM (Morning)" },
  { value: "PM", label: "PM (Afternoon)" },
  { value: "Full Day", label: "Full Day" },
];

const SPECIES_OPTIONS = [
  { value: "cattle", label: "Cattle" },
  { value: "goat", label: "Goat" },
  { value: "carabao", label: "Carabao" },
  { value: "sheep", label: "Sheep" },
];

const QUALITY_OPTIONS = [
  { value: "good", label: "Good" },
  { value: "rejected", label: "Rejected" },
];

export const RecordMilkReceiptDialog = ({ cooperativeId }: Props) => {
  const [open, setOpen] = useState(false);
  const [farmId, setFarmId] = useState("");
  const [receivingDate, setReceivingDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [session, setSession] = useState("AM");
  const [volumeLiters, setVolumeLiters] = useState("");
  const [species, setSpecies] = useState("cattle");
  const [milkQuality, setMilkQuality] = useState("good");
  const [pricePerLiter, setPricePerLiter] = useState("");
  const [notes, setNotes] = useState("");

  const { toast } = useToast();
  const { data: memberFarms } = useCooperativeMemberFarms(cooperativeId);
  const addReceiving = useAddCoopMilkReceiving();

  // Auto-populate price from schedule when species changes
  const { data: activePrice } = useActiveCoopPrice(cooperativeId, species);
  useEffect(() => {
    if (activePrice !== null && activePrice !== undefined) {
      setPricePerLiter(activePrice.toString());
    }
  }, [activePrice]);

  const acceptedFarms = memberFarms?.filter((f: any) => f.invitation_status === "accepted") || [];
  const totalValue = volumeLiters && pricePerLiter
    ? (parseFloat(volumeLiters) * parseFloat(pricePerLiter)).toFixed(2)
    : "0.00";

  const resetForm = () => {
    setFarmId("");
    setVolumeLiters("");
    setSpecies("cattle");
    setMilkQuality("good");
    setPricePerLiter("");
    setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId || !volumeLiters || !pricePerLiter) return;

    try {
      await addReceiving.mutateAsync({
        cooperativeId,
        farmId,
        receivingDate,
        session,
        volumeLiters: parseFloat(volumeLiters),
        species,
        milkQuality,
        pricePerLiter: parseFloat(pricePerLiter),
        notes: notes || undefined,
      });

      toast({
        title: "Milk Receipt Recorded",
        description: `${volumeLiters}L received — ₱${totalValue}`,
      });

      resetForm();
      setOpen(false);
    } catch (error: any) {
      if (error.message?.includes("no_price_set")) {
        toast({
          title: "No Price Set",
          description: "Please set a milk price for this species first.",
          variant: "destructive",
        });
      } else if (error.message?.includes("farm_not_member")) {
        toast({
          title: "Farm Not a Member",
          description: "This farm is not an accepted member of the cooperative.",
          variant: "destructive",
        });
      } else {
        showErrorToastLegacy(toast, error, "recording milk receipt");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Record Receipt
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Milk Receipt</DialogTitle>
          <DialogDescription>
            Record milk delivered by a member farm to the cooperative hub.
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={receivingDate}
                onChange={(e) => setReceivingDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Session</Label>
              <Select value={session} onValueChange={setSession}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Species</Label>
              <Select value={species} onValueChange={setSpecies}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPECIES_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quality</Label>
              <Select value={milkQuality} onValueChange={setMilkQuality}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUALITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="volume">Volume (Liters)</Label>
              <Input
                id="volume"
                type="number"
                step="0.1"
                min="0.1"
                placeholder="0.0"
                value={volumeLiters}
                onChange={(e) => setVolumeLiters(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price/Liter (₱)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={pricePerLiter}
                onChange={(e) => setPricePerLiter(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Total Value Preview */}
          <div className="rounded-lg bg-muted p-3 text-center">
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-xl font-bold">₱{totalValue}</p>
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

          <Button type="submit" className="w-full" disabled={addReceiving.isPending}>
            {addReceiving.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Record Milk Receipt"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
