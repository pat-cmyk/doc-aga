import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type InviteLookup = {
  type: "farm" | "user" | "coop";
  status: "pending" | "accepted" | "revoked" | "expired" | "declined";
  email: string;
  role: string;
  role_label: string;
  inviter_name: string;
  inviter_email: string;
  target_name: string;
  invited_at: string;
  expires_at: string;
};

export function useInviteLookup(token: string | undefined) {
  return useQuery<InviteLookup | null>({
    queryKey: ["invite-lookup", token],
    enabled: !!token,
    staleTime: 0,
    queryFn: async () => {
      if (!token) return null;
      const { data, error } = await supabase.rpc("lookup_invitation", { p_token: token });
      if (error) throw error;
      if (!data || (Array.isArray(data) && data.length === 0)) return null;
      return (Array.isArray(data) ? data[0] : data) as InviteLookup;
    },
  });
}
