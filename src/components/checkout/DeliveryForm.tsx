import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface DeliveryFormProps {
  deliveryAddress: string;
  setDeliveryAddress: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
}

export const DeliveryForm = ({
  deliveryAddress,
  setDeliveryAddress,
  notes,
  setNotes,
}: DeliveryFormProps) => {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="address">Delivery Address *</Label>
        <Textarea
          id="address"
          placeholder="Enter your full delivery address..."
          value={deliveryAddress}
          onChange={(e) => setDeliveryAddress(e.target.value)}
          className="mt-2"
          rows={3}
        />
      </div>
      
      <div>
        <Label htmlFor="notes">Order Notes (Optional)</Label>
        <Textarea
          id="notes"
          placeholder="Any special instructions or requirements..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-2"
          rows={3}
        />
      </div>
    </div>
  );
};
