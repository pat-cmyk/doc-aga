import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, RefreshCw, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type InviteStatus = 'checking' | 'ready' | 'accepting' | 'success' | 'error';

export default function CooperativeInviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [status, setStatus] = useState<InviteStatus>('checking');
  const [cooperativeName, setCooperativeName] = useState<string>("");
  const [farmName, setFarmName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [user, setUser] = useState<any>(null);
  const [membershipId, setMembershipId] = useState<string>("");

  useEffect(() => {
    checkInvitation();
  }, [token]);

  const checkInvitation = async () => {
    setStatus('checking');
    setError("");

    try {
      // Check auth
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      if (!currentUser) {
        // Redirect to auth with return URL
        const returnUrl = encodeURIComponent(`/cooperative/invite/accept/${token}`);
        navigate(`/auth?redirect=${returnUrl}`);
        return;
      }

      // Find the membership by token
      const { data: membership, error: fetchError } = await supabase
        .from('cooperative_memberships')
        .select(`
          id,
          invitation_status,
          token_expires_at,
          cooperative_id,
          farm_id,
          cooperatives ( name ),
          farms!cooperative_memberships_farm_id_fkey ( name, owner_id )
        `)
        .eq('invitation_token', token!)
        .maybeSingle();

      if (fetchError || !membership) {
        setError("Invalid or expired invitation link.");
        setStatus('error');
        return;
      }

      // Check if already accepted/declined
      if (membership.invitation_status === 'accepted') {
        setError("This invitation has already been accepted.");
        setStatus('error');
        return;
      }

      if (membership.invitation_status === 'declined') {
        setError("This invitation was declined.");
        setStatus('error');
        return;
      }

      // Check expiry
      if (new Date(membership.token_expires_at) < new Date()) {
        setError("This invitation has expired.");
        setStatus('error');
        return;
      }

      // Check that the current user is the farm owner
      const farm = membership.farms as any;
      if (farm?.owner_id !== currentUser.id) {
        setError("Only the farm owner can accept cooperative invitations.");
        setStatus('error');
        return;
      }

      const coop = membership.cooperatives as any;
      setCooperativeName(coop?.name || "Unknown Cooperative");
      setFarmName(farm?.name || "Your Farm");
      setMembershipId(membership.id);
      setStatus('ready');
    } catch (err) {
      console.error("[CoopInviteAccept] Error:", err);
      setError("Something went wrong. Please try again.");
      setStatus('error');
    }
  };

  const handleAccept = useCallback(async () => {
    setStatus('accepting');
    try {
      const { error: updateError } = await supabase
        .from('cooperative_memberships')
        .update({
          invitation_status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', membershipId);

      if (updateError) throw updateError;

      setStatus('success');
      toast({
        title: "Invitation Accepted!",
        description: `${farmName} is now a member of ${cooperativeName}.`,
      });

      // Redirect to farm dashboard after a moment
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      console.error("[CoopInviteAccept] Accept error:", err);
      setError("Failed to accept invitation. Please try again.");
      setStatus('error');
    }
  }, [membershipId, farmName, cooperativeName, navigate, toast]);

  const handleDecline = useCallback(async () => {
    setStatus('accepting');
    try {
      const { error: updateError } = await supabase
        .from('cooperative_memberships')
        .update({ invitation_status: 'declined' })
        .eq('id', membershipId);

      if (updateError) throw updateError;

      toast({
        title: "Invitation Declined",
        description: `You declined the invitation from ${cooperativeName}.`,
      });

      navigate("/");
    } catch (err) {
      console.error("[CoopInviteAccept] Decline error:", err);
      setError("Failed to decline invitation. Please try again.");
      setStatus('error');
    }
  }, [membershipId, cooperativeName, navigate, toast]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Checking invitation...</p>
        </div>
      </div>
    );
  }

  if (status === 'accepting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Processing...</p>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <CheckCircle className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Welcome to {cooperativeName}!</h1>
          <p className="text-muted-foreground">Your farm is now part of the cooperative. Redirecting...</p>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Invitation Error</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <div className="flex flex-col gap-3">
            <Button onClick={checkInvitation} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Button variant="outline" onClick={() => navigate("/")}>
              Go to Home
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // status === 'ready'
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-6">
        <Users className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-center mb-2">Cooperative Invitation</h1>
        <div className="space-y-4 mb-6">
          <p className="text-center text-muted-foreground">
            Your farm has been invited to join a cooperative
          </p>
          <div className="bg-muted p-4 rounded-lg text-center space-y-1">
            <h2 className="text-xl font-semibold">{cooperativeName}</h2>
            <p className="text-sm text-muted-foreground">
              Farm: <strong>{farmName}</strong>
            </p>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            By accepting, the cooperative will be able to view aggregated data from your farm (read-only).
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleDecline}>
            Decline
          </Button>
          <Button className="flex-1" onClick={handleAccept}>
            Accept
          </Button>
        </div>
      </Card>
    </div>
  );
}
