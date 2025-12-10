import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface UserProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  is_disabled?: boolean;
}

interface EditUserDialogProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditUserDialog = ({ user, open, onOpenChange }: EditUserDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [reason, setReason] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");

  // Reset form when user changes
  useState(() => {
    if (user) {
      setFullName(user.full_name || "");
      setPhone(user.phone || "");
      setReason("");
      setTicketNumber("");
    }
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No user selected");
      
      const changes: Record<string, string> = {};
      if (fullName !== user.full_name) changes.full_name = fullName;
      if (phone !== user.phone) changes.phone = phone;

      if (Object.keys(changes).length === 0) {
        throw new Error("No changes to save");
      }

      const { data, error } = await supabase.rpc("admin_edit_profile", {
        _profile_id: user.id,
        _changes: changes,
        _reason: reason,
        _ticket_number: ticketNumber || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "User profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for this change.",
        variant: "destructive",
      });
      return;
    }
    editMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User Profile</DialogTitle>
          <DialogDescription>
            Make changes to the user's profile. All changes are audited.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Change *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this change being made?"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ticketNumber">Ticket Number (Optional)</Label>
            <Input
              id="ticketNumber"
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value)}
              placeholder="e.g., SUPPORT-1234"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={editMutation.isPending}>
              {editMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
