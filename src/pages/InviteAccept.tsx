import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
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

      // Fetch invitation details
      const { data: inviteData, error: inviteError } = await supabase
        .from("farm_memberships")
        .select(
          `
          *,
          farms (name),
          profiles!farm_memberships_invited_by_fkey (full_name)
        `
        )
        .eq("invitation_token", token)
        .eq("invitation_status", "pending")
        .single();

      if (inviteError || !inviteData) {
        setError("Invalid or expired invitation link.");
        setLoading(false);
        return;
      }

      // Check if invitation is expired
      const expiresAt = new Date(inviteData.token_expires_at);
      if (expiresAt < new Date()) {
        setError("This invitation has expired.");
        setLoading(false);
        return;
      }

      setInvitation(inviteData);
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

    if (user.email !== invitation.invited_email) {
      toast({
        title: "Email Mismatch",
        description: `This invitation was sent to ${invitation.invited_email}. Please log in with that email address.`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from("farm_memberships")
        .update({
          user_id: user.id,
          invitation_status: "accepted",
        })
        .eq("invitation_token", token);

      if (updateError) throw updateError;

      toast({
        title: "Success!",
        description: `You've joined ${invitation.farms.name}!`,
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
      setLoading(false);
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
    invitation.role_in_farm === "farmer_owner" ? "Farm Manager" : "Farm Hand";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-6">
        <CheckCircle className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-center mb-2">
          Farm Team Invitation
        </h1>
        <div className="space-y-4 mb-6">
          <p className="text-center text-muted-foreground">
            <strong>{invitation.profiles?.full_name || "Someone"}</strong> has
            invited you to join
          </p>
          <div className="bg-muted p-4 rounded-lg text-center">
            <h2 className="text-xl font-semibold">{invitation.farms.name}</h2>
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
        <Button onClick={acceptInvitation} className="w-full" size="lg">
          {user ? "Accept Invitation" : "Sign In to Accept"}
        </Button>
      </Card>
    </div>
  );
}
