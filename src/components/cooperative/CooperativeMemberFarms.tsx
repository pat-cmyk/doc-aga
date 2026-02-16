import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin } from "lucide-react";
import { useCooperativeMemberFarms } from "@/hooks/useCooperative";

interface Props {
  cooperativeId: string;
}

export const CooperativeMemberFarms = ({ cooperativeId }: Props) => {
  const { data: farms, isLoading } = useCooperativeMemberFarms(cooperativeId);

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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
