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
  const { toast } = useToast();
  
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: 'pat.ebuna@gmail.com',
          password: 'Ff8c_6PVbZanN9m!R',
          invitationToken: '161b74e9-d713-40bd-b076-b41002334ae5'
        }
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "User account created and invitation accepted"
      });

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
          <CardTitle>Create Farm Hand Account</CardTitle>
          <CardDescription>
            Create account for pat.ebuna@gmail.com and accept invitation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value="pat.ebuna@gmail.com" disabled />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value="Ff8c_6PVbZanN9m!R" disabled />
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
