import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2, Mail, Calendar, Send, Check, MicOff } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface FarmTeamManagementProps {
  farmId: string;
  isOwner: boolean;
}

interface TeamMember {
  id: string;
  user_id: string;
  role_in_farm: string;
  invitation_status: string;
  invited_email: string | null;
  invited_at: string;
  profiles: {
    full_name: string;
    email: string;
    voice_training_completed: boolean;
  } | null;
}

export const FarmTeamManagement = ({ farmId, isOwner }: FarmTeamManagementProps) => {
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"farmhand" | "farmer_owner">("farmhand");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch team members
  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ["farm-team", farmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farm_memberships")
        .select(`
          id,
          user_id,
          role_in_farm,
          invitation_status,
          invited_email,
          invited_at,
          profiles:user_id (
            full_name,
            email,
            voice_training_completed
          )
        `)
        .eq("farm_id", farmId)
        .order("invited_at", { ascending: false });

      if (error) throw error;
      return data as TeamMember[];
    },
  });

  // Invite team member mutation
  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const currentUser = (await supabase.auth.getUser()).data.user;
      
      // Check if an invitation already exists for this email
      const { data: existingInvite } = await supabase
        .from("farm_memberships")
        .select("id, invitation_status")
        .eq("farm_id", farmId)
        .eq("invited_email", email)
        .maybeSingle();

      if (existingInvite) {
        if (existingInvite.invitation_status === "pending") {
          throw new Error("An invitation has already been sent to this email");
        } else if (existingInvite.invitation_status === "accepted") {
          throw new Error("This user is already a member of your farm");
        }
      }

      // For pending invitations, user_id is null until they accept
      const { data: membershipData, error: insertError } = await supabase
        .from("farm_memberships")
        .insert({
          farm_id: farmId,
          user_id: null,
          invited_email: email,
          role_in_farm: role as any,
          invitation_status: "pending",
          invited_by: currentUser?.id,
        } as any)
        .select(`
          id,
          invitation_token,
          farms!inner (name)
        `)
        .single();

      if (insertError) throw insertError;

      // Get inviter name
      const { data: inviterProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", currentUser?.id)
        .single();

      // Send invitation email
      const { error: emailError } = await supabase.functions.invoke(
        "send-team-invitation",
        {
          body: {
            membershipId: membershipData.id,
            invitedEmail: email,
            farmName: (membershipData.farms as any).name,
            inviterName: inviterProfile?.full_name || "A team member",
            role: role,
            invitationToken: membershipData.invitation_token,
          },
        }
      );

      if (emailError) {
        console.error("Failed to send invitation email:", emailError);
        // Don't throw - membership was created successfully
      }

      return membershipData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farm-team", farmId] });
      toast({
        title: "Success",
        description: "Invitation sent successfully! The team member will receive an email.",
      });
      setIsInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("farmhand");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    },
  });

  // Resend invitation mutation
  const resendMutation = useMutation({
    mutationFn: async (member: TeamMember) => {
      const currentUser = (await supabase.auth.getUser()).data.user;
      
      // Get farm name and membership data
      const { data: membershipData, error: fetchError } = await supabase
        .from("farm_memberships")
        .select(`
          id,
          invitation_token,
          farms!inner (name)
        `)
        .eq("id", member.id)
        .single();

      if (fetchError) throw fetchError;

      // Get inviter name
      const { data: inviterProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", currentUser?.id)
        .single();

      // Send invitation email
      const { error: emailError } = await supabase.functions.invoke(
        "send-team-invitation",
        {
          body: {
            membershipId: membershipData.id,
            invitedEmail: member.invited_email,
            farmName: (membershipData.farms as any).name,
            inviterName: inviterProfile?.full_name || "A team member",
            role: member.role_in_farm,
            invitationToken: membershipData.invitation_token,
          },
        }
      );

      if (emailError) throw emailError;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invitation resent successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resend invitation",
        variant: "destructive",
      });
    },
  });

  // Remove team member mutation
  const removeMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabase
        .from("farm_memberships")
        .delete()
        .eq("id", membershipId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farm-team", farmId] });
      toast({
        title: "Success",
        description: "Team member removed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInvite = () => {
    if (!inviteEmail) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      farmer_owner: { label: "Farm Manager", variant: "default" as const },
      farmhand: { label: "Farm Hand", variant: "secondary" as const },
    };
    const config = roleConfig[role as keyof typeof roleConfig] || { label: role, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      accepted: { label: "Active", variant: "default" as const },
      pending: { label: "Pending", variant: "outline" as const },
      declined: { label: "Declined", variant: "destructive" as const },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getVoiceTrainingBadge = (completed: boolean | undefined) => {
    if (completed === undefined || completed === null) return null;
    
    return completed ? (
      <Badge variant="default" className="bg-green-500 hover:bg-green-600">
        <Check className="h-3 w-3 mr-1" />
        Voice Training
      </Badge>
    ) : (
      <Badge variant="outline" className="text-muted-foreground">
        <MicOff className="h-3 w-3 mr-1" />
        Training Pending
      </Badge>
    );
  };

  if (isLoading) {
    return <div>Loading team members...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              {isOwner ? "Manage your farm team members" : "View farm team members"}
            </CardDescription>
          </div>
          {isOwner && (
            <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join your farm team
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="member@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                      <SelectTrigger id="role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="farmhand">Farm Hand</SelectItem>
                        <SelectItem value="farmer_owner">Farm Manager</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground mt-1">
                      {inviteRole === "farmer_owner" 
                        ? "Farm Managers can manage animals and records but cannot add/remove team members"
                        : "Farm Hands have limited access to assigned animals"}
                    </p>
                  </div>
                  <Button onClick={handleInvite} disabled={inviteMutation.isPending} className="w-full">
                    {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!teamMembers || teamMembers.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No team members yet. {isOwner && "Invite someone to get started!"}
          </p>
        ) : (
          <div className="space-y-4">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">
                      {member.profiles?.full_name || member.invited_email}
                    </span>
                    {getRoleBadge(member.role_in_farm)}
                    {getStatusBadge(member.invitation_status)}
                    {member.invitation_status === "accepted" && 
                     member.profiles?.voice_training_completed !== undefined && 
                     getVoiceTrainingBadge(member.profiles.voice_training_completed)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {member.profiles?.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {member.profiles.email}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Invited {format(new Date(member.invited_at), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
                {isOwner && (
                  <div className="flex items-center gap-2">
                    {member.invitation_status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resendMutation.mutate(member)}
                        disabled={resendMutation.isPending}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Resend
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMutation.mutate(member.id)}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
