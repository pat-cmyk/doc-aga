import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Shield, 
  Building2, 
  Activity,
  Edit,
  Ban,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Ticket
} from "lucide-react";
import { format } from "date-fns";
import { EditUserDialog } from "./EditUserDialog";
import { CreateTicketDialog } from "./CreateTicketDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface UserDetailPanelProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UserDetailPanel = ({ userId, open, onOpenChange }: UserDetailPanelProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disableReason, setDisableReason] = useState("");
  const [createTicketOpen, setCreateTicketOpen] = useState(false);

  // Fetch user details
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["admin-user-detail", userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;
      
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role, is_super_admin")
        .eq("user_id", userId);

      // Use email from profiles table (synced via trigger) instead of admin API
      return {
        ...profile,
        email: profile.email || "Unknown",
        roles: roles || [],
      };
    },
    enabled: !!userId && open,
  });

  // Fetch user activity logs
  const { data: activityLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["admin-user-activity", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("user_activity_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && open && activeTab === "activity",
  });

  // Fetch user's farm memberships
  const { data: farmMemberships, isLoading: farmsLoading } = useQuery({
    queryKey: ["admin-user-farms", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // Get owned farms
      const { data: ownedFarms } = await supabase
        .from("farms")
        .select("id, name, region, livestock_type")
        .eq("owner_id", userId)
        .eq("is_deleted", false);

      // Get farm memberships
      const { data: memberships } = await supabase
        .from("farm_memberships")
        .select(`
          role_in_farm,
          invitation_status,
          farm:farms(id, name, region, livestock_type)
        `)
        .eq("user_id", userId)
        .eq("invitation_status", "accepted");

      const owned = (ownedFarms || []).map(f => ({ ...f, role: "owner" as const }));
      const member = (memberships || [])
        .filter(m => m.farm && !ownedFarms?.some(o => o.id === (m.farm as any)?.id))
        .map(m => ({ 
          ...(m.farm as any), 
          role: m.role_in_farm 
        }));

      return [...owned, ...member];
    },
    enabled: !!userId && open && activeTab === "farms",
  });

  // Disable/Enable user mutation
  const toggleDisableMutation = useMutation({
    mutationFn: async ({ disable, reason }: { disable: boolean; reason: string }) => {
      if (!userId) throw new Error("No user selected");
      
      const rpcName = disable ? "admin_disable_user" : "admin_enable_user";
      const { data, error } = await supabase.rpc(rpcName, {
        _profile_id: userId,
        _reason: reason,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.disable ? "User Disabled" : "User Enabled",
        description: `User account has been ${variables.disable ? "disabled" : "enabled"}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDisableDialogOpen(false);
      setDisableReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggleDisable = () => {
    if (!disableReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for this action.",
        variant: "destructive",
      });
      return;
    }
    toggleDisableMutation.mutate({ 
      disable: !user?.is_disabled, 
      reason: disableReason 
    });
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "destructive";
      case "farmer_owner": return "default";
      case "farmhand": return "secondary";
      case "merchant": return "outline";
      case "government": return "default";
      default: return "secondary";
    }
  };

  if (!userId) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Details
            </SheetTitle>
            <SheetDescription>
              View and manage user profile, activity, and permissions.
            </SheetDescription>
          </SheetHeader>

          {userLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : user ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="farms">Farms</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 mt-4">
                <TabsContent value="overview" className="m-0 space-y-4">
                  {/* User Info Card */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {user.full_name || "Unnamed User"}
                            {user.is_disabled && (
                              <Badge variant="destructive" className="text-xs">
                                Disabled
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </CardDescription>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditDialogOpen(true)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCreateTicketOpen(true)}
                        >
                          <Ticket className="h-4 w-4 mr-1" />
                          Ticket
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {user.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {user.phone}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        Joined {format(new Date(user.created_at), "MMM d, yyyy")}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Roles Card */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Roles & Permissions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {user.roles.length > 0 ? (
                          user.roles.map((r: any, idx: number) => (
                            <Badge key={idx} variant={getRoleBadgeVariant(r.role)}>
                              {r.role}
                              {r.is_super_admin && " (Super)"}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">No roles assigned</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Actions Card */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Account Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button
                        variant={user.is_disabled ? "default" : "destructive"}
                        size="sm"
                        className="w-full"
                        onClick={() => setDisableDialogOpen(true)}
                      >
                        {user.is_disabled ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Enable Account
                          </>
                        ) : (
                          <>
                            <Ban className="h-4 w-4 mr-2" />
                            Disable Account
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="activity" className="m-0">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Recent Activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {logsLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : activityLogs && activityLogs.length > 0 ? (
                        <div className="space-y-3">
                          {activityLogs.map((log: any) => (
                            <div key={log.id} className="border-b pb-3 last:border-0">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-sm font-medium">
                                    {log.activity_type.replace(/_/g, " ")}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {log.description}
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {log.activity_category}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
                                {log.ip_address && ` • ${log.ip_address}`}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No activity logs found
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="farms" className="m-0">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Farm Memberships
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {farmsLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : farmMemberships && farmMemberships.length > 0 ? (
                        <div className="space-y-3">
                          {farmMemberships.map((farm: any) => (
                            <div key={farm.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                              <div>
                                <p className="text-sm font-medium">{farm.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {farm.region} • {farm.livestock_type}
                                </p>
                              </div>
                              <Badge variant={farm.role === "owner" ? "default" : "secondary"}>
                                {farm.role}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No farm memberships
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-muted-foreground">User not found</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit User Dialog */}
      <EditUserDialog
        user={user}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      {/* Create Ticket Dialog */}
      <CreateTicketDialog
        open={createTicketOpen}
        onOpenChange={setCreateTicketOpen}
        linkedUserId={userId || undefined}
      />

      {/* Disable/Enable Confirmation Dialog */}
      <AlertDialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {user?.is_disabled ? "Enable User Account" : "Disable User Account"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {user?.is_disabled 
                ? "This will restore the user's ability to log in and use the system."
                : "This will prevent the user from logging in. All their data will be preserved."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="disableReason">Reason *</Label>
            <Textarea
              id="disableReason"
              value={disableReason}
              onChange={(e) => setDisableReason(e.target.value)}
              placeholder="Provide a reason for this action..."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleDisable}
              disabled={toggleDisableMutation.isPending}
              className={user?.is_disabled ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
            >
              {toggleDisableMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {user?.is_disabled ? "Enable Account" : "Disable Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
