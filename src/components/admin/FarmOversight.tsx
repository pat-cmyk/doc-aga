import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Ban, Key, Trash2, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface FarmWithDetails {
  id: string;
  name: string;
  region: string | null;
  created_at: string;
  owner_id: string;
  owner_name: string | null;
  owner_email: string;
  owner_phone: string | null;
  animal_count: number;
  is_deleted: boolean;
}

export const FarmOversight = () => {
  const queryClient = useQueryClient();

  const { data: farms, isLoading } = useQuery<FarmWithDetails[]>({
    queryKey: ["admin-farms"],
    queryFn: async (): Promise<FarmWithDetails[]> => {
      const { data, error } = await supabase
        .from("farms")
        .select(`
          id,
          name,
          region,
          created_at,
          owner_id,
          is_deleted,
          profiles:owner_id (full_name, phone),
          animals:animals(count)
        `)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data) return [];

      const farmsData = data as Array<{
        id: string;
        name: string;
        region: string | null;
        created_at: string;
        owner_id: string;
        is_deleted: boolean;
        profiles: { full_name: string | null; phone: string | null } | null;
        animals: Array<{ count: number }>;
      }>;

      // Get emails from auth.users
      const authUsersResponse = await supabase.auth.admin.listUsers();
      const authUsers = authUsersResponse.data?.users || [];

      return farmsData.map((farm) => {
        const authUser = authUsers.find((u) => u.id === farm.owner_id);
        return {
          id: farm.id,
          name: farm.name,
          region: farm.region,
          created_at: farm.created_at,
          owner_id: farm.owner_id,
          owner_name: farm.profiles?.full_name || "Unknown",
          owner_email: authUser?.email || "N/A",
          owner_phone: farm.profiles?.phone || "N/A",
          animal_count: farm.animals?.[0]?.count || 0,
          is_deleted: farm.is_deleted,
        };
      });
    },
  });

  const deactivateFarmMutation = useMutation({
    mutationFn: async (farmId: string) => {
      const { error } = await supabase
        .from("farms")
        .update({ is_deleted: true })
        .eq("id", farmId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-farms"] });
      toast({
        title: "Success",
        description: "Farm deactivated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password reset email sent",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteFarmMutation = useMutation({
    mutationFn: async (farmId: string) => {
      const { error } = await supabase.from("farms").delete().eq("id", farmId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-farms"] });
      toast({
        title: "Success",
        description: "Farm deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading farms...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Farm Oversight</CardTitle>
        <CardDescription>Monitor and manage all farms in the system</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Farm Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Animals</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {farms?.map((farm) => (
              <TableRow key={farm.id}>
                <TableCell className="font-medium">{farm.name}</TableCell>
                <TableCell>{farm.owner_name}</TableCell>
                <TableCell>{farm.owner_email}</TableCell>
                <TableCell>{farm.owner_phone}</TableCell>
                <TableCell>{farm.region || "N/A"}</TableCell>
                <TableCell>{farm.animal_count}</TableCell>
                <TableCell>
                  {new Date(farm.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" title="Deactivate farm">
                          <Ban className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Deactivate Farm</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to deactivate "{farm.name}"? This will
                            soft delete the farm.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deactivateFarmMutation.mutate(farm.id)}
                          >
                            Deactivate
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Button
                      variant="ghost"
                      size="sm"
                      title="Reset password"
                      onClick={() => resetPasswordMutation.mutate(farm.owner_email)}
                    >
                      <Key className="h-4 w-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" title="Delete farm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Farm</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to permanently delete "{farm.name}"?
                            This action cannot be undone and will remove all associated
                            animals and records.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteFarmMutation.mutate(farm.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
