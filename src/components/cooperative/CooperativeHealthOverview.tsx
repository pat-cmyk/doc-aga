import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Skull, Stethoscope } from "lucide-react";
import { useCooperativeHealthOverview } from "@/hooks/useCooperative";

interface Props {
  cooperativeId: string;
}

export const CooperativeHealthOverview = ({ cooperativeId }: Props) => {
  const { data: health, isLoading } = useCooperativeHealthOverview(cooperativeId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Health Overview</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Health Records (30d)</CardTitle>
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.total_records_30d ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mortalities (30d)</CardTitle>
            <Skull className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.mortality_30d ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {health?.by_diagnosis && health.by_diagnosis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Diagnoses (90 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {health.by_diagnosis.map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{d.diagnosis}</span>
                  <span className="font-medium">{d.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
