import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sprout } from "lucide-react";

interface Farm {
  id: string;
  name: string;
  logo_url: string | null;
}

interface FarmSwitcherProps {
  currentFarmId: string | null;
  onFarmChange: (farmId: string) => void;
}

export const FarmSwitcher = ({ currentFarmId, onFarmChange }: FarmSwitcherProps) => {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFarms();
  }, []);

  const loadFarms = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get owned farms
      const { data: ownedFarms } = await supabase
        .from("farms")
        .select("id, name, logo_url")
        .eq("owner_id", user.id)
        .eq("is_deleted", false)
        .order("name");

      // Get member farms
      const { data: memberships } = await supabase
        .from("farm_memberships")
        .select("farm_id, farms!inner(id, name, logo_url)")
        .eq("user_id", user.id)
        .eq("invitation_status", "accepted");

      const memberFarms = memberships?.map(m => ({
        id: (m.farms as any).id,
        name: (m.farms as any).name,
        logo_url: (m.farms as any).logo_url,
      })) || [];

      // Combine and deduplicate
      const allFarms = [...(ownedFarms || []), ...memberFarms];
      const uniqueFarms = Array.from(
        new Map(allFarms.map(f => [f.id, f])).values()
      );

      setFarms(uniqueFarms);
    } catch (error) {
      console.error("Error loading farms:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || farms.length <= 1) {
    return null;
  }

  return (
    <Select value={currentFarmId || undefined} onValueChange={onFarmChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select farm" />
      </SelectTrigger>
      <SelectContent>
        {farms.map((farm) => (
          <SelectItem key={farm.id} value={farm.id}>
            <div className="flex items-center gap-2">
              {farm.logo_url ? (
                <img src={farm.logo_url} alt="" className="h-4 w-4 rounded-full object-cover" />
              ) : (
                <Sprout className="h-4 w-4" />
              )}
              <span>{farm.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
