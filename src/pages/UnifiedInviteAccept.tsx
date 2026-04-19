// src/pages/UnifiedInviteAccept.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useInviteLookup, type InviteLookup } from "@/hooks/useInviteLookup";
import { resolveInviteRedirect } from "@/lib/inviteRedirects";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { showErrorToast } from "@/lib/errorHandling";

type Phase =
  | "loading"
  | "new_user"
  | "existing_matching"
  | "existing_mismatch"
  | "sign_in_required"
  | "expired"
  | "revoked"
  | "already_accepted"
  | "not_found"
  | "submitting"
  | "success";

export default function UnifiedInviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const lookup = useInviteLookup(token);
  const [phase, setPhase] = useState<Phase>("loading");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setSessionEmail(data.user?.email ?? null);
    })();
  }, []);

  useEffect(() => {
    if (lookup.isLoading) { setPhase("loading"); return; }
    if (lookup.error || !lookup.data) { setPhase("not_found"); return; }
    const inv = lookup.data;
    if (inv.status === "expired")  { setPhase("expired"); return; }
    if (inv.status === "revoked")  { setPhase("revoked"); return; }
    if (inv.status === "accepted") { setPhase("already_accepted"); return; }
    if (inv.status !== "pending")  { setPhase("not_found"); return; }
    if (sessionEmail && sessionEmail.toLowerCase() === inv.email.toLowerCase()) {
      setPhase("existing_matching");
    } else if (sessionEmail) {
      setPhase("existing_mismatch");
    } else {
      setPhase("new_user"); // may fall through to sign_in_required if createUser reports USER_EXISTS
    }
  }, [lookup.data, lookup.isLoading, lookup.error, sessionEmail]);

  if (phase === "loading") return <LoadingCard />;
  if (phase === "not_found") return <InfoCard title="Invite not found" body="This invite link is invalid. Check the URL or ask the person who invited you to resend." />;
  if (phase === "expired") return <ExpiredCard token={token!} />;
  if (phase === "revoked") return <InfoCard title="Invite cancelled" body="This invite was cancelled. Please contact the person who invited you." />;
  if (phase === "already_accepted" && lookup.data) return <AlreadyAcceptedCard invite={lookup.data} onGo={() => navigate(resolveInviteRedirect(lookup.data!))} />;
  if (phase === "existing_matching" && lookup.data) return <AutoAcceptCard invite={lookup.data} token={token!} onSuccess={(redirect) => navigate(redirect)} />;
  if (phase === "existing_mismatch" && lookup.data) return <MismatchCard invite={lookup.data} sessionEmail={sessionEmail!} />;
  if (phase === "new_user" && lookup.data) return <NewUserCard invite={lookup.data} token={token!} onSuccess={(redirect) => navigate(redirect)} onExists={() => setPhase("sign_in_required")} />;
  if (phase === "sign_in_required" && lookup.data) return <SignInCard invite={lookup.data} token={token!} onSuccess={(redirect) => navigate(redirect)} />;
  return null;
}

function LoadingCard() {
  return <CenteredCard><Loader2 className="h-8 w-8 animate-spin" /></CenteredCard>;
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-4"><div className="w-full max-w-md">{children}</div></div>;
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return <CenteredCard><Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>{body}</CardContent></Card></CenteredCard>;
}

// NewUserCard, SignInCard, AutoAcceptCard, MismatchCard, ExpiredCard, AlreadyAcceptedCard implemented in D2–D7
function NewUserCard(_: { invite: InviteLookup; token: string; onSuccess: (redirectTo: string) => void; onExists: () => void }): JSX.Element { return <div data-testid="new-user-card" />; }
function SignInCard(_: { invite: InviteLookup; token: string; onSuccess: (redirectTo: string) => void }): JSX.Element { return <div data-testid="sign-in-card" />; }
function AutoAcceptCard(_: { invite: InviteLookup; token: string; onSuccess: (redirectTo: string) => void }): JSX.Element { return <div data-testid="auto-accept-card" />; }
function MismatchCard(_: { invite: InviteLookup; sessionEmail: string }): JSX.Element { return <div data-testid="mismatch-card" />; }
function ExpiredCard(_: { token: string }): JSX.Element { return <div data-testid="expired-card" />; }
function AlreadyAcceptedCard(_: { invite: InviteLookup; onGo: () => void }): JSX.Element { return <div data-testid="already-accepted-card" />; }
