import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { DocAgaLogo } from "@/components/DocAgaLogo";

type AuthClient = {
  auth: {
    oauth: {
      getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
      approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
      denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
    };
  };
};

const oauth = () => (supabase as unknown as AuthClient).auth.oauth;

const OAuthConsent = () => {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?redirect=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  };

  const clientName = details?.client?.name ?? "an app";

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-accent flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <DocAgaLogo size="lg" />
          </div>
          <CardTitle className="text-xl">
            {error ? "Authorization problem" : details ? `Connect ${clientName}` : "Loading…"}
          </CardTitle>
          <CardDescription>
            {error
              ? error
              : details
                ? `${clientName} is asking to use Doc Aga as you. It will be able to read your farm data through the Doc Aga tools.`
                : "Checking this authorization request…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!error && !details && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {details && (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
                Deny
              </Button>
              <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Approve"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default OAuthConsent;
