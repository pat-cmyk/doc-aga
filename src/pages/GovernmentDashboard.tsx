import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { GovDashboardOverview } from "@/components/government/GovDashboardOverview";
import { AnimalHealthHeatmap } from "@/components/government/AnimalHealthHeatmap";
import { FarmerQueriesTopics } from "@/components/government/FarmerQueriesTopics";
import { useGovernmentStats, useHealthHeatmap } from "@/hooks/useGovernmentStats";
import { useGovernmentAccess } from "@/hooks/useGovernmentAccess";
import { subDays } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";

const GovernmentDashboard = () => {
  const { hasAccess, isLoading: accessLoading } = useGovernmentAccess();
  const [dateRange, setDateRange] = useState<"7" | "30" | "90">("30");
  const [region, setRegion] = useState<string | undefined>(undefined);

  // Stabilize date calculation to prevent constant re-renders
  const endDate = useMemo(() => new Date(), []);
  const startDate = useMemo(() => subDays(endDate, parseInt(dateRange)), [dateRange, endDate]);

  const { data: stats, isLoading: statsLoading, error: statsError } = useGovernmentStats(
    startDate,
    endDate,
    region
  );
  const { data: heatmapData, isLoading: heatmapLoading, error: heatmapError } = useHealthHeatmap(
    parseInt(dateRange),
    region
  );

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <AdminLayout activeTab="government" onTabChange={() => {}}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Government Dashboard</h1>
            <p className="text-muted-foreground">
              Livestock industry insights for policy and program planning
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={region || "all"} onValueChange={(v) => setRegion(v === "all" ? undefined : v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                <SelectItem value="NCR">NCR</SelectItem>
                <SelectItem value="CAR">CAR</SelectItem>
                <SelectItem value="Region I">Region I - Ilocos</SelectItem>
                <SelectItem value="Region II">Region II - Cagayan Valley</SelectItem>
                <SelectItem value="Region III">Region III - Central Luzon</SelectItem>
                <SelectItem value="Region IV-A">Region IV-A - CALABARZON</SelectItem>
                <SelectItem value="Region V">Region V - Bicol</SelectItem>
                <SelectItem value="Region VI">Region VI - Western Visayas</SelectItem>
                <SelectItem value="Region VII">Region VII - Central Visayas</SelectItem>
                <SelectItem value="Region VIII">Region VIII - Eastern Visayas</SelectItem>
                <SelectItem value="Region IX">Region IX - Zamboanga Peninsula</SelectItem>
                <SelectItem value="Region X">Region X - Northern Mindanao</SelectItem>
                <SelectItem value="Region XI">Region XI - Davao</SelectItem>
                <SelectItem value="Region XII">Region XII - SOCCSKSARGEN</SelectItem>
                <SelectItem value="Region XIII">Region XIII - Caraga</SelectItem>
                <SelectItem value="BARMM">BARMM</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <GovDashboardOverview stats={stats as any} isLoading={statsLoading} error={statsError} />

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <div className="min-w-0">
            <AnimalHealthHeatmap data={heatmapData as any} isLoading={heatmapLoading} error={heatmapError} />
          </div>
          <div className="min-w-0">
            <FarmerQueriesTopics startDate={startDate} endDate={endDate} />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>
              Additional features in development
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• FFEDIS Sync & Export - Farm registry export with QR codes</li>
              <li>• Program Impact Analysis - Compare pilot vs control groups</li>
              <li>• Priority Alerts - Automated outbreak spike detection</li>
              <li>• Production Trends - Regional milk yield comparisons</li>
              <li>• Procurement Validation - Cooperative accreditation tracking</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default GovernmentDashboard;
