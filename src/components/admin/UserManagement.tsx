import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type UserRole = "admin" | "farmer_owner" | "farmhand" | "merchant" | "vet";

interface UserWithDetails {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
  email: string;
  farm_count: number;
}

export const UserManagement = () => {
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<UserWithDetails[]>({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<UserWithDetails[]> => {
      // Get profiles with email
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          phone,
          email,
          role,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (profileError) throw profileError;
      if (!data) return [];
      
      const profiles = data as Array<{
        id: string;
        full_name: string | null;
        phone: string | null;
        email: string | null;
        role: string;
        created_at: string;
      }>;
      
      // Get farm memberships and ownership counts
      const usersWithDetails: UserWithDetails[] = await Promise.all(
        profiles.map(async (profile): Promise<UserWithDetails> => {
          // Count farms owned
          const { count: farmsOwned } = await supabase
            .from("farms")
            .select("*", { count: "exact", head: true })
            .eq("owner_id", profile.id);
          
          // Count farm memberships
          const { count: farmMemberships } = await supabase
            .from("farm_memberships")
            .select("*", { count: "exact", head: true })
            .eq("user_id", profile.id);
          
          return {
            id: profile.id,
            full_name: profile.full_name,
            phone: profile.phone,
            role: profile.role as UserRole,
            created_at: profile.created_at,
            email: profile.email || "N/A",
            farm_count: (farmsOwned || 0) + (farmMemberships || 0)
          };
        })
      );

      return usersWithDetails;
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: UserRole }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: "Role Updated",
        description: "User role has been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update user role: " + error.message,
        variant: "destructive",
      });
    },
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
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
        <CardTitle>User Management</CardTitle>
        <CardDescription>Manage user accounts and permissions</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Farms</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.full_name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.phone || "N/A"}</TableCell>
                <TableCell>
                  <Badge variant={getRoleBadgeVariant(user.role)}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>{user.farm_count}</TableCell>
                <TableCell>
                  {new Date(user.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Select
                    value={user.role}
                    onValueChange={(newRole) =>
                      updateRoleMutation.mutate({
                        userId: user.id,
                        newRole: newRole as UserRole,
                      })
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="farmer_owner">Farmer Owner</SelectItem>
                      <SelectItem value="farmhand">Farmhand</SelectItem>
                      <SelectItem value="merchant">Merchant</SelectItem>
                      <SelectItem value="vet">Veterinarian</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
