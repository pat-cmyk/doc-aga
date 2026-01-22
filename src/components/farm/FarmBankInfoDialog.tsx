import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Shield } from "lucide-react";

interface FarmBankInfoDialogProps {
  farmId: string;
  trigger?: React.ReactNode;
  onSaveSuccess?: () => void;
}

const BIOSECURITY_OPTIONS = [
  { value: "basic", label: "Basic (Fencing/Enclosure only)" },
  { value: "standard", label: "Standard (Footbath, Quarantine Area)" },
  { value: "advanced", label: "Advanced (Full Protocol, Visitor Log)" },
];

const WATER_SOURCE_OPTIONS = [
  { value: "deep_well", label: "Deep Well" },
  { value: "spring", label: "Natural Spring" },
  { value: "municipal", label: "Municipal/Tap Water" },
  { value: "rainwater", label: "Rainwater Collection" },
  { value: "river", label: "River/Stream" },
];

export function FarmBankInfoDialog({ farmId, trigger, onSaveSuccess }: FarmBankInfoDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const [biosecurityLevel, setBiosecurityLevel] = useState<string>("");
  const [waterSource, setWaterSource] = useState<string>("");
  const [distanceToMarket, setDistanceToMarket] = useState<string>("");
  const [pcicEnrolled, setPcicEnrolled] = useState(false);

  useEffect(() => {
    if (open && farmId) {
      loadFarmData();
    }
  }, [open, farmId]);

  const loadFarmData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("farms")
        .select("biosecurity_level, water_source, distance_to_market_km, pcic_enrolled")
        .eq("id", farmId)
        .single();

      if (error) throw error;

      if (data) {
        setBiosecurityLevel(data.biosecurity_level || "");
        setWaterSource(data.water_source || "");
        setDistanceToMarket(data.distance_to_market_km?.toString() || "");
        setPcicEnrolled(data.pcic_enrolled || false);
      }
    } catch (error) {
      console.error("Error loading farm data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("farms")
        .update({
          biosecurity_level: biosecurityLevel || null,
          water_source: waterSource || null,
          distance_to_market_km: distanceToMarket ? parseFloat(distanceToMarket) : null,
          pcic_enrolled: pcicEnrolled,
        })
        .eq("id", farmId);

      if (error) throw error;

      toast.success("Bank information updated successfully");
      queryClient.invalidateQueries({ queryKey: ["data-completeness", farmId] });
      queryClient.invalidateQueries({ queryKey: ["financial-report", farmId] });
      setOpen(false);
      onSaveSuccess?.();
    } catch (error) {
      console.error("Error saving farm data:", error);
      toast.error("Failed to update bank information");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Shield className="h-4 w-4 mr-2" />
            Edit Bank Info
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bank Requirements</DialogTitle>
          <DialogDescription>
            Complete these fields for loan applications and financial reports
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="biosecurity">Biosecurity Level</Label>
              <Select value={biosecurityLevel} onValueChange={setBiosecurityLevel}>
                <SelectTrigger id="biosecurity">
                  <SelectValue placeholder="Select biosecurity level" />
                </SelectTrigger>
                <SelectContent>
                  {BIOSECURITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="water">Water Source</Label>
              <Select value={waterSource} onValueChange={setWaterSource}>
                <SelectTrigger id="water">
                  <SelectValue placeholder="Select water source" />
                </SelectTrigger>
                <SelectContent>
                  {WATER_SOURCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="distance">Distance to Market (km)</Label>
              <Input
                id="distance"
                type="number"
                min="0"
                step="0.1"
                placeholder="e.g., 5.5"
                value={distanceToMarket}
                onChange={(e) => setDistanceToMarket(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Nearest livestock market or buyer
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="pcic" className="text-base">
                  PCIC Insurance
                </Label>
                <p className="text-xs text-muted-foreground">
                  Enrolled in PCIC livestock insurance program
                </p>
              </div>
              <Switch
                id="pcic"
                checked={pcicEnrolled}
                onCheckedChange={setPcicEnrolled}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function getBiosecurityLabel(value: string | null | undefined): string {
  if (!value) return "Not set";
  return BIOSECURITY_OPTIONS.find((o) => o.value === value)?.label || value;
}

export function getWaterSourceLabel(value: string | null | undefined): string {
  if (!value) return "Not set";
  return WATER_SOURCE_OPTIONS.find((o) => o.value === value)?.label || value;
}
