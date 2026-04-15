import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type InviteStatus =
  | "checking"
  | "ready"
  | "accepting"
  | "success"
  | "error";

interface InvitationData {
  email: string;
  role: string;
  invitation_status: string;
  token_expires_at: string;
  invited_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "System Administrator",
  government: "Government Official",
  merchant: "Merchant",
  distributor: "Distributor",
  cooperative: "Cooperative Admin",
};

const ROLE_HOMES: Record<string, string> = {
  admin: "/admin",
  government: "/government",
  merchant: "/merchant",
  distributor: "/distributor",
  cooperative: "/cooperative",
};

export default function UserInviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [status, setStatus] = useState<InviteStatus>("checking");
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string>("");
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);

  const checkInvitation = useCallback(async () => {
    setStatus("checking");
    setError("");

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      const { data: inviteData, error: inviteError } = await supabase.rpc(
        "get_user_invitation_public",
        { _token: token }
      );

      if (inviteError) {
        console.error("[UserInviteAccept] fetch error:", inviteError);
        setError("Something went wrong. Please try again.");
        setStatus("error");
        return;
      }

      if (!inviteData || inviteData.length === 0) {
        setError("Invalid or expired invitation link.");
        setStatus("error");
        return;
      }

      const inv = inviteData[0] as InvitationData;
      setInvitation(inv);

      if (inv.invitation_status === "accepted") {
        setError("This invitation has already been accepted.");
        setStatus("error");
        return;
      }
      if (inv.invitation_status === "revoked") {
        setError("This invitation has been revoked.");
        setStatus("error");
        return;
      }
      if (
        inv.invitation_status === "expired" ||
        new Date(inv.token_expires_at) < new Date()
      ) {
        setError("This invitation has expired. Please ask the admin to resend.");
        setStatus("error");
        return;
      }

      setStatus("ready");
    } catch (err) {
      console.error("[UserInviteAccept] error:", err);
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }, [token]);

  useEffect(() => {
    checkInvitation();
  }, [checkInvitation]);

  const goToAuth = () => {
    const returnUrl = encodeURIComponent(window.location.pathname);
    const inviteEmail = encodeURIComponent(invitation?.email ?? "");
    navigate(`/auth?redirect=${returnUrl}&email=${inviteEmail}`);
  };

  const acceptInvitation = useCallback(async () => {
    if (!user) {
      goToAuth();
      return;
    }

    setStatus("accepting");
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "accept_user_invitation",
        { _token: token }
      );

      if (rpcError) {
        const msg = rpcError.message || "";
        if (msg.includes("email_mismatch")) {
          setError(
            `This invitation was sent to ${invitation?.email}. Please sign in with that email address.`
          );
        } else if (msg.includes("invitation_expired")) {
          setError("This invitation has expired.");
        } else if (msg.includes("invitation_revoked")) {
          setError("This invitation has been revoked.");
        } else if (msg.includes("invitation_accepted")) {
          setError("This invitation has already been accepted.");
        } else {
          setError("Failed to accept invitation. Please try again.");
        }
        setStatus("error");
        return;
      }

      const role = (data as { role?: string })?.role ?? invitation?.role;
      const home = (role && ROLE_HOMES[role]) ?? "/";

      setStatus("success");
      toast({
        title: "Welcome!",
        description: `You've joined Doc Aga as a ${
          ROLE_LABELS[role ?? ""] ?? role
        }.`,
      });

      setTimeout(() => navigate(home), 1500);
    } catch (err) {
      console.error("[UserInviteAccept] accept error:", err);
      setError("Failed to accept invitation. Please try again.");
      setStatus("error");
    }
  }, [user, token, invitation, navigate, toast]);

  const isEmailMismatch =
    user &&
    invitation &&
    user.email?.toLowerCase() !== invitation.email.toLowerCase();

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Checking invitation...</p>
        </div>
      </div>
    );
  }

  if (status === "accepting" || status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-6 text-center">
          {status === "success" ? (
            <CheckCircle className="h-12 w-12 text-primary mx-auto mb-4" />
          ) : (
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          )}
          <h1 className="text-xl font-bold mb-2">
            {status === "success" ? "All set!" : "Accepting invitation..."}
          </h1>
          <p className="text-muted-foreground">
            {status === "success"
              ? "Redirecting you now..."
              : "Hang tight."}
          </p>
        </Card>
      </div>
    );
  }

  if (status === "error") {
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

  // status === "ready"
  const roleLabel =
    (invitation && ROLE_LABELS[invitation.role]) ?? invitation?.role ?? "User";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-6">
        <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-center mb-2">
          Doc Aga Invitation
        </h1>
        <div className="space-y-4 mb-6">
          <p className="text-center text-muted-foreground">
            You've been invited to join Doc Aga
          </p>
          <div className="bg-muted p-4 rounded-lg text-center space-y-1">
            <h2 className="text-xl font-semibold">{roleLabel}</h2>
            <p className="text-sm text-muted-foreground">
              for <strong>{invitation?.email}</strong>
            </p>
          </div>

          {!user && (
            <p className="text-sm text-muted-foreground text-center">
              You'll need to sign in or create an account to accept this
              invitation.
            </p>
          )}

          {isEmailMismatch && (
            <div className="bg-destructive/10 border border-destructive/30 p-3 rounded-lg text-sm">
              <p className="text-destructive font-medium">Email Mismatch</p>
              <p className="text-muted-foreground mt-1">
                This invitation was sent to{" "}
                <strong>{invitation?.email}</strong>, but you're signed in as{" "}
                <strong>{user?.email}</strong>.
              </p>
              <p className="text-muted-foreground mt-1">
                Sign out and use the correct email to accept.
              </p>
            </div>
          )}
        </div>

        {isEmailMismatch ? (
          <Button
            onClick={async () => {
              await supabase.auth.signOut();
              goToAuth();
            }}
            className="w-full"
            size="lg"
            variant="outline"
          >
            Sign Out & Use Different Account
          </Button>
        ) : (
          <Button onClick={acceptInvitation} className="w-full" size="lg">
            {user ? "Accept Invitation" : "Sign In to Accept"}
          </Button>
        )}
      </Card>
    </div>
  );
}
