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
import { useSetCoopMilkPrice } from "@/hooks/useCoopPriceSchedule";
import { Loader2, Tag } from "lucide-react";
import { format } from "date-fns";

interface Props {
  cooperativeId: string;
}

const SPECIES_OPTIONS = [
  { value: "cattle", label: "Cattle" },
  { value: "goat", label: "Goat" },
  { value: "carabao", label: "Carabao" },
  { value: "sheep", label: "Sheep" },
];

export const SetMilkPriceDialog = ({ cooperativeId }: Props) => {
  const [open, setOpen] = useState(false);
  const [species, setSpecies] = useState("");
  const [price, setPrice] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const setMilkPrice = useSetCoopMilkPrice();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!species || !price) return;

    try {
      await setMilkPrice.mutateAsync({
        cooperativeId,
        species,
        pricePerLiter: parseFloat(price),
        effectiveDate,
        notes: notes || undefined,
      });

      toast({
        title: "Price Set",
        description: `${species} milk price set to ₱${parseFloat(price).toFixed(2)}/liter`,
      });

      setSpecies("");
      setPrice("");
      setNotes("");
      setOpen(false);
    } catch (error: any) {
      showErrorToastLegacy(toast, error, "setting milk price");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Tag className="mr-2 h-4 w-4" />
          Set Price
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Milk Price</DialogTitle>
          <DialogDescription>
            Set a new price per liter for a species. Previous prices are preserved for audit trail.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Species</Label>
            <Select value={species} onValueChange={setSpecies}>
              <SelectTrigger>
                <SelectValue placeholder="Select species" />
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
            <Label htmlFor="price">Price per Liter (₱)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="effective-date">Effective Date</Label>
            <Input
              id="effective-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Reason for price change..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full" disabled={setMilkPrice.isPending}>
            {setMilkPrice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set Price"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
