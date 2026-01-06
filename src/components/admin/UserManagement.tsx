import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { CreateUserDialog } from "./CreateUserDialog";
import { UserDetailPanel } from "./UserDetailPanel";
import { useState, useEffect } from "react";
import { Eye, Ban } from "lucide-react";

type UserRole = "admin" | "farmer_owner" | "farmhand" | "merchant" | "vet" | "government";

interface UserWithDetails {
  id: string;
  full_name: string | null;
  phone: string | null;
  roles: UserRole[];
  created_at: string;
  email: string;
  farm_count: number;
  is_disabled?: boolean;
}

export const UserManagement = () => {
  const queryClient = useQueryClient();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);

  useEffect(() => {
    checkSuperAdmin();
  }, []);

  const checkSuperAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.rpc("is_super_admin", { _user_id: user.id });
    setIsSuperAdmin(!!data);
  };

  const { data: users, isLoading } = useQuery<UserWithDetails[]>({
    queryKey: ["admin-users"],
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<UserWithDetails[]> => {
      // Get profiles with is_disabled column
      const { data: profilesData, error: profileError } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          phone,
          email,
          created_at,
          is_disabled
        `)
        .order("created_at", { ascending: false });

      if (profileError) throw profileError;
      if (!profilesData) return [];
      
      // Get roles from user_roles table
      const usersWithDetails: UserWithDetails[] = await Promise.all(
        profilesData.map(async (profile) => {
          // Fetch ALL roles from user_roles table
          const { data: rolesData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id);
          
          // Get unique active farms (owned or member of)
          const { data: farmsOwnedData } = await supabase
            .from("farms")
            .select("id")
            .eq("owner_id", profile.id)
            .eq("is_deleted", false);
          
          const { data: farmMembershipsData } = await supabase
            .from("farm_memberships")
            .select("farm_id, farms!inner(is_deleted)")
            .eq("user_id", profile.id)
            .eq("farms.is_deleted", false);
          
          // Deduplicate farm IDs (user can be owner AND member of same farm)
          const ownedFarmIds = (farmsOwnedData || []).map(f => f.id);
          const memberFarmIds = (farmMembershipsData || []).map(m => m.farm_id);
          const uniqueFarmIds = new Set([...ownedFarmIds, ...memberFarmIds]);
          
          return {
            id: profile.id,
            full_name: profile.full_name,
            phone: profile.phone,
            roles: (rolesData || []).map(r => r.role as UserRole),
            created_at: profile.created_at,
            email: profile.email || "N/A",
            farm_count: uniqueFarmIds.size,
            is_disabled: profile.is_disabled || false
          };
        })
      );

      return usersWithDetails;
    },
  });

  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const { error } = await supabase
        .rpc("admin_assign_role", {
          _user_id: userId,
          _role: role
        });

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.refetchQueries({ queryKey: ["admin-users"] });
      toast({
        title: "Role Added",
        description: "User role has been successfully added.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add user role: " + error.message,
        variant: "destructive",
      });
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const { error } = await supabase
        .rpc("admin_remove_role", {
          _user_id: userId,
          _role: role
        });

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.refetchQueries({ queryKey: ["admin-users"] });
      toast({
        title: "Role Removed",
        description: "User role has been successfully removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove user role: " + error.message,
        variant: "destructive",
      });
    },
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "government":
        return "default";
      case "farmer_owner":
        return "default";
      case "vet":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading users...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Manage user accounts and permissions</CardDescription>
          </div>
          <CreateUserDialog 
            onUserCreated={() => queryClient.invalidateQueries({ queryKey: ["admin-users"] })}
            isSuperAdmin={isSuperAdmin}
          />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Farms</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.id} className={user.is_disabled ? "opacity-50" : ""}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {user.full_name || "Unnamed"}
                    {user.is_disabled && (
                      <Badge variant="destructive" className="text-xs">
                        <Ban className="h-3 w-3 mr-1" />
                        Disabled
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.phone || "N/A"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map((role) => (
                      <Badge 
                        key={role} 
                        variant={getRoleBadgeVariant(role)}
                        className="cursor-pointer hover:opacity-80"
                        onClick={() => {
                          if (user.roles.length > 1) {
                            removeRoleMutation.mutate({ userId: user.id, role });
                          } else {
                            toast({
                              title: "Cannot Remove",
                              description: "User must have at least one role.",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        {role} ×
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{user.farm_count}</TableCell>
                <TableCell>
                  {new Date(user.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUserId(user.id);
                        setDetailPanelOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Select
                      disabled={addRoleMutation.isPending || removeRoleMutation.isPending}
                      onValueChange={(newRole) => {
                        if (!user.roles.includes(newRole as UserRole)) {
                          addRoleMutation.mutate({
                            userId: user.id,
                            role: newRole as UserRole,
                          });
                        } else {
                          toast({
                            title: "Role Exists",
                            description: "User already has this role.",
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Add role..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="farmer_owner">Farmer Owner</SelectItem>
                        <SelectItem value="farmhand">Farmhand</SelectItem>
                        <SelectItem value="merchant">Merchant</SelectItem>
                        <SelectItem value="vet">Veterinarian</SelectItem>
                        {isSuperAdmin && (
                          <>
                            <SelectItem value="government">Government</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* User Detail Panel */}
      <UserDetailPanel
        userId={selectedUserId}
        open={detailPanelOpen}
        onOpenChange={(open) => {
          setDetailPanelOpen(open);
          if (!open) setSelectedUserId(null);
        }}
      />
    </Card>
  );
};
