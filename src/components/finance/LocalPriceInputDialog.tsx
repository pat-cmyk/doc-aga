import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, Info } from "lucide-react";
import { useAddLocalPrice, useCurrentMarketPrice, getSourceLabel } from "@/hooks/useMarketPrices";
import { format } from "date-fns";
import { VoiceInputButton } from "@/components/ui/voice-input-button";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface LocalPriceInputDialogProps {
  farmId: string;
  defaultLivestockType?: string;
  trigger?: React.ReactNode;
}

const LIVESTOCK_TYPES = [
  { value: "cattle", label: "Cattle (Baka)" },
  { value: "carabao", label: "Carabao (Kalabaw)" },
  { value: "goat", label: "Goat (Kambing)" },
  { value: "sheep", label: "Sheep (Tupa)" },
];

export function LocalPriceInputDialog({
  farmId,
  defaultLivestockType = "cattle",
  trigger,
}: LocalPriceInputDialogProps) {
  const [open, setOpen] = useState(false);
  const [livestockType, setLivestockType] = useState(defaultLivestockType);
  const [pricePerKg, setPricePerKg] = useState("");
  const [notes, setNotes] = useState("");
  const isOnline = useOnlineStatus();

  const { data: currentPrice } = useCurrentMarketPrice(farmId, livestockType);
  const addLocalPrice = useAddLocalPrice();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const price = parseFloat(pricePerKg);
    if (isNaN(price) || price <= 0) return;

    await addLocalPrice.mutateAsync({
      livestockType,
      pricePerKg: price,
      farmId,
      notes: notes || undefined,
    });

    setOpen(false);
    setPricePerKg("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Update Local Price
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>I-update ang Presyo sa Merkado</DialogTitle>
          <DialogDescription>
            Ilagay ang kasalukuyang presyo ng hayop sa inyong lugar para mas accurate ang valuation ng inyong kawan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="livestock-type">Uri ng Hayop</Label>
            <Select value={livestockType} onValueChange={setLivestockType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIVESTOCK_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Presyo per Kilo (₱)</Label>
            <Input
              id="price"
              type="number"
              placeholder="e.g., 320"
              value={pricePerKg}
              onChange={(e) => setPricePerKg(e.target.value)}
              min="1"
              step="1"
              required
            />
            {currentPrice && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Current: ₱{currentPrice.price.toFixed(0)}/kg ({getSourceLabel(currentPrice.source, "tl")}, {format(new Date(currentPrice.effective_date), "MMM d, yyyy")})
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <div className="flex gap-2">
              <Textarea
                id="notes"
                placeholder="e.g., Presyo sa palengke ng Lucena ngayong linggo"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="flex-1"
              />
              <VoiceInputButton
                onTranscription={(text) => setNotes(prev => prev ? `${prev} ${text}` : text)}
                disabled={!isOnline}
                className="self-start"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={addLocalPrice.isPending}>
              {addLocalPrice.isPending ? "Saving..." : "Save Price"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
