import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserInvitation {
  id: string;
  email: string;
  role: string;
  invitation_token: string;
  invitation_status: "pending" | "accepted" | "revoked" | "expired";
  invited_by: string | null;
  invited_at: string;
  token_expires_at: string;
  accepted_at: string | null;
  accepted_user_id: string | null;
}

export const USER_INVITATIONS_QUERY_KEY = ["user-invitations"] as const;

/**
 * Super admin-only list of user invitations.
 * Online-only (Category B per CLAUDE.md) — RLS gates to super admins.
 */
export function useUserInvitations() {
  return useQuery<UserInvitation[]>({
    queryKey: USER_INVITATIONS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_invitations")
        .select("*")
        .order("invited_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as UserInvitation[];
    },
    staleTime: 30_000,
  });
}

export function useRevokeUserInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase.rpc("admin_revoke_user_invitation", {
        _invitation_id: invitationId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_INVITATIONS_QUERY_KEY });
    },
  });
}

export function useResendUserInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke(
        "send-user-invitation",
        {
          body: {
            email,
            role,
            appUrl:
              typeof window !== "undefined" ? window.location.origin : undefined,
          },
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_INVITATIONS_QUERY_KEY });
    },
  });
}
