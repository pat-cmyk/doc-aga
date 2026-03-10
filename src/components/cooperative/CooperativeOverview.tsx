import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, PawPrint, Milk, AlertTriangle } from "lucide-react";
import {
  useCooperativeMemberFarms,
  useCooperativeHerdSummary,
  useCooperativeMilkProduction,
  useCooperativeHealthOverview,
} from "@/hooks/useCooperative";

interface Props {
  cooperativeId: string;
}

export const CooperativeOverview = ({ cooperativeId }: Props) => {
  const { data: farms, isLoading: farmsLoading } = useCooperativeMemberFarms(cooperativeId);
  const { data: herd, isLoading: herdLoading, isError: herdError } = useCooperativeHerdSummary(cooperativeId);
  const { data: milk, isLoading: milkLoading, isError: milkError } = useCooperativeMilkProduction(cooperativeId, 30);
  const { data: health, isLoading: healthLoading, isError: healthError } = useCooperativeHealthOverview(cooperativeId);

  const acceptedFarms = farms?.filter((f: any) => f.invitation_status === "accepted") || [];
  const isLoading = farmsLoading || herdLoading || milkLoading || healthLoading;
  const hasErrors = herdError || milkError || healthError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const cards = [
    {
      title: "Member Farms",
      value: acceptedFarms.length,
      icon: Users,
      description: `${farms?.filter((f: any) => f.invitation_status === "pending").length || 0} pending invitations`,
    },
    {
      title: "Total Animals",
      value: herdError ? "—" : (herd?.total_animals ?? 0),
      icon: PawPrint,
      description: herdError
        ? "Failed to load"
        : herd?.by_species?.map((s: any) => `${s.count} ${s.species}`).join(", ") || "No animals",
    },
    {
      title: "Milk (30 days)",
      value: milkError ? "—" : `${(milk?.total_liters ?? 0).toFixed(1)} L`,
      icon: Milk,
      description: milkError
        ? "Failed to load"
        : `From ${milk?.by_farm?.length ?? 0} farms`,
    },
    {
      title: "Health Records (30d)",
      value: healthError ? "—" : (health?.total_records_30d ?? 0),
      icon: AlertTriangle,
      description: healthError
        ? "Failed to load"
        : `${health?.mortality_30d ?? 0} mortalities`,
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Overview</h2>

      {hasErrors && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium">Some metrics could not be loaded</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Data shown may be incomplete. Please try refreshing the page.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {acceptedFarms.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">No Member Farms Yet</h3>
            <p className="text-muted-foreground mt-2">
              Go to the Settings tab to invite farms to your cooperative.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
