import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { showErrorToastLegacy } from "@/lib/errorHandling";
import { Loader2 } from "lucide-react";
import { DocAgaLogo } from "@/components/DocAgaLogo";

const CooperativeAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: isCooperative } = await supabase
          .rpc("has_role", { _user_id: user.id, _role: "cooperative" });
        if (isCooperative) {
          navigate("/cooperative");
        }
      }
    };
    checkAuth();
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Missing fields",
        description: "Please enter email and password",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      if (!data.user) throw new Error("No user data returned");

      const { data: isCooperative, error: roleError } = await supabase
        .rpc("has_role", { _user_id: data.user.id, _role: "cooperative" });

      if (roleError) {
        console.error("Role check error:", roleError);
        await supabase.auth.signOut();
        throw new Error("Failed to verify cooperative access");
      }

      if (!isCooperative) {
        await supabase.auth.signOut();
        throw new Error("This account does not have cooperative access. Please use the appropriate login page.");
      }

      toast({
        title: "Welcome!",
        description: "Signed in to Cooperative Portal"
      });

      navigate("/cooperative");
    } catch (error: any) {
      console.error("Cooperative sign in error:", error);
      showErrorToastLegacy(toast, error, "cooperative login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <DocAgaLogo size="lg" />
          </div>
          <CardTitle className="text-2xl font-bold">Cooperative Portal</CardTitle>
          <CardDescription>Consolidated Farm Analytics & Management</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="coop-email">Email</Label>
              <Input
                id="coop-email"
                type="email"
                placeholder="admin@cooperative.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coop-password">Password</Label>
              <Input
                id="coop-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CooperativeAuth;
