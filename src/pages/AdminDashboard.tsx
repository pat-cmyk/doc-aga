import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SystemOverview } from "@/components/admin/SystemOverview";
import { UserManagement } from "@/components/admin/UserManagement";
import { FarmOversight } from "@/components/admin/FarmOversight";
import { DocAgaManagement } from "@/components/admin/DocAgaManagement";
import { SystemAdmin } from "@/components/admin/SystemAdmin";
import MerchantOversight from "@/components/admin/MerchantOversight";
import { QADashboard } from "@/components/admin/QADashboard";
import { UserActivityLogs } from "@/components/admin/UserActivityLogs";
import { GovDashboardOverview } from "@/components/government/GovDashboardOverview";
import { AnimalHealthHeatmap } from "@/components/government/AnimalHealthHeatmap";
import { FarmerQueriesTopics } from "@/components/government/FarmerQueriesTopics";
import { GovTrendCharts } from "@/components/government/GovTrendCharts";
import { useGovernmentStats, useHealthHeatmap, useGovernmentStatsTimeseries } from "@/hooks/useGovernmentStats";
import { TabsContent } from "@/components/ui/tabs";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { subDays, format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const AdminDashboard = () => {
  const { isAdmin, isLoading } = useAdminAccess();
  const [activeTab, setActiveTab] = useState("overview");
  
  // Date range state for government tab
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // Stabilize date range to prevent constant re-renders
  const startDate = useMemo(() => dateRange?.from || subDays(new Date(), 30), [dateRange?.from]);
  const endDate = useMemo(() => dateRange?.to || new Date(), [dateRange?.to]);

  // Calculate days for heatmap
  const daysBack = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 7;
    const diff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  }, [dateRange]);

  // Government dashboard data - only fetch when on government tab
  const { data: govStats, isLoading: govStatsLoading, error: govStatsError } = useGovernmentStats(
    startDate, 
    endDate,
    undefined,
    { enabled: activeTab === 'government' && isAdmin }
  );
  const { data: heatmapData, isLoading: heatmapLoading, error: heatmapError } = useHealthHeatmap(
    daysBack,
    undefined,
    { enabled: activeTab === 'government' && isAdmin }
  );
  const { data: timeseriesData, isLoading: timeseriesLoading, error: timeseriesError } = useGovernmentStatsTimeseries(
    startDate,
    endDate,
    undefined,
    { enabled: activeTab === 'government' && isAdmin }
  );

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // useAdminAccess hook already redirects if not admin
  // This is just a safety check
  if (!isAdmin) {
    return null;
  }

  return (
    <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
      <TabsContent value="overview">
        <SystemOverview />
      </TabsContent>
      
      <TabsContent value="users">
        <UserManagement />
      </TabsContent>
      
      <TabsContent value="farms">
        <FarmOversight />
      </TabsContent>

      <TabsContent value="government">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Government Dashboard</h2>
              <p className="text-muted-foreground">
                Livestock industry insights for policy and program planning
              </p>
            </div>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  disabled={(date) => date > new Date()}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <GovDashboardOverview stats={govStats as any} isLoading={govStatsLoading} error={govStatsError} />
          
          <GovTrendCharts data={timeseriesData as any} isLoading={timeseriesLoading} error={timeseriesError} />
          
          <div className="grid gap-6 md:grid-cols-2">
            <AnimalHealthHeatmap data={heatmapData as any} isLoading={heatmapLoading} error={heatmapError} />
            <FarmerQueriesTopics startDate={startDate} endDate={endDate} enabled={activeTab === 'government'} />
          </div>
        </div>
      </TabsContent>
      
      <TabsContent value="docaga">
        <DocAgaManagement />
      </TabsContent>
      
      <TabsContent value="merchants">
        <MerchantOversight />
      </TabsContent>
      
      <TabsContent value="qa">
        <QADashboard />
      </TabsContent>
      
      <TabsContent value="system">
        <SystemAdmin />
      </TabsContent>

      <TabsContent value="activity">
        <UserActivityLogs />
      </TabsContent>
    </AdminLayout>
  );
};

export default AdminDashboard;
