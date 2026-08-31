/**
 * /setup — first-farm creation (UX redesign Phase 2).
 *
 * The old Dashboard rendered FarmSetup inline with a visibility-change
 * re-check (the farm may have been created in another tab); both behaviors
 * move here as a real route.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import FarmSetup from "@/components/FarmSetup";
import { useFarm } from "@/contexts/FarmContext";

export default function SetupRoute() {
  const navigate = useNavigate();
  const { setFarmId, setFarmDetails } = useFarm();

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: ownedFarms } = await supabase
        .from("farms")
        .select("id, name, logo_url")
        .eq("owner_id", session.user.id)
        .eq("is_deleted", false)
        .limit(1);

      if (ownedFarms && ownedFarms.length > 0) {
        setFarmId(ownedFarms[0].id);
        setFarmDetails({
          name: ownedFarms[0].name || "My Farm",
          logoUrl: ownedFarms[0].logo_url || null,
          canManage: true,
        });
        navigate("/home", { replace: true });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [navigate, setFarmId, setFarmDetails]);

  return (
    <FarmSetup
      onFarmCreated={(farmId) => {
        setFarmId(farmId);
        navigate("/home", { replace: true });
      }}
    />
  );
}
