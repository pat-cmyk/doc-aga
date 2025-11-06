import { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { GovernmentLayout } from "@/components/government/GovernmentLayout";
import { useRole } from "@/hooks/useRole";
import { GovDashboardOverview } from "@/components/government/GovDashboardOverview";
import { AnimalHealthHeatmap } from "@/components/government/AnimalHealthHeatmap";
import { FarmerQueriesTopics } from "@/components/government/FarmerQueriesTopics";
import { ComparisonSummary } from "@/components/government/ComparisonSummary";
import { GovTrendCharts } from "@/components/government/GovTrendCharts";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamically import the map component to reduce bundle size
const RegionalLivestockMap = lazy(() => import("@/components/government/RegionalLivestockMap"));
import { useGovernmentStats, useHealthHeatmap, useFarmerQueries, useGovernmentStatsTimeseries } from "@/hooks/useGovernmentStats";
import { useGovernmentAccess } from "@/hooks/useGovernmentAccess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { subDays, format, parse } from "date-fns";
import { useRegions } from "@/hooks/useRegions";
import { AlertCircle, TrendingUp, Activity, Users, FileText, Stethoscope, Download, Sparkles, BarChart3, HeartPulse, MessageSquare, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import { useToast } from "@/hooks/use-toast";

type DatePreset = "last7Days" | "last30Days" | "last90Days" | "custom";

const GovernmentDashboard = () => {
  const navigate = useNavigate();
  const { hasAccess, isLoading: accessLoading } = useGovernmentAccess();
  const { roles, isLoading: rolesLoading } = useRole();
  const { data: regions = [] } = useRegions();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  
  const isLoading = accessLoading || rolesLoading;

  // Initialize state from URL or defaults
  const [comparisonMode, setComparisonMode] = useState(() => searchParams.get("compare") === "true");
  
  const [primaryPreset, setPrimaryPreset] = useState<DatePreset>(() => 
    (searchParams.get("p_preset") as DatePreset) || "last30Days"
  );
  const [comparisonPreset, setComparisonPreset] = useState<DatePreset>(() => 
    (searchParams.get("c_preset") as DatePreset) || "last30Days"
  );

  const getDateRangeFromPreset = (preset: DatePreset) => {
    const end = new Date();
    let start = new Date();
    
    switch (preset) {
      case "last7Days":
        start = subDays(end, 7);
        break;
      case "last30Days":
        start = subDays(end, 30);
        break;
      case "last90Days":
        start = subDays(end, 90);
        break;
      default:
        start = subDays(end, 30);
    }
    
    return { start, end };
  };

  const [primaryDateRange, setPrimaryDateRange] = useState(() => {
    const startParam = searchParams.get("p_start");
    const endParam = searchParams.get("p_end");
    
    if (startParam && endParam) {
      return {
        start: parse(startParam, "yyyy-MM-dd", new Date()),
        end: parse(endParam, "yyyy-MM-dd", new Date())
      };
    }
    
    return getDateRangeFromPreset(primaryPreset);
  });

  const [comparisonDateRange, setComparisonDateRange] = useState(() => {
    const startParam = searchParams.get("c_start");
    const endParam = searchParams.get("c_end");
    
    if (startParam && endParam) {
      return {
        start: parse(startParam, "yyyy-MM-dd", new Date()),
        end: parse(endParam, "yyyy-MM-dd", new Date())
      };
    }
    
    return getDateRangeFromPreset(comparisonPreset);
  });

  const [primaryRegion, setPrimaryRegion] = useState<string | undefined>(() => 
    searchParams.get("p_region") || undefined
  );
  const [comparisonRegion, setComparisonRegion] = useState<string | undefined>(() => 
    searchParams.get("c_region") || undefined
  );

  // Update URL when state changes
  useMemo(() => {
    const params = new URLSearchParams();
    
    params.set("compare", comparisonMode.toString());
    params.set("p_preset", primaryPreset);
    params.set("p_start", format(primaryDateRange.start, "yyyy-MM-dd"));
    params.set("p_end", format(primaryDateRange.end, "yyyy-MM-dd"));
    if (primaryRegion) params.set("p_region", primaryRegion);
    
    if (comparisonMode) {
      params.set("c_preset", comparisonPreset);
      params.set("c_start", format(comparisonDateRange.start, "yyyy-MM-dd"));
      params.set("c_end", format(comparisonDateRange.end, "yyyy-MM-dd"));
      if (comparisonRegion) params.set("c_region", comparisonRegion);
    }
    
    setSearchParams(params, { replace: true });
  }, [comparisonMode, primaryPreset, primaryDateRange, primaryRegion, comparisonPreset, comparisonDateRange, comparisonRegion]);

  // Data fetching
  const { data: stats, isLoading: statsLoading, error: statsError } = useGovernmentStats(
    primaryDateRange.start,
    primaryDateRange.end,
    primaryRegion,
    { enabled: hasAccess }
  );

  const { data: comparisonStats, isLoading: comparisonStatsLoading } = useGovernmentStats(
    comparisonDateRange.start,
    comparisonDateRange.end,
    comparisonRegion,
    { enabled: hasAccess && comparisonMode }
  );

  const daysDiff = Math.ceil(
    (primaryDateRange.end.getTime() - primaryDateRange.start.getTime()) / (1000 * 60 * 60 * 24)
  );

  const { data: heatmapData, isLoading: heatmapLoading, error: heatmapError } = useHealthHeatmap(
    daysDiff,
    primaryRegion,
    { enabled: hasAccess }
  );

  const { data: comparisonHeatmapData, isLoading: comparisonHeatmapLoading } = useHealthHeatmap(
    daysDiff,
    comparisonRegion,
    { enabled: hasAccess && comparisonMode }
  );

  const { data: farmerQueries, isLoading: queriesLoading } = useFarmerQueries(
    primaryDateRange.start,
    primaryDateRange.end,
    { enabled: hasAccess }
  );

  const { data: comparisonFarmerQueries, isLoading: comparisonQueriesLoading } = useFarmerQueries(
    comparisonDateRange.start,
    comparisonDateRange.end,
    { enabled: hasAccess && comparisonMode }
  );

  const { data: timeseriesData, isLoading: timeseriesLoading } = useGovernmentStatsTimeseries(
    primaryDateRange.start,
    primaryDateRange.end,
    primaryRegion,
    { enabled: hasAccess }
  );

  const { data: comparisonTimeseriesData, isLoading: comparisonTimeseriesLoading } = useGovernmentStatsTimeseries(
    comparisonDateRange.start,
    comparisonDateRange.end,
    comparisonRegion,
    { enabled: hasAccess && comparisonMode }
  );

  const handleExportCSV = () => {
    try {
      exportToCSV({
        stats: stats || null,
        comparisonStats: comparisonStats || null,
        timeseriesData,
        comparisonTimeseriesData,
        heatmapData: heatmapData || [],
        comparisonHeatmapData: comparisonHeatmapData || [],
        farmerQueries: farmerQueries || [],
        comparisonFarmerQueries: comparisonFarmerQueries || [],
        dateRange: primaryDateRange,
        comparisonDateRange: comparisonMode ? comparisonDateRange : undefined,
        region: primaryRegion,
        comparisonRegion: comparisonMode ? comparisonRegion : undefined,
      });
      toast({
        title: "Export Successful",
        description: "Your CSV report has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error exporting your report.",
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = () => {
    try {
      exportToPDF({
        stats: stats || null,
        comparisonStats: comparisonStats || null,
        timeseriesData,
        comparisonTimeseriesData,
        heatmapData: heatmapData || [],
        comparisonHeatmapData: comparisonHeatmapData || [],
        farmerQueries: farmerQueries || [],
        comparisonFarmerQueries: comparisonFarmerQueries || [],
        dateRange: primaryDateRange,
        comparisonDateRange: comparisonMode ? comparisonDateRange : undefined,
        region: primaryRegion,
        comparisonRegion: comparisonMode ? comparisonRegion : undefined,
      });
      toast({
        title: "Export Successful",
        description: "Your PDF report has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error exporting your report.",
        variant: "destructive",
      });
    }
  };

  const handlePrimaryPresetChange = (value: DatePreset) => {
    setPrimaryPreset(value);
    if (value !== "custom") {
      setPrimaryDateRange(getDateRangeFromPreset(value));
    }
  };

  const handleComparisonPresetChange = (value: DatePreset) => {
    setComparisonPreset(value);
    if (value !== "custom") {
      setComparisonDateRange(getDateRangeFromPreset(value));
    }
  };

  // Smart routing based on all user roles
  useEffect(() => {
    if (isLoading) return;
    
    if (!hasAccess) {
      // User doesn't have government access - redirect based on available roles
      if (roles.includes("merchant")) {
        navigate("/merchant");
      } else if (roles.includes("farmhand")) {
        navigate("/farmhand");
      } else if (roles.includes("farmer_owner")) {
        navigate("/");
      } else {
        navigate("/");
      }
    }
  }, [hasAccess, roles, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If no access, return null (redirect happens in useEffect)
  if (!hasAccess) {
    return null;
  }

  return (
    <GovernmentLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Government Dashboard</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                Livestock industry insights for policy and program planning
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>

          {/* Welcome Banner */}
          <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold">Welcome to the Government Portal</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Access comprehensive livestock industry insights and analytics for evidence-based policy decisions.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-2"
                      onClick={() => document.getElementById('overview-section')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      <BarChart3 className="h-4 w-4" />
                      Overview Stats
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-2"
                      onClick={() => document.getElementById('trends-section')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      <TrendingUp className="h-4 w-4" />
                      Trend Charts
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-2"
                      onClick={() => document.getElementById('health-section')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      <HeartPulse className="h-4 w-4" />
                      Health Data
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-2"
                      onClick={() => document.getElementById('queries-section')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Farmer Queries
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comparison Mode Toggle */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="comparison-mode"
                    checked={comparisonMode}
                    onCheckedChange={setComparisonMode}
                  />
                  <Label htmlFor="comparison-mode" className="text-sm font-medium cursor-pointer">
                    Enable Comparison Mode
                  </Label>
                  {comparisonMode && (
                    <Badge variant="secondary" className="ml-2">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
                {comparisonMode && (
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Compare two different time periods or regions side by side
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Primary Filters */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base sm:text-lg">Primary Dataset</CardTitle>
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300">
                    PRIMARY
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Date Range</Label>
                  <Select value={primaryPreset} onValueChange={handlePrimaryPresetChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last7Days">Last 7 Days</SelectItem>
                      <SelectItem value="last30Days">Last 30 Days</SelectItem>
                      <SelectItem value="last90Days">Last 90 Days</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {primaryPreset === "custom" && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Start Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !primaryDateRange.start && "text-muted-foreground"
                              )}
                              size="sm"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(primaryDateRange.start, "MMM d, yyyy")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={primaryDateRange.start}
                              onSelect={(date) => date && setPrimaryDateRange(prev => ({ ...prev, start: date }))}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs">End Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !primaryDateRange.end && "text-muted-foreground"
                              )}
                              size="sm"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(primaryDateRange.end, "MMM d, yyyy")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={primaryDateRange.end}
                              onSelect={(date) => date && setPrimaryDateRange(prev => ({ ...prev, end: date }))}
                              initialFocus
                              className="pointer-events-auto"
                              disabled={(date) => date < primaryDateRange.start}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Region</Label>
                  <Select 
                    value={primaryRegion || "all"} 
                    onValueChange={(v) => setPrimaryRegion(v === "all" ? undefined : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Regions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Regions</SelectItem>
                      {regions.map((region) => (
                        <SelectItem key={region} value={region}>
                          {region}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Comparison Filters */}
            {comparisonMode && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base sm:text-lg">Comparison Dataset</CardTitle>
                    <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900 dark:text-orange-300">
                      COMPARISON
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Date Range</Label>
                    <Select value={comparisonPreset} onValueChange={handleComparisonPresetChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="last7Days">Last 7 Days</SelectItem>
                        <SelectItem value="last30Days">Last 30 Days</SelectItem>
                        <SelectItem value="last90Days">Last 90 Days</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {comparisonPreset === "custom" && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Start Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !comparisonDateRange.start && "text-muted-foreground"
                                )}
                                size="sm"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(comparisonDateRange.start, "MMM d, yyyy")}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={comparisonDateRange.start}
                                onSelect={(date) => date && setComparisonDateRange(prev => ({ ...prev, start: date }))}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        
                        <div className="space-y-1">
                          <Label className="text-xs">End Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !comparisonDateRange.end && "text-muted-foreground"
                                )}
                                size="sm"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(comparisonDateRange.end, "MMM d, yyyy")}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={comparisonDateRange.end}
                                onSelect={(date) => date && setComparisonDateRange(prev => ({ ...prev, end: date }))}
                                initialFocus
                                className="pointer-events-auto"
                                disabled={(date) => date < comparisonDateRange.start}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Region</Label>
                    <Select 
                      value={comparisonRegion || "all"} 
                      onValueChange={(v) => setComparisonRegion(v === "all" ? undefined : v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Regions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Regions</SelectItem>
                        {regions.map((region) => (
                          <SelectItem key={region} value={region}>
                            {region}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Dashboard Content */}
        <div id="overview-section">
          <GovDashboardOverview
          stats={stats as any} 
          comparisonStats={comparisonMode ? (comparisonStats as any) : undefined}
          isLoading={statsLoading} 
          error={statsError}
          comparisonMode={comparisonMode}
          />
        </div>

        <Suspense fallback={
          <Card>
            <CardHeader>
              <CardTitle>Regional Livestock Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="w-full h-[500px] rounded-lg" />
            </CardContent>
          </Card>
        }>
          <RegionalLivestockMap />
        </Suspense>

        {comparisonMode && (
          <ComparisonSummary
            primaryStats={stats as any}
            comparisonStats={comparisonStats as any}
            primaryDateRange={{ from: primaryDateRange.start, to: primaryDateRange.end }}
            comparisonDateRange={{ from: comparisonDateRange.start, to: comparisonDateRange.end }}
            primaryRegion={primaryRegion}
            comparisonRegion={comparisonRegion}
            isLoading={statsLoading || comparisonStatsLoading}
            comparisonMode={comparisonMode}
          />
        )}

        <div id="trends-section">
          <GovTrendCharts
            data={timeseriesData || []}
            comparisonData={comparisonMode ? (comparisonTimeseriesData || []) : undefined}
            isLoading={timeseriesLoading}
            error={undefined}
            comparisonMode={comparisonMode}
          />
        </div>

        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
          <div id="health-section" className="min-w-0">
            <AnimalHealthHeatmap 
              data={heatmapData as any}
              comparisonData={comparisonMode ? (comparisonHeatmapData as any) : undefined}
              isLoading={heatmapLoading} 
              error={heatmapError}
              comparisonMode={comparisonMode}
            />
          </div>
          <div id="queries-section" className="min-w-0">
            <FarmerQueriesTopics 
              startDate={primaryDateRange.start} 
              endDate={primaryDateRange.end}
              comparisonStartDate={comparisonMode ? comparisonDateRange.start : undefined}
              comparisonEndDate={comparisonMode ? comparisonDateRange.end : undefined}
              enabled={hasAccess}
              comparisonMode={comparisonMode}
            />
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
    </GovernmentLayout>
  );
};

export default GovernmentDashboard;
