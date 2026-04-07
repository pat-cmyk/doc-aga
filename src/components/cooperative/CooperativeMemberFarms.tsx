import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, UserMinus } from "lucide-react";
import { useCooperativeMemberFarms } from "@/hooks/useCooperative";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  cooperativeId: string;
}

export const CooperativeMemberFarms = ({ cooperativeId }: Props) => {
  const { data: farms, isLoading } = useCooperativeMemberFarms(cooperativeId);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const removeMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const { data, error } = await supabase.rpc('remove_farm_from_cooperative', {
        _cooperative_id: cooperativeId,
        _membership_id: membershipId,
      });
      if (error) throw error;
      if (typeof data === 'string' && data.startsWith('error:')) {
        throw new Error(data.replace('error:', ''));
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cooperative-member-farms'] });
      toast({
        title: "Farm Removed",
        description: "The farm has been removed from the cooperative.",
      });
      setConfirmRemoveId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const acceptedFarms = farms?.filter((f: any) => f.invitation_status === "accepted") || [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Member Farms ({acceptedFarms.length})</h2>

      {acceptedFarms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No member farms yet. Invite farms from the Settings tab.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {acceptedFarms.map((farm: any) => (
            <Card key={farm.farm_id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{farm.farm_name}</CardTitle>
                  <Badge variant="secondary">{farm.animal_count} animals</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{[farm.municipality, farm.region].filter(Boolean).join(", ") || "No location"}</span>
                </div>
                {farm.accepted_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Joined {new Date(farm.accepted_at).toLocaleDateString()}
                  </p>
                )}
                {/* Remove Farm */}
                {confirmRemoveId === farm.membership_id ? (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <p className="text-xs text-destructive flex-1">Remove this farm?</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7"
                      onClick={() => setConfirmRemoveId(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="text-xs h-7"
                      disabled={removeMutation.isPending}
                      onClick={() => removeMutation.mutate(farm.membership_id)}
                    >
                      {removeMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Remove
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-6 text-muted-foreground hover:text-destructive mt-2 px-0"
                    onClick={() => setConfirmRemoveId(farm.membership_id)}
                  >
                    <UserMinus className="h-3 w-3 mr-1" />
                    Remove from cooperative
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
