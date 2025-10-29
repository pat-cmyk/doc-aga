import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const AdminCreateUser = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invitationToken, setInvitationToken] = useState("");
  const { toast } = useToast();
  
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !invitationToken) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email,
          password,
          invitationToken
        }
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "User account created and invitation accepted"
      });
      
      // Clear form
      setEmail("");
      setPassword("");
      setInvitationToken("");

    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create user",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-md mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Create User Account</CardTitle>
          <CardDescription>
            Create a new user account and accept a farm invitation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invitationToken">Invitation Token</Label>
              <Input 
                id="invitationToken"
                type="text"
                placeholder="Enter invitation token (UUID)"
                value={invitationToken}
                onChange={(e) => setInvitationToken(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account & Accept Invitation
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCreateUser;
