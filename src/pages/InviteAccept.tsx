import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InvitationData {
  farm_id: string;
  farm_name: string;
  inviter_name: string;
  invited_email: string;
  role_in_farm: string;
  token_expires_at: string;
}

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuthAndInvitation();
  }, [token]);

  const checkAuthAndInvitation = async () => {
    try {
      // Check if user is logged in
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      setUser(currentUser);

      // Fetch invitation details using secure RPC
      const { data: inviteData, error: inviteError } = await supabase
        .rpc("get_farm_invitation_public", { p_token: token });

      if (inviteError) {
        console.error("Error fetching invitation:", inviteError);
        setError("Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      if (!inviteData || inviteData.length === 0) {
        setError("Invalid or expired invitation link.");
        setLoading(false);
        return;
      }

      setInvitation(inviteData[0] as InvitationData);
      setLoading(false);
    } catch (err) {
      console.error("Error checking invitation:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const acceptInvitation = async () => {
    if (!user) {
      // Redirect to auth with return URL
      const returnUrl = encodeURIComponent(window.location.pathname);
      navigate(`/auth?redirect=${returnUrl}`);
      return;
    }

    setAccepting(true);
    try {
      const { data, error: rpcError } = await supabase
        .rpc("accept_farm_invitation", { p_token: token });

      if (rpcError) {
        console.error("RPC error:", rpcError);
        throw new Error("Failed to accept invitation");
      }

      const result = data?.[0];
      
      if (!result?.success) {
        const errorMessages: Record<string, string> = {
          not_authenticated: "Please sign in to accept this invitation.",
          invalid_token: "This invitation link is invalid.",
          already_used: "This invitation has already been used.",
          expired: "This invitation has expired.",
          email_mismatch: `This invitation was sent to ${invitation?.invited_email}. Please log in with that email address.`,
        };
        
        toast({
          title: "Cannot Accept Invitation",
          description: errorMessages[result?.error_code || ""] || "Failed to accept invitation. Please try again.",
          variant: "destructive",
        });
        setAccepting(false);
        return;
      }

      toast({
        title: "Success!",
        description: `You've joined ${result.farm_name}!`,
      });

      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    } catch (err) {
      console.error("Error accepting invitation:", err);
      toast({
        title: "Error",
        description: "Failed to accept invitation. Please try again.",
        variant: "destructive",
      });
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Invalid Invitation</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => navigate("/")}>Go to Home</Button>
        </Card>
      </div>
    );
  }

  const roleName =
    invitation?.role_in_farm === "farmer_owner" ? "Farm Manager" : "Farm Hand";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-6">
        <CheckCircle className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-center mb-2">
          Farm Team Invitation
        </h1>
        <div className="space-y-4 mb-6">
          <p className="text-center text-muted-foreground">
            <strong>{invitation?.inviter_name || "Someone"}</strong> has
            invited you to join
          </p>
          <div className="bg-muted p-4 rounded-lg text-center">
            <h2 className="text-xl font-semibold">{invitation?.farm_name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              as a <strong>{roleName}</strong>
            </p>
          </div>
          {!user && (
            <p className="text-sm text-muted-foreground text-center">
              You'll need to sign in or create an account to accept this
              invitation.
            </p>
          )}
        </div>
        <Button 
          onClick={acceptInvitation} 
          className="w-full" 
          size="lg"
          disabled={accepting}
        >
          {accepting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Accepting...
            </>
          ) : user ? (
            "Accept Invitation"
          ) : (
            "Sign In to Accept"
          )}
        </Button>
      </Card>
    </div>
  );
}
