import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { showErrorToastLegacy } from "@/lib/errorHandling";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";

interface Props {
  cooperativeId: string;
}

export const CooperativeInviteFarmDialog = ({ cooperativeId }: Props) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("invite_farm_to_cooperative", {
        _cooperative_id: cooperativeId,
        _email: email.trim(),
      });

      if (error) throw error;

      if (data === "success") {
        toast({ title: "Invitation sent!", description: `Invitation sent to ${email}` });
        queryClient.invalidateQueries({ queryKey: ["cooperative-member-farms"] });
        queryClient.invalidateQueries({ queryKey: ["cooperative-pending-invitations"] });
        setEmail("");
        setOpen(false);
      } else if (data === "error:no_farm_found") {
        toast({
          title: "No Farm Found",
          description: "No farm was found for this email address. The farm owner must have an existing farm in the system.",
          variant: "destructive",
        });
      } else if (data === "error:already_invited") {
        toast({
          title: "Already Invited",
          description: "This farm has already been invited to the cooperative.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: data?.replace("error:", "") || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      showErrorToastLegacy(toast, error, "inviting farm");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Farm
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a Farm</DialogTitle>
          <DialogDescription>
            Enter the farm owner's email address. They must already have a farm registered in the system.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Farm Owner Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="farmer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Invitation"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
