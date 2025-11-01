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
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

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
  team_members_count: number;
  is_deleted: boolean;
}

export const FarmOversight = () => {
  const queryClient = useQueryClient();
  const [confirmationInput, setConfirmationInput] = useState<Record<string, string>>({});

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
          profiles:owner_id (full_name, phone, email),
          animals:animals(count),
          farm_memberships:farm_memberships(count)
        `)
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
        profiles: { full_name: string | null; phone: string | null; email: string | null } | null;
        animals: Array<{ count: number }>;
        farm_memberships: Array<{ count: number }>;
      }>;

      return farmsData.map((farm) => {
        return {
          id: farm.id,
          name: farm.name,
          region: farm.region,
          created_at: farm.created_at,
          owner_id: farm.owner_id,
          owner_name: farm.profiles?.full_name || "Unknown",
          owner_email: farm.profiles?.email || "N/A",
          owner_phone: farm.profiles?.phone || "N/A",
          animal_count: farm.animals?.[0]?.count || 0,
          team_members_count: farm.farm_memberships?.[0]?.count || 0,
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
        description: "Farm has been deactivated (soft-deleted)",
      });
    },
    onError: (error) => {
      console.error("Error deactivating farm:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate farm",
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
      const { data, error } = await supabase.functions.invoke('admin-permanent-delete-farm', {
        body: { farm_id: farmId },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-farms"] });
      toast({
        title: "Success",
        description: data?.message || "Farm has been permanently deleted",
      });
    },
    onError: (error: any) => {
      console.error("Error deleting farm:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete farm",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading farms...</div>;
  }

  return (
    <TooltipProvider>
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
                <TableHead>Team Members</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {farms?.map((farm) => {
              const canPermanentlyDelete = farm.is_deleted && farm.animal_count === 0;
              const confirmationKey = farm.id;
              const typedNameMatches = confirmationInput[confirmationKey]?.trim().toLowerCase() === farm.name.trim().toLowerCase();
              
              return (
                <TableRow key={farm.id}>
                  <TableCell className="font-medium">{farm.name}</TableCell>
                  <TableCell>{farm.owner_name}</TableCell>
                  <TableCell>{farm.owner_email}</TableCell>
                  <TableCell>{farm.owner_phone}</TableCell>
                  <TableCell>{farm.region || "N/A"}</TableCell>
                  <TableCell>{farm.animal_count}</TableCell>
                  <TableCell>{farm.team_members_count}</TableCell>
                  <TableCell>
                    <Badge variant={farm.is_deleted ? "destructive" : "default"}>
                      {farm.is_deleted ? "Deactivated" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(farm.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {!farm.is_deleted && (
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
                                Are you sure you want to deactivate "{farm.name}"? This is the first step before permanent deletion. The farm can be reactivated later if needed.
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
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        title={farm.owner_email === "N/A" || !farm.owner_email 
                          ? "Email not available" 
                          : "Reset password"}
                        onClick={() => {
                          if (farm.owner_email && farm.owner_email !== "N/A") {
                            resetPasswordMutation.mutate(farm.owner_email);
                          } else {
                            toast({
                              title: "Error",
                              description: "Cannot reset password: email not available",
                              variant: "destructive",
                            });
                          }
                        }}
                        disabled={farm.owner_email === "N/A" || !farm.owner_email}
                      >
                        <Key className="h-4 w-4" />
                      </Button>

                      <AlertDialog onOpenChange={(open) => {
                        if (!open) {
                          setConfirmationInput(prev => ({ ...prev, [confirmationKey]: "" }));
                        }
                      }}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  disabled={!canPermanentlyDelete}
                                  title="Permanently delete farm"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                            </span>
                          </TooltipTrigger>
                          {!canPermanentlyDelete && (
                            <TooltipContent>
                              {!farm.is_deleted && "Farm must be deactivated first"}
                              {farm.is_deleted && farm.animal_count > 0 && `Remove all ${farm.animal_count} animals first`}
                            </TooltipContent>
                          )}
                        </Tooltip>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>⚠️ Permanently Delete Farm</AlertDialogTitle>
                            <AlertDialogDescription asChild>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <p><strong>Farm:</strong> {farm.name}</p>
                                  <p>
                                    <strong>Status:</strong>{" "}
                                    <Badge variant={farm.is_deleted ? "destructive" : "default"}>
                                      {farm.is_deleted ? "Deactivated" : "Active"}
                                    </Badge>
                                  </p>
                                  <p><strong>Animals:</strong> {farm.animal_count}</p>
                                </div>
                                
                                <div className="border-l-4 border-destructive pl-4 space-y-2">
                                  <p className="font-semibold">Requirements:</p>
                                  <p className={farm.is_deleted ? "text-green-600" : "text-destructive"}>
                                    {farm.is_deleted ? "✓" : "✗"} Farm must be deactivated first
                                  </p>
                                  <p className={farm.animal_count === 0 ? "text-green-600" : "text-destructive"}>
                                    {farm.animal_count === 0 ? "✓" : "✗"} All animals must be removed
                                  </p>
                                </div>

                                <p className="text-destructive font-semibold">
                                  This action CANNOT be undone!
                                </p>

                                {canPermanentlyDelete && (
                                  <div className="space-y-2">
                                    <Label htmlFor={`confirm-${confirmationKey}`}>
                                      Type the farm name to confirm:
                                    </Label>
                                    <Input
                                      id={`confirm-${confirmationKey}`}
                                      value={confirmationInput[confirmationKey] || ""}
                                      onChange={(e) => setConfirmationInput(prev => ({ 
                                        ...prev, 
                                        [confirmationKey]: e.target.value 
                                      }))}
                                      placeholder={farm.name}
                                    />
                                  </div>
                                )}
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                deleteFarmMutation.mutate(farm.id);
                                setConfirmationInput(prev => ({ ...prev, [confirmationKey]: "" }));
                              }}
                              disabled={!canPermanentlyDelete || !typedNameMatches}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete Permanently
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};
