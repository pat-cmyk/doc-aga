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
import { toast } from "sonner";

function friendlyErrorMessage(code: string | undefined, fallback: string, reason?: string): string {
  if (code === "WEAK_PASSWORD" && reason) {
    const reasonMap: Record<string, string> = {
      too_short: "Password must be at least 8 characters.",
      too_long: "Password must be 128 characters or fewer.",
      missing_lowercase: "Password must include a lowercase letter.",
      missing_uppercase: "Password must include an uppercase letter.",
      missing_number: "Password must include a number.",
      missing_symbol: "Password must include a symbol (e.g. ! @ # $).",
      too_common: "This password is too common. Please choose a less predictable one.",
    };
    return reasonMap[reason] ?? "Password doesn't meet requirements. Use 8+ characters with upper, lower, number, and symbol.";
  }
  if (!code) return fallback;
  const map: Record<string, string> = {
    rate_limited: "Too many attempts. Please wait a minute and try again.",
    WEAK_PASSWORD: "Password must be 8+ characters with upper, lower, number, and symbol.",
    USER_EXISTS_SIGN_IN_REQUIRED: "An account already exists. Please sign in.",
    EMAIL_MISMATCH: "This invite was sent to a different email.",
    TOKEN_EXPIRED: "This invite link has expired.",
    TOKEN_REVOKED: "This invite was cancelled by the administrator.",
    TOKEN_ALREADY_ACCEPTED: "This invite has already been used.",
    TOKEN_NOT_FOUND: "This invite link is invalid.",
    INTERNAL: "Something went wrong on our side. Please try again in a moment.",
    bad_request: "Invalid request. Please refresh and try again.",
  };
  return map[code] ?? fallback;
}

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
function NewUserCard({
  invite, token, onSuccess, onExists,
}: {
  invite: InviteLookup;
  token: string;
  onSuccess: (redirectTo: string) => void;
  onExists: () => void;
}) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-invitation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ token, full_name: name.trim(), password }),
      });
      const body = await res.json();
      if (res.status === 409 && body.code === "USER_EXISTS_SIGN_IN_REQUIRED") { onExists(); return; }
      if (!res.ok) { toast.error(friendlyErrorMessage(body.code, body.message ?? "Something went wrong", body.reason)); return; }
      if (body.session?.access_token && body.session?.refresh_token) {
        try {
          await supabase.auth.setSession({
            access_token: body.session.access_token,
            refresh_token: body.session.refresh_token,
          });
        } catch (err) {
          // Account was created but session install failed. Bounce to sign-in
          // so the user can use the password they just set.
          onExists();
          return;
        }
      }
      onSuccess(body.redirectTo ?? "/");
    } finally { setBusy(false); }
  }

  return (
    <CenteredCard>
      <Card>
        <CardHeader>
          <CardTitle>Welcome to Doc Aga</CardTitle>
          <CardDescription>
            You've been invited as <strong>{invite.role_label}</strong> by <strong>{invite.inviter_name}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="invite-full-name">Full name</Label>
              <Input id="invite-full-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            <div>
              <Label htmlFor="invite-password">Password</Label>
              <div className="flex gap-2">
                <Input id="invite-password" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  aria-pressed={showPw}
                >{showPw ? "Hide" : "Show"}</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">At least 8 characters.</p>
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept & continue →"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </CenteredCard>
  );
}
function SignInCard({
  invite, token, onSuccess,
}: {
  invite: InviteLookup;
  token: string;
  onSuccess: (redirectTo: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: invite.email, password });
      if (error || !data.session) { toast.error(error?.message ?? "Sign-in failed"); return; }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-invitation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ token }),
      });
      const body = await res.json();
      if (!res.ok) { toast.error(friendlyErrorMessage(body.code, body.message ?? "Sign-in failed", body.reason)); return; }
      onSuccess(body.redirectTo ?? "/");
    } finally { setBusy(false); }
  }

  return (
    <CenteredCard>
      <Card>
        <CardHeader>
          <CardTitle>Sign in to accept</CardTitle>
          <CardDescription>Welcome back. Sign in to accept your invite to <strong>{invite.target_name}</strong>.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="invite-signin-email">Email</Label>
              <Input id="invite-signin-email" value={invite.email} disabled />
            </div>
            <div>
              <Label htmlFor="invite-signin-password">Password</Label>
              <Input id="invite-signin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in & accept"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </CenteredCard>
  );
}
function AutoAcceptCard({
  invite, token, onSuccess,
}: {
  invite: InviteLookup;
  token: string;
  onSuccess: (redirectTo: string) => void;
}) {
  const [done, setDone] = useState(false);
  const [redirect, setRedirect] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) { setErr("no_session"); return; }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-invitation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sess.session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ token }),
      });
      const body = await res.json();
      if (!res.ok) { setErr(body.code ?? "accept_failed"); return; }
      setRedirect(body.redirectTo ?? "/");
      setDone(true);
    })();
  }, [token]);

  if (err) {
    // Known terminal states the user can act on — surface them with a meaningful card.
    if (err === "TOKEN_EXPIRED") return <ExpiredCard token={token} />;
    if (err === "TOKEN_REVOKED") return <InfoCard title="Invite cancelled" body="This invite was cancelled. Please contact the person who invited you." />;
    if (err === "TOKEN_ALREADY_ACCEPTED") return <AlreadyAcceptedCard invite={invite} onGo={() => onSuccess(resolveInviteRedirect(invite))} />;
    return <InfoCard title="Couldn't accept invite" body={friendlyErrorMessage(err, "Please try refreshing.")} />;
  }
  return (
    <CenteredCard>
      <Card>
        <CardHeader>
          <CardTitle>You're in</CardTitle>
          <CardDescription>
            You've been granted <strong>{invite.role_label}</strong> access by <strong>{invite.inviter_name}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" disabled={!done} onClick={() => onSuccess(redirect!)}>
            {done ? "Go to Dashboard →" : <Loader2 className="h-4 w-4 animate-spin" />}
          </Button>
        </CardContent>
      </Card>
    </CenteredCard>
  );
}
function MismatchCard({
  invite, sessionEmail,
}: {
  invite: InviteLookup;
  sessionEmail: string;
}) {
  async function signOutAndReload() {
    await supabase.auth.signOut();
    window.location.reload();
  }
  return (
    <CenteredCard>
      <Card>
        <CardHeader>
          <CardTitle>Signed in as a different account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTitle>Email mismatch</AlertTitle>
            <AlertDescription>
              This invite was sent to <strong>{invite.email}</strong>.<br />
              You're signed in as <strong>{sessionEmail}</strong>.
            </AlertDescription>
          </Alert>
          <Button className="w-full" onClick={signOutAndReload}>Sign out &amp; continue</Button>
        </CardContent>
      </Card>
    </CenteredCard>
  );
}
function ExpiredCard({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "requesting" | "sent" | "failed">("idle");
  const [reason, setReason] = useState<string | null>(null);

  async function requestResend() {
    setState("requesting");
    const { data, error } = await supabase.rpc("request_invitation_resend", { p_token: token });
    if (error || !data || !(Array.isArray(data) ? data[0]?.sent : (data as any).sent)) {
      setReason((Array.isArray(data) ? data[0]?.reason : (data as any)?.reason) ?? "unknown");
      setState("failed"); return;
    }
    setState("sent");
  }

  return (
    <CenteredCard>
      <Card>
        <CardHeader>
          <CardTitle>This invite has expired</CardTitle>
          <CardDescription>Invite links are valid for 7 days.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {state === "sent" && <Alert><AlertDescription>We've sent you a new invite. Check your email.</AlertDescription></Alert>}
          {state === "failed" && <Alert><AlertDescription>
            {reason === "recent_resend"
              ? "We already sent a new link recently. Please check your email."
              : `Couldn't resend automatically. Please contact the person who invited you.`}
          </AlertDescription></Alert>}
          {state !== "sent" && <Button className="w-full" disabled={state === "requesting"} onClick={requestResend}>
            {state === "requesting" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request a new link"}
          </Button>}
        </CardContent>
      </Card>
    </CenteredCard>
  );
}
function AlreadyAcceptedCard({ invite, onGo }: { invite: InviteLookup; onGo: () => void }) {
  return (
    <CenteredCard>
      <Card>
        <CardHeader>
          <CardTitle>You've already joined</CardTitle>
          <CardDescription>You already have access to <strong>{invite.target_name}</strong>.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={onGo}>Go to Dashboard →</Button>
        </CardContent>
      </Card>
    </CenteredCard>
  );
}
