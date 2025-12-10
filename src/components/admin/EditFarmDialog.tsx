import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { PHILIPPINE_LOCATIONS } from "@/lib/philippineLocations";
import { Switch } from "@/components/ui/switch";

interface FarmData {
  id: string;
  name: string;
  region: string | null;
  province: string | null;
  municipality: string | null;
  gps_lat: number;
  gps_lng: number;
  livestock_type: string;
  ffedis_id: string | null;
  lgu_code: string | null;
  validation_status: string | null;
  is_program_participant: boolean | null;
  program_group: string | null;
}

interface EditFarmDialogProps {
  farm: FarmData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditFarmDialog = ({ farm, open, onOpenChange }: EditFarmDialogProps) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<FarmData>>({});
  const [reason, setReason] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");

  useEffect(() => {
    if (farm) {
      setFormData({
        name: farm.name,
        region: farm.region,
        province: farm.province,
        municipality: farm.municipality,
        gps_lat: farm.gps_lat,
        gps_lng: farm.gps_lng,
        livestock_type: farm.livestock_type,
        ffedis_id: farm.ffedis_id,
        lgu_code: farm.lgu_code,
        validation_status: farm.validation_status,
        is_program_participant: farm.is_program_participant,
        program_group: farm.program_group,
      });
    }
  }, [farm]);

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!farm) throw new Error("No farm selected");
      
      // Build changes object with only modified fields
      const changes: Record<string, unknown> = {};
      Object.keys(formData).forEach((key) => {
        const farmKey = key as keyof FarmData;
        if (formData[farmKey] !== farm[farmKey]) {
          changes[key] = formData[farmKey];
        }
      });

      if (Object.keys(changes).length === 0) {
        throw new Error("No changes made");
      }

      const { data, error } = await supabase.rpc("admin_edit_farm", {
        _farm_id: farm.id,
        _changes: changes as Json,
        _reason: reason,
        _ticket_number: ticketNumber || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-farms"] });
      toast({
        title: "Farm Updated",
        description: "Farm details have been updated successfully. Changes logged to audit trail.",
      });
      onOpenChange(false);
      setReason("");
      setTicketNumber("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const availableProvinces = formData.region
    ? PHILIPPINE_LOCATIONS[formData.region] || {}
    : {};

  const availableMunicipalities = formData.province
    ? availableProvinces[formData.province] || []
    : [];

  const handleRegionChange = (newRegion: string) => {
    setFormData((prev) => ({
      ...prev,
      region: newRegion,
      province: null,
      municipality: null,
    }));
  };

  const handleProvinceChange = (newProvince: string) => {
    setFormData((prev) => ({
      ...prev,
      province: newProvince,
      municipality: null,
    }));
  };

  if (!farm) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Farm Details</DialogTitle>
          <DialogDescription>
            Make changes to farm "{farm.name}". All changes are logged for audit purposes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Farm Name</Label>
              <Input
                id="name"
                value={formData.name || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="livestock_type">Livestock Type</Label>
              <Select
                value={formData.livestock_type || ""}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, livestock_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cattle">Cattle</SelectItem>
                  <SelectItem value="carabao">Carabao</SelectItem>
                  <SelectItem value="goat">Goat</SelectItem>
                  <SelectItem value="sheep">Sheep</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Select
                value={formData.region || ""}
                onValueChange={handleRegionChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(PHILIPPINE_LOCATIONS).map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="province">Province</Label>
              <Select
                value={formData.province || ""}
                onValueChange={handleProvinceChange}
                disabled={!formData.region}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select province" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(availableProvinces).map((province) => (
                    <SelectItem key={province} value={province}>
                      {province}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="municipality">Municipality</Label>
              <Select
                value={formData.municipality || ""}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, municipality: value }))}
                disabled={!formData.province}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select municipality" />
                </SelectTrigger>
                <SelectContent>
                  {availableMunicipalities.map((municipality) => (
                    <SelectItem key={municipality} value={municipality}>
                      {municipality}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gps_lat">GPS Latitude</Label>
              <Input
                id="gps_lat"
                type="number"
                step="0.000001"
                value={formData.gps_lat || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, gps_lat: parseFloat(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gps_lng">GPS Longitude</Label>
              <Input
                id="gps_lng"
                type="number"
                step="0.000001"
                value={formData.gps_lng || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, gps_lng: parseFloat(e.target.value) }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ffedis_id">FFEDIS ID</Label>
              <Input
                id="ffedis_id"
                value={formData.ffedis_id || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, ffedis_id: e.target.value }))}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lgu_code">LGU Code</Label>
              <Input
                id="lgu_code"
                value={formData.lgu_code || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, lgu_code: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="validation_status">Validation Status</Label>
              <Select
                value={formData.validation_status || ""}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, validation_status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="validated">Validated</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="program_group">Program Group</Label>
              <Input
                id="program_group"
                value={formData.program_group || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, program_group: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_program_participant"
              checked={formData.is_program_participant || false}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_program_participant: checked }))}
            />
            <Label htmlFor="is_program_participant">Program Participant</Label>
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason for Changes <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Customer requested name correction, GPS coordinates updated after field visit..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticket_number">Support Ticket Number (Optional)</Label>
              <Input
                id="ticket_number"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                placeholder="e.g., TICKET-2024-001"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => editMutation.mutate()}
            disabled={!reason.trim() || editMutation.isPending}
          >
            {editMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
