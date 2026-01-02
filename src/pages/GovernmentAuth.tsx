import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { DocAgaLogo } from "@/components/DocAgaLogo";

const GovernmentAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    // Check if user is already authenticated as government
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Check if user has government role using RPC
        const { data: isGovernment } = await supabase
          .rpc("has_role", { 
            _user_id: user.id, 
            _role: "government" 
          });
        
        if (isGovernment) {
          navigate("/government");
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

      // Verify user has government role using RPC (server-side validation)
      const { data: isGovernment, error: roleError } = await supabase
        .rpc("has_role", { 
          _user_id: data.user.id, 
          _role: "government" 
        });

      if (roleError) {
        console.error("Role check error:", roleError);
        await supabase.auth.signOut();
        throw new Error("Failed to verify government access");
      }

      if (!isGovernment) {
        await supabase.auth.signOut();
        throw new Error("This account does not have government access. Please use the appropriate login page.");
      }

      toast({
        title: "Welcome!",
        description: "Signed in to Government Portal"
      });

      navigate("/government");
    } catch (error: any) {
      console.error("Government sign in error:", error);
      toast({
        title: "Login failed",
        description: error.message || "An error occurred during sign in",
        variant: "destructive"
      });
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
          <CardTitle className="text-2xl font-bold">Government Portal</CardTitle>
          <CardDescription>Livestock Industry Insights & Analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gov-email">Email</Label>
              <Input
                id="gov-email"
                type="email"
                placeholder="official@government.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gov-password">Password</Label>
              <Input
                id="gov-password"
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

export default GovernmentAuth;
