import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useFarm } from "@/contexts/FarmContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// State machine for invitation flow
type InviteStatus = 
  | 'checking'   // Fetching invitation + auth state
  | 'ready'      // Invitation valid, waiting for user action
  | 'joining'    // RPC in progress
  | 'verifying'  // Post-accept verification
  | 'success'    // Joined successfully, redirecting
  | 'error';     // Something went wrong

interface InvitationData {
  farm_id: string;
  farm_name: string;
  inviter_name: string;
  invited_email: string;
  role_in_farm: string;
  token_expires_at: string;
}

interface AcceptResult {
  success: boolean;
  error_code?: string;
  farm_id?: string;
  farm_name?: string;
}

const JOIN_TIMEOUT_MS = 20000; // 20 seconds before showing retry

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setFarmId, setFarmDetails } = useFarm();
  
  // State machine
  const [status, setStatus] = useState<InviteStatus>('checking');
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [showTimeout, setShowTimeout] = useState(false);

  // Check auth and fetch invitation on mount
  useEffect(() => {
    checkAuthAndInvitation();
  }, [token]);

  const checkAuthAndInvitation = async () => {
    console.log('[InviteAccept] Starting check, token:', token ? 'present' : 'missing');
    setStatus('checking');
    setError(null);
    setShowTimeout(false);

    try {
      // Check if user is logged in
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      console.log('[InviteAccept] User:', currentUser?.email || 'not logged in');

      // Fetch invitation details using secure RPC
      const { data: inviteData, error: inviteError } = await supabase
        .rpc("get_farm_invitation_public", { p_token: token });

      if (inviteError) {
        console.error("[InviteAccept] Error fetching invitation:", inviteError);
        setError("Something went wrong. Please try again.");
        setStatus('error');
        return;
      }

      if (!inviteData || inviteData.length === 0) {
        console.log('[InviteAccept] Invalid or expired invitation');
        setError("Invalid or expired invitation link.");
        setStatus('error');
        return;
      }

      const inviteInfo = inviteData[0] as InvitationData;
      console.log('[InviteAccept] Invitation for:', inviteInfo.farm_name);
      setInvitation(inviteInfo);
      setStatus('ready');
    } catch (err) {
      console.error("[InviteAccept] Error:", err);
      setError("Something went wrong. Please try again.");
      setStatus('error');
    }
  };

  const acceptInvitation = useCallback(async () => {
    if (!user) {
      // Redirect to auth with return URL and pre-fill email
      const returnUrl = encodeURIComponent(window.location.pathname);
      const inviteEmail = encodeURIComponent(invitation?.invited_email || '');
      navigate(`/auth?redirect=${returnUrl}&email=${inviteEmail}`);
      return;
    }

    console.log('[InviteAccept] Starting accept RPC');
    setStatus('joining');
    setShowTimeout(false);

    // Start timeout timer
    const timeoutId = setTimeout(() => {
      setShowTimeout(true);
    }, JOIN_TIMEOUT_MS);

    try {
      const { data, error: rpcError } = await supabase
        .rpc("accept_farm_invitation", { p_token: token });

      clearTimeout(timeoutId);
      console.log('[InviteAccept] RPC result:', data, rpcError);

      if (rpcError) {
        console.error("[InviteAccept] RPC error:", rpcError);
        throw new Error("Failed to accept invitation");
      }

      const result = data?.[0] as AcceptResult | undefined;

      if (!result?.success) {
        const errorCode = result?.error_code || "";
        console.log('[InviteAccept] Accept failed with code:', errorCode);
        
        // Handle "already_used" - check if user actually has membership
        if (errorCode === 'already_used' && invitation) {
          const alreadyMember = await checkExistingMembership(invitation.farm_id);
          if (alreadyMember) {
            console.log('[InviteAccept] User already a member, treating as success');
            handleSuccess(invitation.farm_id, invitation.farm_name);
            return;
          }
        }

        const errorMessages: Record<string, string> = {
          not_authenticated: "Please sign in to accept this invitation.",
          invalid_token: "This invitation link is invalid.",
          already_used: "This invitation has already been used.",
          expired: "This invitation has expired.",
          email_mismatch: `This invitation was sent to ${invitation?.invited_email}. Please log in with that email address.`,
        };

        setError(errorMessages[errorCode] || "Failed to accept invitation. Please try again.");
        setStatus('error');
        return;
      }

      // Success - verify membership before redirect
      console.log('[InviteAccept] Accept succeeded, verifying...');
      setStatus('verifying');
      
      await verifyAndRedirect(result.farm_id!, result.farm_name || invitation?.farm_name || 'My Farm');
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("[InviteAccept] Error accepting invitation:", err);
      setError("Failed to accept invitation. Please try again.");
      setStatus('error');
    }
  }, [user, token, invitation, navigate]);

  const checkExistingMembership = async (farmId: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from('farm_memberships')
        .select('id')
        .eq('user_id', user?.id)
        .eq('farm_id', farmId)
        .eq('invitation_status', 'accepted')
        .maybeSingle();
      return !!data;
    } catch {
      return false;
    }
  };

  const verifyAndRedirect = async (farmId: string, farmName: string) => {
    // Quick verification that membership is visible
    let attempts = 0;
    const maxAttempts = 3;
    const delayMs = 500;

    while (attempts < maxAttempts) {
      const { data: membership } = await supabase
        .from('farm_memberships')
        .select('id, role_in_farm')
        .eq('user_id', user?.id)
        .eq('farm_id', farmId)
        .eq('invitation_status', 'accepted')
        .maybeSingle();

      if (membership) {
        console.log('[InviteAccept] Membership verified, redirecting...');
        handleSuccess(farmId, farmName, membership.role_in_farm);
        return;
      }

      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Even if verification fails, proceed with redirect (context is set)
    console.log('[InviteAccept] Verification timeout, proceeding anyway');
    handleSuccess(farmId, farmName);
  };

  const handleSuccess = (farmId: string, farmName: string, role?: string) => {
    setStatus('success');
    
    // Set farm context immediately (SSOT pattern)
    setFarmId(farmId);
    setFarmDetails({
      name: farmName,
      canManage: role === 'farmer_owner'
    });

    toast({
      title: "Welcome!",
      description: `You've joined ${farmName}!`,
    });

    // Role-based navigation
    const targetRole = role || invitation?.role_in_farm;
    if (targetRole === 'farmhand') {
      navigate("/farmhand");
    } else {
      navigate("/");
    }
  };

  const handleRetry = () => {
    if (status === 'error' && !invitation) {
      // Re-check invitation
      checkAuthAndInvitation();
    } else {
      // Retry accept
      acceptInvitation();
    }
  };

  // Email mismatch check
  const isEmailMismatch = user && invitation &&
    user.email?.toLowerCase() !== invitation.invited_email?.toLowerCase();

  // Render based on status
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

  if (status === 'joining' || status === 'verifying' || status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">
            {status === 'verifying' ? 'Almost there...' : 'Joining farm...'}
          </h1>
          <p className="text-muted-foreground">
            {status === 'verifying' 
              ? 'Confirming your membership' 
              : `Joining ${invitation?.farm_name || 'the farm'}`}
          </p>
          
          {showTimeout && status === 'joining' && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Taking longer than expected...</span>
              </div>
              <Button 
                variant="outline" 
                onClick={handleRetry}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">
            {invitation ? "Couldn't Join Farm" : "Invalid Invitation"}
          </h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <div className="flex flex-col gap-3">
            <Button onClick={handleRetry} className="gap-2">
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
  const roleName = invitation?.role_in_farm === "farmer_owner" ? "Farm Manager" : "Farm Hand";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-6">
        <CheckCircle className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-center mb-2">
          Farm Team Invitation
        </h1>
        <div className="space-y-4 mb-6">
          <p className="text-center text-muted-foreground">
            <strong>{invitation?.inviter_name || "Someone"}</strong> has invited you to join
          </p>
          <div className="bg-muted p-4 rounded-lg text-center">
            <h2 className="text-xl font-semibold">{invitation?.farm_name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              as a <strong>{roleName}</strong>
            </p>
          </div>
          
          {!user && (
            <p className="text-sm text-muted-foreground text-center">
              You'll need to sign in or create an account to accept this invitation.
            </p>
          )}

          {isEmailMismatch && (
            <div className="bg-destructive/10 border border-destructive/30 p-3 rounded-lg text-sm">
              <p className="text-destructive font-medium">Email Mismatch</p>
              <p className="text-muted-foreground mt-1">
                This invitation was sent to <strong>{invitation?.invited_email}</strong>,
                but you're signed in as <strong>{user?.email}</strong>.
              </p>
              <p className="text-muted-foreground mt-1">
                Please sign out and use the correct email, or contact the farm owner.
              </p>
            </div>
          )}
        </div>

        {isEmailMismatch ? (
          <Button
            onClick={async () => {
              await supabase.auth.signOut();
              const returnUrl = encodeURIComponent(window.location.pathname);
              const inviteEmail = encodeURIComponent(invitation?.invited_email || '');
              navigate(`/auth?redirect=${returnUrl}&email=${inviteEmail}`);
            }}
            className="w-full"
            size="lg"
            variant="outline"
          >
            Sign Out & Use Different Account
          </Button>
        ) : (
          <Button
            onClick={acceptInvitation}
            className="w-full"
            size="lg"
          >
            {user ? "Join Farm" : "Sign In to Join"}
          </Button>
        )}
      </Card>
    </div>
  );
}
