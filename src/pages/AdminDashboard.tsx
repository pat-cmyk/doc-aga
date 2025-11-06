import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
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
import { ComparisonSummary } from "@/components/government/ComparisonSummary";
import { useGovernmentStats, useHealthHeatmap, useGovernmentStatsTimeseries } from "@/hooks/useGovernmentStats";
import { useRegions } from "@/hooks/useRegions";
import { TabsContent } from "@/components/ui/tabs";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { subDays, format, startOfYear, isValid, parse } from "date-fns";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Date range presets
const datePresets = {
  last7Days: () => ({
    from: subDays(new Date(), 7),
    to: new Date(),
  }),
  last30Days: () => ({
    from: subDays(new Date(), 30),
    to: new Date(),
  }),
  last90Days: () => ({
    from: subDays(new Date(), 90),
    to: new Date(),
  }),
  thisYear: () => ({
    from: startOfYear(new Date()),
    to: new Date(),
  }),
};

const AdminDashboard = () => {
  const { isAdmin, isLoading } = useAdminAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const isInitialLoad = useRef(true);
  
  // Date range state for government tab (default to last 30 days)
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    datePresets.last30Days()
  );
  const [activePreset, setActivePreset] = useState<string | null>("last30Days");
  const [selectedRegion, setSelectedRegion] = useState<string | undefined>(undefined);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonDateRange, setComparisonDateRange] = useState<DateRange | undefined>(
    datePresets.last90Days()
  );
  const [comparisonPreset, setComparisonPreset] = useState<string | null>("last90Days");
  const [comparisonRegion, setComparisonRegion] = useState<string | undefined>(undefined);
  
  // Fetch available regions
  const { data: regions } = useRegions();

  // Helper function to detect preset from date range
  const detectPreset = (range: DateRange | undefined): string | null => {
    if (!range?.from || !range?.to) return null;
    
    const presetKeys = ['last7Days', 'last30Days', 'last90Days', 'thisYear'] as const;
    
    for (const key of presetKeys) {
      const preset = datePresets[key]();
      if (
        format(preset.from, 'yyyy-MM-dd') === format(range.from, 'yyyy-MM-dd') &&
        format(preset.to, 'yyyy-MM-dd') === format(range.to, 'yyyy-MM-dd')
      ) {
        return key;
      }
    }
    
    return null;
  };

  // Initialize state from URL parameters on mount
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) setActiveTab(tabParam);
    
    const compareParam = searchParams.get('compare');
    if (compareParam === 'true') setComparisonMode(true);
    
    // Parse primary date range
    const pStart = searchParams.get('p_start');
    const pEnd = searchParams.get('p_end');
    if (pStart && pEnd) {
      const startDate = parse(pStart, 'yyyy-MM-dd', new Date());
      const endDate = parse(pEnd, 'yyyy-MM-dd', new Date());
      if (isValid(startDate) && isValid(endDate)) {
        const range = { from: startDate, to: endDate };
        setDateRange(range);
        const preset = detectPreset(range);
        setActivePreset(preset);
      }
    }
    
    // Parse primary preset (fallback if no dates)
    const pPreset = searchParams.get('p_preset');
    if (pPreset && !pStart && !pEnd) {
      if (pPreset in datePresets) {
        setDateRange(datePresets[pPreset as keyof typeof datePresets]());
        setActivePreset(pPreset);
      }
    }
    
    // Parse primary region
    const pRegion = searchParams.get('p_region');
    if (pRegion) setSelectedRegion(pRegion);
    
    // Parse comparison date range
    const cStart = searchParams.get('c_start');
    const cEnd = searchParams.get('c_end');
    if (cStart && cEnd) {
      const startDate = parse(cStart, 'yyyy-MM-dd', new Date());
      const endDate = parse(cEnd, 'yyyy-MM-dd', new Date());
      if (isValid(startDate) && isValid(endDate)) {
        const range = { from: startDate, to: endDate };
        setComparisonDateRange(range);
        const preset = detectPreset(range);
        setComparisonPreset(preset);
      }
    }
    
    // Parse comparison preset
    const cPreset = searchParams.get('c_preset');
    if (cPreset && !cStart && !cEnd) {
      if (cPreset in datePresets) {
        setComparisonDateRange(datePresets[cPreset as keyof typeof datePresets]());
        setComparisonPreset(cPreset);
      }
    }
    
    // Parse comparison region
    const cRegion = searchParams.get('c_region');
    if (cRegion) setComparisonRegion(cRegion);
    
    isInitialLoad.current = false;
  }, []);

  // Update URL when state changes (after initial load)
  useEffect(() => {
    if (isInitialLoad.current) return;

    const params = new URLSearchParams();
    
    // Update tab
    params.set('tab', activeTab);
    
    // Update comparison mode
    if (comparisonMode) {
      params.set('compare', 'true');
    }
    
    // Update primary date range
    if (dateRange?.from && dateRange?.to) {
      params.set('p_start', format(dateRange.from, 'yyyy-MM-dd'));
      params.set('p_end', format(dateRange.to, 'yyyy-MM-dd'));
    }
    
    // Update primary preset
    if (activePreset) {
      params.set('p_preset', activePreset);
    }
    
    // Update primary region
    if (selectedRegion) {
      params.set('p_region', selectedRegion);
    }
    
    // Update comparison date range (only if comparison mode is on)
    if (comparisonMode && comparisonDateRange?.from && comparisonDateRange?.to) {
      params.set('c_start', format(comparisonDateRange.from, 'yyyy-MM-dd'));
      params.set('c_end', format(comparisonDateRange.to, 'yyyy-MM-dd'));
    }
    
    // Update comparison preset
    if (comparisonMode && comparisonPreset) {
      params.set('c_preset', comparisonPreset);
    }
    
    // Update comparison region
    if (comparisonMode && comparisonRegion) {
      params.set('c_region', comparisonRegion);
    }
    
    setSearchParams(params, { replace: true });
  }, [
    activeTab, 
    comparisonMode, 
    dateRange, 
    activePreset, 
    selectedRegion, 
    comparisonDateRange, 
    comparisonPreset, 
    comparisonRegion,
    setSearchParams
  ]);

  // Stabilize date range to prevent constant re-renders
  const startDate = useMemo(() => dateRange?.from || subDays(new Date(), 30), [dateRange?.from]);
  const endDate = useMemo(() => dateRange?.to || new Date(), [dateRange?.to]);

  // Comparison date range
  const comparisonStartDate = useMemo(() => comparisonDateRange?.from || subDays(new Date(), 90), [comparisonDateRange?.from]);
  const comparisonEndDate = useMemo(() => comparisonDateRange?.to || new Date(), [comparisonDateRange?.to]);

  // Calculate days for heatmap
  const daysBack = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 7;
    const diff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  }, [dateRange]);

  const comparisonDaysBack = useMemo(() => {
    if (!comparisonDateRange?.from || !comparisonDateRange?.to) return 7;
    const diff = Math.ceil((comparisonDateRange.to.getTime() - comparisonDateRange.from.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  }, [comparisonDateRange]);

  // Government dashboard data - only fetch when on government tab
  const { data: govStats, isLoading: govStatsLoading, error: govStatsError } = useGovernmentStats(
    startDate, 
    endDate,
    selectedRegion,
    { enabled: activeTab === 'government' && isAdmin }
  );
  const { data: heatmapData, isLoading: heatmapLoading, error: heatmapError } = useHealthHeatmap(
    daysBack,
    selectedRegion,
    { enabled: activeTab === 'government' && isAdmin }
  );
  const { data: timeseriesData, isLoading: timeseriesLoading, error: timeseriesError } = useGovernmentStatsTimeseries(
    startDate,
    endDate,
    selectedRegion,
    { enabled: activeTab === 'government' && isAdmin }
  );

  // Comparison data - only fetch when comparison mode is enabled
  const { data: comparisonGovStats, isLoading: comparisonGovStatsLoading } = useGovernmentStats(
    comparisonStartDate,
    comparisonEndDate,
    comparisonRegion,
    { enabled: activeTab === 'government' && isAdmin && comparisonMode }
  );
  const { data: comparisonHeatmapData, isLoading: comparisonHeatmapLoading } = useHealthHeatmap(
    comparisonDaysBack,
    comparisonRegion,
    { enabled: activeTab === 'government' && isAdmin && comparisonMode }
  );
  const { data: comparisonTimeseriesData, isLoading: comparisonTimeseriesLoading } = useGovernmentStatsTimeseries(
    comparisonStartDate,
    comparisonEndDate,
    comparisonRegion,
    { enabled: activeTab === 'government' && isAdmin && comparisonMode }
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Government Dashboard</h2>
              <p className="text-muted-foreground text-sm sm:text-base">
                Livestock industry insights for policy and program planning
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2 min-h-[44px]">
                <Switch
                  id="comparison-mode"
                  checked={comparisonMode}
                  onCheckedChange={setComparisonMode}
                  className="data-[state=checked]:bg-primary"
                />
                <Label htmlFor="comparison-mode" className="cursor-pointer text-sm sm:text-base">
                  Compare Mode
                </Label>
              </div>
            </div>
          </div>

          {/* Primary Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
            <Badge variant="default" className="px-3 py-1.5 w-fit">Primary</Badge>
              <Select 
                value={selectedRegion || "all"} 
                onValueChange={(value) => setSelectedRegion(value === "all" ? undefined : value)}
              >
                <SelectTrigger className="w-full sm:w-[200px] min-h-[44px]">
                  <SelectValue placeholder="All Regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {regions?.map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full sm:w-auto justify-start text-left font-normal min-h-[44px]",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="truncate">
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          <span className="hidden sm:inline">
                            {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                          </span>
                          <span className="sm:hidden">
                            {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd")}
                          </span>
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 max-w-[95vw]" align="end">
                <div className="p-3 border-b space-y-2">
                  <div className="text-sm font-medium mb-2">Quick Select</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      variant={activePreset === 'last7Days' ? 'default' : 'outline'}
                      size="sm"
                      className="min-h-[44px]"
                      onClick={() => {
                        setDateRange(datePresets.last7Days());
                        setActivePreset('last7Days');
                      }}
                    >
                      Last 7 days
                    </Button>
                    <Button
                      variant={activePreset === 'last30Days' ? 'default' : 'outline'}
                      size="sm"
                      className="min-h-[44px]"
                      onClick={() => {
                        setDateRange(datePresets.last30Days());
                        setActivePreset('last30Days');
                      }}
                    >
                      Last 30 days
                    </Button>
                    <Button
                      variant={activePreset === 'last90Days' ? 'default' : 'outline'}
                      size="sm"
                      className="min-h-[44px]"
                      onClick={() => {
                        setDateRange(datePresets.last90Days());
                        setActivePreset('last90Days');
                      }}
                    >
                      Last 90 days
                    </Button>
                    <Button
                      variant={activePreset === 'thisYear' ? 'default' : 'outline'}
                      size="sm"
                      className="min-h-[44px]"
                      onClick={() => {
                        setDateRange(datePresets.thisYear());
                        setActivePreset('thisYear');
                      }}
                    >
                      This year
                    </Button>
                  </div>
                </div>
                
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={(range) => {
                    setDateRange(range);
                    setActivePreset(null);
                  }}
                  numberOfMonths={typeof window !== 'undefined' && window.innerWidth < 768 ? 1 : 2}
                  disabled={(date) => date > new Date()}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
              </Popover>
          </div>

          {/* Comparison Filters */}
          {comparisonMode && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap border-t pt-4">
              <Badge variant="secondary" className="px-3 py-1.5 w-fit">Comparison</Badge>
              
              <Select 
                value={comparisonRegion || "all"} 
                onValueChange={(value) => setComparisonRegion(value === "all" ? undefined : value)}
              >
                <SelectTrigger className="w-full sm:w-[200px] min-h-[44px]">
                  <SelectValue placeholder="All Regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {regions?.map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-auto justify-start text-left font-normal min-h-[44px]",
                      !comparisonDateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">
                      {comparisonDateRange?.from ? (
                        comparisonDateRange.to ? (
                          <>
                            <span className="hidden sm:inline">
                              {format(comparisonDateRange.from, "LLL dd, y")} - {format(comparisonDateRange.to, "LLL dd, y")}
                            </span>
                            <span className="sm:hidden">
                              {format(comparisonDateRange.from, "MMM dd")} - {format(comparisonDateRange.to, "MMM dd")}
                            </span>
                          </>
                        ) : (
                          format(comparisonDateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 max-w-[95vw]" align="end">
                  <div className="p-3 border-b space-y-2">
                    <div className="text-sm font-medium mb-2">Quick Select</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button
                        variant={comparisonPreset === 'last7Days' ? 'default' : 'outline'}
                        size="sm"
                        className="min-h-[44px]"
                        onClick={() => {
                          setComparisonDateRange(datePresets.last7Days());
                          setComparisonPreset('last7Days');
                        }}
                      >
                        Last 7 days
                      </Button>
                      <Button
                        variant={comparisonPreset === 'last30Days' ? 'default' : 'outline'}
                        size="sm"
                        className="min-h-[44px]"
                        onClick={() => {
                          setComparisonDateRange(datePresets.last30Days());
                          setComparisonPreset('last30Days');
                        }}
                      >
                        Last 30 days
                      </Button>
                      <Button
                        variant={comparisonPreset === 'last90Days' ? 'default' : 'outline'}
                        size="sm"
                        className="min-h-[44px]"
                        onClick={() => {
                          setComparisonDateRange(datePresets.last90Days());
                          setComparisonPreset('last90Days');
                        }}
                      >
                        Last 90 days
                      </Button>
                      <Button
                        variant={comparisonPreset === 'thisYear' ? 'default' : 'outline'}
                        size="sm"
                        className="min-h-[44px]"
                        onClick={() => {
                          setComparisonDateRange(datePresets.thisYear());
                          setComparisonPreset('thisYear');
                        }}
                      >
                        This year
                      </Button>
                    </div>
                  </div>
                  
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={comparisonDateRange?.from}
                    selected={comparisonDateRange}
                    onSelect={(range) => {
                      setComparisonDateRange(range);
                      setComparisonPreset(null);
                    }}
                    numberOfMonths={typeof window !== 'undefined' && window.innerWidth < 768 ? 1 : 2}
                    disabled={(date) => date > new Date()}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Comparison Summary */}
          {comparisonMode && (
            <ComparisonSummary
              primaryStats={govStats}
              comparisonStats={comparisonGovStats}
              primaryDateRange={dateRange}
              comparisonDateRange={comparisonDateRange}
              primaryRegion={selectedRegion}
              comparisonRegion={comparisonRegion}
              isLoading={govStatsLoading || comparisonGovStatsLoading}
              comparisonMode={comparisonMode}
            />
          )}

          <GovDashboardOverview 
            stats={govStats as any} 
            comparisonStats={comparisonGovStats as any}
            isLoading={govStatsLoading || (comparisonMode && comparisonGovStatsLoading)} 
            error={govStatsError}
            comparisonMode={comparisonMode}
          />
          
          <GovTrendCharts 
            data={timeseriesData as any} 
            comparisonData={comparisonTimeseriesData as any}
            isLoading={timeseriesLoading || (comparisonMode && comparisonTimeseriesLoading)} 
            error={timeseriesError}
            comparisonMode={comparisonMode}
          />
          
          <div className="grid gap-6 md:grid-cols-2">
            <AnimalHealthHeatmap 
              data={heatmapData as any} 
              comparisonData={comparisonHeatmapData as any}
              isLoading={heatmapLoading || (comparisonMode && comparisonHeatmapLoading)} 
              error={heatmapError}
              comparisonMode={comparisonMode}
            />
            <FarmerQueriesTopics 
              startDate={startDate} 
              endDate={endDate}
              comparisonStartDate={comparisonStartDate}
              comparisonEndDate={comparisonEndDate}
              enabled={activeTab === 'government'}
              comparisonMode={comparisonMode}
            />
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
