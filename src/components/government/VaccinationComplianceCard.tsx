import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Syringe, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { GovernmentHealthStats } from "@/hooks/useGovernmentHealthStats";

interface VaccinationComplianceCardProps {
  stats: GovernmentHealthStats | null;
  isLoading: boolean;
}

export function VaccinationComplianceCard({ stats, isLoading }: VaccinationComplianceCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const complianceRate = stats?.vaccination_compliance_rate || 0;
  const totalVaccinations = (stats?.scheduled_vaccinations || 0) + (stats?.completed_vaccinations || 0);
  const totalDeworming = (stats?.scheduled_deworming || 0) + (stats?.completed_deworming || 0);

  const getComplianceColor = (rate: number) => {
    if (rate >= 80) return "text-green-600";
    if (rate >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getProgressColor = (rate: number) => {
    if (rate >= 80) return "bg-green-500";
    if (rate >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Syringe className="h-4 w-4 text-primary" />
          Preventive Health Compliance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Compliance Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Vaccination Compliance</span>
            <span className={`text-lg font-bold ${getComplianceColor(complianceRate)}`}>
              {complianceRate.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={complianceRate} 
            className="h-2"
            style={{ 
              ['--progress-background' as string]: getProgressColor(complianceRate) 
            }}
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Vaccinations */}
          <div className="space-y-2 p-3 rounded-lg bg-muted/50">
            <p className="text-xs font-medium text-muted-foreground uppercase">Vaccinations</p>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">{stats?.completed_vaccinations || 0} completed</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm">{stats?.scheduled_vaccinations || 0} scheduled</span>
            </div>
            {(stats?.overdue_vaccinations || 0) > 0 && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-600">{stats?.overdue_vaccinations} overdue</span>
              </div>
            )}
          </div>

          {/* Deworming */}
          <div className="space-y-2 p-3 rounded-lg bg-muted/50">
            <p className="text-xs font-medium text-muted-foreground uppercase">Deworming</p>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">{stats?.completed_deworming || 0} completed</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm">{stats?.scheduled_deworming || 0} scheduled</span>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Total: {totalVaccinations} vaccination records • {totalDeworming} deworming records
        </div>
      </CardContent>
    </Card>
  );
}
