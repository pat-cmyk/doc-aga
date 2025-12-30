import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Search, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface UserRoleData {
  id: string;
  email: string | null;
  full_name: string | null;
  globalRoles: { role: string; id: string }[];
  farmMemberships: {
    id: string;
    role_in_farm: string;
    invitation_status: string;
    farm: { id: string; name: string } | null;
  }[];
  ownedFarms: { id: string; name: string }[];
  conflicts: string[];
}

export const RoleDebugger = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showConflictsOnly, setShowConflictsOnly] = useState(true);
  const queryClient = useQueryClient();

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ["admin-role-debug"],
    queryFn: async () => {
      // Fetch profiles with user_roles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id,
          email,
          full_name
        `);

      if (profilesError) throw profilesError;

      // Fetch user_roles separately
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("id, user_id, role");

      if (rolesError) throw rolesError;

      // Fetch farm_memberships separately
      const { data: memberships, error: membershipsError } = await supabase
        .from("farm_memberships")
        .select(`
          id,
          user_id,
          role_in_farm,
          invitation_status,
          farm_id
        `);

      if (membershipsError) throw membershipsError;

      // Fetch farms for names and ownership
      const { data: farms, error: farmsError } = await supabase
        .from("farms")
        .select("id, name, owner_id")
        .eq("is_deleted", false);

      if (farmsError) throw farmsError;

      // Build user data with conflicts
      const usersWithRoles: UserRoleData[] = (profiles || []).map((profile) => {
        const globalRoles = (userRoles || [])
          .filter((r) => r.user_id === profile.id)
          .map((r) => ({ role: r.role, id: r.id }));

        const farmMemberships = (memberships || [])
          .filter((m) => m.user_id === profile.id)
          .map((m) => {
            const farm = farms?.find((f) => f.id === m.farm_id);
            return {
              id: m.id,
              role_in_farm: m.role_in_farm,
              invitation_status: m.invitation_status || "pending",
              farm: farm ? { id: farm.id, name: farm.name } : null,
            };
          });

        const ownedFarms = (farms || [])
          .filter((f) => f.owner_id === profile.id)
          .map((f) => ({ id: f.id, name: f.name }));

        // Detect conflicts
        const conflicts: string[] = [];
        const globalRoleNames = globalRoles.map((r) => r.role);

        // farmer_owner in user_roles but doesn't own farms
        if (globalRoleNames.includes("farmer_owner")) {
          const hasOwnerMembership = farmMemberships.some(
            (m) => m.role_in_farm === "farmer_owner" && m.invitation_status === "accepted"
          );
          if (ownedFarms.length === 0 && !hasOwnerMembership) {
            conflicts.push("farmer_owner in user_roles without farm ownership");
          }
        }

        // farmhand in user_roles - should only be in farm_memberships
        if (globalRoleNames.includes("farmhand")) {
          conflicts.push("farmhand in user_roles (should be in farm_memberships only)");
        }

        // vet in user_roles - should only be in farm_memberships
        if (globalRoleNames.includes("vet")) {
          conflicts.push("vet in user_roles (should be in farm_memberships only)");
        }

        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          globalRoles,
          farmMemberships,
          ownedFarms,
          conflicts,
        };
      });

      return usersWithRoles;
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase.rpc("admin_remove_role", {
        _user_id: userId,
        _role: role as "admin" | "distributor" | "farmer_owner" | "farmhand" | "government" | "merchant" | "vet",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-role-debug"] });
      toast.success("Role removed successfully");
    },
    onError: (error) => {
      toast.error("Failed to remove role: " + error.message);
    },
  });

  const filteredUsers = users?.filter((user) => {
    const matchesSearch =
      !searchTerm ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesConflictFilter = !showConflictsOnly || user.conflicts.length > 0;

    return matchesSearch && matchesConflictFilter;
  });

  const totalConflicts = users?.filter((u) => u.conflicts.length > 0).length || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Role Debugger
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email, name, or user ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant={showConflictsOnly ? "default" : "outline"}
            onClick={() => setShowConflictsOnly(!showConflictsOnly)}
          >
            {showConflictsOnly ? "Showing Conflicts Only" : "Show All Users"}
            {totalConflicts > 0 && (
              <Badge variant="destructive" className="ml-2">
                {totalConflicts}
              </Badge>
            )}
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : filteredUsers?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {showConflictsOnly ? "No role conflicts detected" : "No users found"}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Global Roles (user_roles)</TableHead>
                  <TableHead>Farm Memberships</TableHead>
                  <TableHead>Owned Farms</TableHead>
                  <TableHead>Conflicts</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers?.map((user) => (
                  <TableRow key={user.id} className={user.conflicts.length > 0 ? "bg-destructive/5" : ""}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{user.full_name || "No name"}</span>
                        <span className="text-sm text-muted-foreground">{user.email}</span>
                        <span className="text-xs font-mono text-muted-foreground">{user.id.slice(0, 8)}...</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.globalRoles.length === 0 ? (
                          <span className="text-muted-foreground text-sm">None</span>
                        ) : (
                          user.globalRoles.map((r) => (
                            <Badge
                              key={r.id}
                              variant={
                                r.role === "admin"
                                  ? "default"
                                  : ["farmer_owner", "farmhand", "vet"].includes(r.role)
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {r.role}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {user.farmMemberships.length === 0 ? (
                          <span className="text-muted-foreground text-sm">None</span>
                        ) : (
                          user.farmMemberships.map((m) => (
                            <div key={m.id} className="flex items-center gap-1">
                              <Badge variant="outline">{m.role_in_farm}</Badge>
                              <span className="text-sm">@ {m.farm?.name || "Unknown"}</span>
                              {m.invitation_status !== "accepted" && (
                                <Badge variant="secondary" className="text-xs">
                                  {m.invitation_status}
                                </Badge>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {user.ownedFarms.length === 0 ? (
                          <span className="text-muted-foreground text-sm">None</span>
                        ) : (
                          user.ownedFarms.map((f) => (
                            <span key={f.id} className="text-sm">
                              {f.name}
                            </span>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.conflicts.length === 0 ? (
                        <span className="text-success text-sm">✓ Clean</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {user.conflicts.map((c, i) => (
                            <span key={i} className="text-sm text-destructive">
                              ⚠ {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {user.globalRoles
                          .filter((r) => ["farmer_owner", "farmhand", "vet"].includes(r.role))
                          .map((r) => (
                            <Button
                              key={r.id}
                              variant="ghost"
                              size="sm"
                              className="h-7 text-destructive hover:text-destructive"
                              onClick={() =>
                                removeRoleMutation.mutate({ userId: user.id, role: r.role })
                              }
                              disabled={removeRoleMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Remove {r.role}
                            </Button>
                          ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
          <strong>Legend:</strong>
          <ul className="mt-2 space-y-1">
            <li>
              <Badge variant="default">admin</Badge> - Global admin role (correct in user_roles)
            </li>
            <li>
              <Badge variant="secondary">merchant/government</Badge> - Global roles (correct in user_roles)
            </li>
            <li>
              <Badge variant="destructive">farmer_owner/farmhand/vet</Badge> - Farm-specific roles (should be in
              farm_memberships, not user_roles)
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
