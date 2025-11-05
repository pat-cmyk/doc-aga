import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, ShieldAlert, AlertCircle } from "lucide-react";
import { UserRole } from "@/hooks/useRole";

interface CreateUserDialogProps {
  onUserCreated?: () => void;
  isSuperAdmin?: boolean;
}

export const CreateUserDialog = ({ onUserCreated, isSuperAdmin = false }: CreateUserDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("farmer_owner");
  const [invitationToken, setInvitationToken] = useState("");
  const { toast } = useToast();

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !fullName || !selectedRole) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Only require invitation token for farmhand role
    if (selectedRole === "farmhand" && !invitationToken) {
      toast({
        title: "Validation Error",
        description: "Invitation token is required for farmhand accounts",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email,
          password,
          fullName,
          role: selectedRole,
          invitationToken: selectedRole === "farmhand" ? invitationToken : undefined,
        },
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: `${fullName}'s account created with ${selectedRole} role`,
      });

      // Reset form
      setEmail("");
      setPassword("");
      setFullName("");
      setSelectedRole("farmer_owner");
      setInvitationToken("");
      setOpen(false);

      // Trigger refresh
      onUserCreated?.();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const roleDescriptions: Record<UserRole, string> = {
    farmer_owner: "Full farm management access",
    farmhand: "Field worker with limited access (requires invitation)",
    merchant: "Marketplace vendor account",
    vet: "Veterinary professional",
    distributor: "Product distributor",
    government: "Government analytics access (super admin only)",
    admin: "System administrator (super admin only)",
  };

  const canCreateRole = (role: UserRole): boolean => {
    if (role === "government" || role === "admin") {
      return isSuperAdmin;
    }
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Create User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New User Account</DialogTitle>
          <DialogDescription>
            Create a user account and assign their role. {isSuperAdmin && "As a super admin, you can create government and admin users."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
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
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="text-xs text-muted-foreground">
              Must contain uppercase, lowercase, number, and symbol
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">User Role *</Label>
            <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="farmer_owner">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Farm Owner</span>
                    <span className="text-xs text-muted-foreground">{roleDescriptions.farmer_owner}</span>
                  </div>
                </SelectItem>
                <SelectItem value="farmhand">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Farmhand</span>
                    <span className="text-xs text-muted-foreground">{roleDescriptions.farmhand}</span>
                  </div>
                </SelectItem>
                <SelectItem value="merchant">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Merchant</span>
                    <span className="text-xs text-muted-foreground">{roleDescriptions.merchant}</span>
                  </div>
                </SelectItem>
                <SelectItem value="vet">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Veterinarian</span>
                    <span className="text-xs text-muted-foreground">{roleDescriptions.vet}</span>
                  </div>
                </SelectItem>
                {isSuperAdmin && (
                  <>
                    <SelectItem value="government">
                      <div className="flex flex-col items-start">
                        <span className="font-medium flex items-center gap-1">
                          Government Official
                          <ShieldAlert className="h-3 w-3" />
                        </span>
                        <span className="text-xs text-muted-foreground">{roleDescriptions.government}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex flex-col items-start">
                        <span className="font-medium flex items-center gap-1">
                          Administrator
                          <ShieldAlert className="h-3 w-3" />
                        </span>
                        <span className="text-xs text-muted-foreground">{roleDescriptions.admin}</span>
                      </div>
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedRole === "farmhand" && (
            <div className="space-y-2">
              <Label htmlFor="invitationToken">Farm Invitation Token *</Label>
              <Input
                id="invitationToken"
                type="text"
                placeholder="UUID token from farm invitation"
                value={invitationToken}
                onChange={(e) => setInvitationToken(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Get this token from the farm owner who sent the invitation
              </p>
            </div>
          )}

          {(selectedRole === "government" || selectedRole === "admin") && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Privileged Role:</strong> This user will have {selectedRole === "admin" ? "full system administration" : "government analytics"} access.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !canCreateRole(selectedRole)}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
