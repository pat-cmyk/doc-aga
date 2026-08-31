/**
 * CooperativeMembershipCard - Shows cooperative membership status on farmer dashboard
 *
 * Displays:
 * - Active cooperative membership (name + accepted date)
 * - Pending invitations with inline accept/decline buttons
 * - Uses existing RLS policy: farm owners can view own invitations by email match
 * - Uses existing RPCs: accept_cooperative_invitation / decline_cooperative_invitation
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Check, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function CooperativeMembershipCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  // Fetch cooperative memberships for current user's email (RLS handles filtering)
  const { data: memberships, isLoading } = useQuery({
    queryKey: ['farmer-cooperative-memberships'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cooperative_memberships')
        .select(`
          id,
          cooperative_id,
          invitation_status,
          invitation_token,
          invited_at,
          accepted_at,
          cooperatives (
            name
          )
        `)
        .in('invitation_status', ['pending', 'accepted'])
        .order('invited_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: isOnline,
  });

  const acceptMutation = useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc('accept_cooperative_invitation', {
        _token: token,
      });
      if (error) throw error;
      if (typeof data === 'string' && data.startsWith('error:')) {
        throw new Error(data.replace('error:', ''));
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmer-cooperative-memberships'] });
      toast({
        title: 'Sumali na sa Cooperative! / Joined Cooperative!',
        description: 'Your farm is now a cooperative member.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc('decline_cooperative_invitation', {
        _token: token,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmer-cooperative-memberships'] });
      toast({
        title: 'Invitation Declined',
        description: 'You have declined the cooperative invitation.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const { data, error } = await supabase.rpc('leave_cooperative', {
        _membership_id: membershipId,
      });
      if (error) throw error;
      if (typeof data === 'string' && data.startsWith('error:')) {
        throw new Error(data.replace('error:', ''));
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmer-cooperative-memberships'] });
      toast({
        title: 'Umalis sa Cooperative / Left Cooperative',
        description: 'Your farm has been removed from the cooperative.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const [confirmLeaveId, setConfirmLeaveId] = useState<string | null>(null);

  // Don't render if offline, loading, or no memberships
  if (!isOnline || isLoading || !memberships || memberships.length === 0) {
    return null;
  }

  const accepted = memberships.filter(m => m.invitation_status === 'accepted');
  const pending = memberships.filter(m => m.invitation_status === 'pending');

  if (accepted.length === 0 && pending.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Active Membership */}
      {accepted.map((m) => (
        <Card key={m.id} className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-500 h-8 w-8 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {(m.cooperatives as any)?.name || 'Cooperative'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Miyembro ng Cooperative / Cooperative Member
                </p>
              </div>
              <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                Active
              </Badge>
            </div>
            {confirmLeaveId === m.id ? (
              <div className="ml-11 mt-2 flex items-center gap-2">
                <p className="text-xs text-destructive flex-1">Sigurado ka bang aalis? / Are you sure?</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7"
                  onClick={() => setConfirmLeaveId(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="text-xs h-7"
                  disabled={leaveMutation.isPending}
                  onClick={() => {
                    leaveMutation.mutate(m.id);
                    setConfirmLeaveId(null);
                  }}
                >
                  {leaveMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Confirm Leave
                </Button>
              </div>
            ) : (
              <div className="ml-11 mt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-6 text-muted-foreground hover:text-destructive px-0"
                  onClick={() => setConfirmLeaveId(m.id)}
                >
                  Umalis sa cooperative / Leave cooperative
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Pending Invitations */}
      {pending.map((m) => (
        <Card key={m.id} className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-500 h-8 w-8 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {(m.cooperatives as any)?.name || 'Cooperative'} — Invitation
                </p>
                <p className="text-xs text-muted-foreground">
                  Imbitasyon mula sa cooperative / Invitation from cooperative
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-2 ml-11">
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                disabled={declineMutation.isPending || acceptMutation.isPending}
                onClick={() => declineMutation.mutate(m.invitation_token)}
              >
                {declineMutation.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <X className="h-3 w-3 mr-1" />
                )}
                Decline
              </Button>
              <Button
                size="sm"
                className="text-xs"
                disabled={acceptMutation.isPending || declineMutation.isPending}
                onClick={() => acceptMutation.mutate(m.invitation_token)}
              >
                {acceptMutation.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Check className="h-3 w-3 mr-1" />
                )}
                Accept / Tanggapin
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
