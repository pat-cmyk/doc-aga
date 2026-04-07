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
import { useAddCoopFeedStock } from "@/hooks/useCoopFeedInventory";
import { Loader2, Plus } from "lucide-react";
import { format } from "date-fns";

interface Props {
  cooperativeId: string;
}

const CATEGORY_OPTIONS = [
  { value: "roughage", label: "Roughage (Hay, Silage, Grass)" },
  { value: "concentrates", label: "Concentrates (Grains, Pellets)" },
  { value: "minerals", label: "Minerals" },
  { value: "supplements", label: "Supplements" },
];

export const AddCoopFeedStockDialog = ({ cooperativeId }: Props) => {
  const [open, setOpen] = useState(false);
  const [feedType, setFeedType] = useState("");
  const [category, setCategory] = useState("roughage");
  const [quantityKg, setQuantityKg] = useState("");
  const [costPerKg, setCostPerKg] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [supplier, setSupplier] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");

  const { toast } = useToast();
  const addStock = useAddCoopFeedStock();

  const totalValue = quantityKg && costPerKg
    ? (parseFloat(quantityKg) * parseFloat(costPerKg)).toFixed(2)
    : "0.00";

  const resetForm = () => {
    setFeedType("");
    setCategory("roughage");
    setQuantityKg("");
    setCostPerKg("");
    setSupplier("");
    setBatchNumber("");
    setExpiryDate("");
    setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedType || !quantityKg || !costPerKg) return;

    try {
      await addStock.mutateAsync({
        cooperativeId,
        feedType,
        category,
        quantityKg: parseFloat(quantityKg),
        costPerKg: parseFloat(costPerKg),
        purchaseDate: purchaseDate || undefined,
        supplier: supplier || undefined,
        batchNumber: batchNumber || undefined,
        expiryDate: expiryDate || undefined,
        notes: notes || undefined,
      });

      toast({
        title: "Feed Stock Added",
        description: `${quantityKg}kg of ${feedType} added — ₱${totalValue}`,
      });

      resetForm();
      setOpen(false);
    } catch (error: any) {
      showErrorToastLegacy(toast, error, "adding feed stock");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Stock
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Feed Stock</DialogTitle>
          <DialogDescription>
            Add feed to the cooperative hub's inventory.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feed-type">Feed Type</Label>
            <Input
              id="feed-type"
              placeholder="e.g., Corn Silage, TMR Blend A, Dairy Concentrate"
              value={feedType}
              onChange={(e) => setFeedType(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity (kg)</Label>
              <Input
                id="quantity"
                type="number"
                step="0.1"
                min="0.1"
                placeholder="0.0"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Cost per kg (₱)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={costPerKg}
                onChange={(e) => setCostPerKg(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="rounded-lg bg-muted p-3 text-center">
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-xl font-bold">₱{totalValue}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Purchase Date</Label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier</Label>
            <Input
              id="supplier"
              placeholder="e.g., Corn Farmer Buyback, External Supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
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

          <Button type="submit" className="w-full" disabled={addStock.isPending}>
            {addStock.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Feed Stock"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
