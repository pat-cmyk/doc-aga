import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Sprout, Loader2 } from "lucide-react";
import PasswordStrengthIndicator from "@/components/PasswordStrengthIndicator";
import { VoiceTrainingOnboarding } from "@/components/voice-training/VoiceTrainingOnboarding";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showVoiceTrainingOnboarding, setShowVoiceTrainingOnboarding] = useState(false);

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Check user roles and redirect accordingly
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        
        const userRoles = roles?.map(r => r.role) || [];
        
        if (userRoles.includes("admin")) {
          navigate("/admin");
        } else if (userRoles.includes("merchant")) {
          navigate("/merchant");
        } else {
          navigate("/");
        }
      }
    };
    checkAuth();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/`
      }
    });

    if (error) {
      setLoading(false);
      const isLeakedPassword = error.message?.includes("password has been exposed") || 
                               error.message?.includes("breached") || 
                               error.message?.includes("leaked");
      
      toast({
        title: isLeakedPassword ? "Weak Password Detected" : "Signup failed",
        description: isLeakedPassword 
          ? "This password has been exposed in a data breach. Please choose a stronger, unique password."
          : error.message,
        variant: "destructive"
      });
      return;
    }

    // Wait for session to be established before redirecting
    if (data.session) {
      // Session is available immediately (auto-confirm is enabled)
      toast({
        title: "Success!",
        description: "Account created successfully"
      });
      setLoading(false);
      // Show voice training onboarding modal
      setShowVoiceTrainingOnboarding(true);
    } else {
      // Email confirmation required
      setLoading(false);
      toast({
        title: "Check your email",
        description: "Please confirm your email address to complete registration"
      });
    }
  };

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

      // Check user role to ensure farmer login only
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);

      const userRoles = roles?.map(r => r.role) || [];

      // Redirect based on role
      if (userRoles.includes("admin")) {
        navigate("/admin");
      } else if (userRoles.includes("merchant")) {
        navigate("/merchant");
      } else {
        // Farmer (no specific role or farmer role)
        navigate("/");
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <VoiceTrainingOnboarding
        open={showVoiceTrainingOnboarding}
        onOpenChange={setShowVoiceTrainingOnboarding}
        onStartTraining={() => {
          setShowVoiceTrainingOnboarding(false);
          navigate("/voice-training");
        }}
        onSkip={async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase
                .from('profiles')
                .update({ voice_training_skipped: true })
                .eq('id', user.id);
            }
          } catch (error) {
            console.error('Error skipping voice training:', error);
          }
          setShowVoiceTrainingOnboarding(false);
          navigate("/");
        }}
      />
      <div className="min-h-screen bg-gradient-to-br from-background to-accent flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Sprout className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Farmer Portal</CardTitle>
          <CardDescription>Sign in or create your farmer account to manage your livestock</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="farmer@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
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
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Juan Dela Cruz"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="farmer@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <PasswordStrengthIndicator password={password} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          
          <div className="mt-6 pt-6 border-t text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Looking for a different portal?
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate("/auth/merchant")}
                type="button"
              >
                Merchant Portal
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate("/auth/admin")}
                type="button"
              >
                Admin Portal
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
};

export default Auth;