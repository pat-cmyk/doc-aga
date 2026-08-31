/**
 * Farm bootstrap (UX redesign Phase 2).
 *
 * Extraction of the session + role + farm resolution that used to live inside
 * pages/Dashboard.tsx (and, for farmhands, pages/FarmhandDashboard.tsx).
 * Shared by RoleLanding ("/") and FarmShell so both agree on where a user
 * belongs. Pure decision logic lives in src/lib/roleResolution.ts.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useFarm } from "@/contexts/FarmContext";
import { resolveRoleTarget, type RoleTarget } from "@/lib/roleResolution";

export interface FarmBootstrapState {
  loading: boolean;
  user: User | null;
  /** null while loading; "auth" when there is no session. */
  target: RoleTarget | "auth" | null;
  voiceTrainingCompleted: boolean;
}

export function useFarmBootstrap(): FarmBootstrapState {
  const { farmId, setFarmId, setFarmDetails } = useFarm();
  const [state, setState] = useState<FarmBootstrapState>({
    loading: true,
    user: null,
    target: null,
    voiceTrainingCompleted: false,
  });

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session) {
        setState({ loading: false, user: null, target: "auth", voiceTrainingCompleted: false });
        return;
      }

      // SSOT: a farmId already in context (e.g. set by invite acceptance or a
      // previous visit via localStorage) is trusted — same rule the old
      // Dashboard applied to avoid races after invitation flows.
      if (farmId) {
        setState({
          loading: false,
          user: session.user,
          target: "farmer",
          voiceTrainingCompleted: false,
        });
        return;
      }

      const [profileResult, rolesResult, ownedFarmsResult, memberFarmsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("voice_training_completed")
          .eq("id", session.user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", session.user.id),
        supabase
          .from("farms")
          .select("id, name, logo_url")
          .eq("owner_id", session.user.id)
          .eq("is_deleted", false)
          .limit(1),
        supabase
          .from("farm_memberships")
          .select("farm_id, role_in_farm")
          .eq("user_id", session.user.id)
          .eq("invitation_status", "accepted")
          .limit(1),
      ]);
      if (cancelled) return;

      const userRoles = rolesResult.data?.map((r) => r.role) || [];
      const ownedFarm = ownedFarmsResult.data?.[0] ?? null;
      const membership = memberFarmsResult.data?.[0] ?? null;

      const target = resolveRoleTarget({
        userRoles,
        ownsFarm: !!ownedFarm,
        membershipRole: membership?.role_in_farm ?? null,
        hasMembership: !!membership,
      });

      // Seed farm context for shell targets so every route has farm state.
      if (target === "farmer" || target === "farmhand") {
        if (ownedFarm) {
          setFarmId(ownedFarm.id);
          setFarmDetails({
            name: ownedFarm.name || "My Farm",
            logoUrl: ownedFarm.logo_url || null,
            canManage: true,
          });
        } else if (membership) {
          setFarmId(membership.farm_id);
          const { data: farmData } = await supabase
            .from("farms")
            .select("name, logo_url")
            .eq("id", membership.farm_id)
            .single();
          if (!cancelled && farmData) {
            setFarmDetails({
              name: farmData.name || "My Farm",
              logoUrl: farmData.logo_url || null,
              canManage: userRoles.includes("farmer_owner"),
            });
          }
        }
      }
      if (cancelled) return;

      setState({
        loading: false,
        user: session.user,
        target,
        voiceTrainingCompleted: profileResult.data?.voice_training_completed || false,
      });
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setState({ loading: false, user: null, target: "auth", voiceTrainingCompleted: false });
      } else {
        setState((prev) => ({ ...prev, user: session.user }));
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [farmId, setFarmId, setFarmDetails]);

  return state;
}
