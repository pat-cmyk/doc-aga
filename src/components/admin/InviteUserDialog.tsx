import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, ShieldAlert, AlertCircle } from "lucide-react";

type GlobalRole = "admin" | "government" | "merchant" | "distributor" | "cooperative";

interface InviteUserDialogProps {
  onInvitationSent?: () => void;
  isSuperAdmin?: boolean;
}

const roleDescriptions: Record<GlobalRole, string> = {
  admin: "Full system administration (super admin power)",
  government: "Government analytics dashboard access",
  merchant: "Marketplace vendor account",
  distributor: "Product distributor",
  cooperative: "Cooperative dashboard admin",
};

export const InviteUserDialog = ({
  onInvitationSent,
  isSuperAdmin = false,
}: InviteUserDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<GlobalRole>("merchant");
  const { toast } = useToast();

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !selectedRole) {
      toast({
        title: "Validation Error",
        description: "Please enter an email and choose a role.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-user-invitation",
        {
          body: {
            email: trimmedEmail,
            role: selectedRole,
            appUrl: window.location.origin,
          },
        }
      );

      if (error) throw error;

      const status = (data as { status?: string })?.status;
      const message = (data as { message?: string })?.message;

      if (status === "invited") {
        toast({
          title: "Invitation sent",
          description: message ?? `Email sent to ${trimmedEmail}.`,
        });
      } else if (status === "role_added_existing_user") {
        toast({
          title: "Role granted",
          description:
            message ??
            `${trimmedEmail} already had an account — role was added directly.`,
        });
      } else if (status === "role_already_present") {
        toast({
          title: "No change needed",
          description: message ?? "User already has this role.",
        });
      } else if (status === "invited_no_email") {
        toast({
          title: "Invitation saved",
          description:
            message ??
            "Invitation was created but email could not be sent. Contact the invitee with the link manually.",
        });
      } else {
        toast({
          title: "Done",
          description: message ?? "Invitation processed.",
        });
      }

      setEmail("");
      setSelectedRole("merchant");
      setOpen(false);
      onInvitationSent?.();
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to send invitation";
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const privilegedRole = selectedRole === "admin" || selectedRole === "government";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Mail className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Invite User via Email</DialogTitle>
          <DialogDescription>
            Send an email invitation to grant a platform-level role. The recipient
            sets their own password when they accept.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleInvite} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email Address *</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Role *</Label>
            <Select
              value={selectedRole}
              onValueChange={(value) => setSelectedRole(value as GlobalRole)}
            >
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="merchant">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Merchant</span>
                    <span className="text-xs text-muted-foreground">
                      {roleDescriptions.merchant}
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="distributor">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Distributor</span>
                    <span className="text-xs text-muted-foreground">
                      {roleDescriptions.distributor}
                    </span>
                  </div>
                </SelectItem>
                {isSuperAdmin && (
                  <>
                    <SelectItem value="cooperative">
                      <div className="flex flex-col items-start">
                        <span className="font-medium flex items-center gap-1">
                          Cooperative Admin
                          <ShieldAlert className="h-3 w-3" />
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {roleDescriptions.cooperative}
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="government">
                      <div className="flex flex-col items-start">
                        <span className="font-medium flex items-center gap-1">
                          Government Official
                          <ShieldAlert className="h-3 w-3" />
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {roleDescriptions.government}
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex flex-col items-start">
                        <span className="font-medium flex items-center gap-1">
                          Administrator
                          <ShieldAlert className="h-3 w-3" />
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {roleDescriptions.admin}
                        </span>
                      </div>
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {privilegedRole && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Privileged Role:</strong> This user will have{" "}
                {selectedRole === "admin"
                  ? "full system administration"
                  : "government analytics"}{" "}
                access once they accept the invitation.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
