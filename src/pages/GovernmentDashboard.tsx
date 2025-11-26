import { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { GovernmentLayout } from "@/components/government/GovernmentLayout";
import { useRole } from "@/hooks/useRole";
import { GovDashboardOverview } from "@/components/government/GovDashboardOverview";
import { AnimalHealthHeatmap } from "@/components/government/AnimalHealthHeatmap";
import { FarmerQueriesTopics } from "@/components/government/FarmerQueriesTopics";
import { ComparisonSummary } from "@/components/government/ComparisonSummary";
import { GovTrendCharts } from "@/components/government/GovTrendCharts";
import { FarmerVoiceDashboard } from "@/components/government/FarmerVoiceDashboard";
import { FeedbackPriorityQueue } from "@/components/government/FeedbackPriorityQueue";
import { FeedbackGeoHeatmap } from "@/components/government/FeedbackGeoHeatmap";
import { SentimentTrendChart } from "@/components/government/SentimentTrendChart";
import { SmartInsightsPanel } from "@/components/government/SmartInsightsPanel";
import { FeedbackClusterView } from "@/components/government/FeedbackClusterView";
import { ResponseTemplates } from "@/components/government/ResponseTemplates";
import { FeedbackExport } from "@/components/government/FeedbackExport";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Dynamically import the map component to reduce bundle size
const RegionalLivestockMap = lazy(() => import("@/components/government/RegionalLivestockMap"));
import { useGovernmentStats, useHealthHeatmap, useFarmerQueries, useGovernmentStatsTimeseries } from "@/hooks/useGovernmentStats";
import { useBreedingStats } from "@/hooks/useBreedingStats";
import { BreedingOverviewCards } from "@/components/government/BreedingOverviewCards";
import { BreedingSuccessChart } from "@/components/government/BreedingSuccessChart";
import { ExpectedDeliveriesTimeline } from "@/components/government/ExpectedDeliveriesTimeline";
import { useGovernmentAccess } from "@/hooks/useGovernmentAccess";
import { useLocationFilters } from "@/hooks/useLocationFilters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { subDays, format, parse } from "date-fns";

import { AlertCircle, TrendingUp, Activity, Users, FileText, Stethoscope, Download, Sparkles, BarChart3, HeartPulse, MessageSquare, CalendarIcon, Target } from "lucide-react";
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
  const { getRegions, getProvinces, getMunicipalities } = useLocationFilters();
  const regions = getRegions();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  
  const isLoading = accessLoading || rolesLoading;

  // Initialize main tab from URL or default to livestock
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "livestock");

  // Initialize state from URL or defaults
  const [comparisonMode, setComparisonMode] = useState(() => searchParams.get("compare") === "true");
  
  const [primaryPreset, setPrimaryPreset] = useState<DatePreset>(() => 
    (searchParams.get("p_preset") as DatePreset) || "last90Days"
  );
  const [comparisonPreset, setComparisonPreset] = useState<DatePreset>(() => 
    (searchParams.get("c_preset") as DatePreset) || "last90Days"
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
  const [primaryProvince, setPrimaryProvince] = useState<string | undefined>(() => 
    searchParams.get("p_province") || undefined
  );
  const [primaryMunicipality, setPrimaryMunicipality] = useState<string | undefined>(() => 
    searchParams.get("p_municipality") || undefined
  );
  
  const [comparisonRegion, setComparisonRegion] = useState<string | undefined>(() => 
    searchParams.get("c_region") || undefined
  );
  const [comparisonProvince, setComparisonProvince] = useState<string | undefined>(() => 
    searchParams.get("c_province") || undefined
  );
  const [comparisonMunicipality, setComparisonMunicipality] = useState<string | undefined>(() => 
    searchParams.get("c_municipality") || undefined
  );

  // Update URL when state changes
  useMemo(() => {
    const params = new URLSearchParams();
    
    params.set("tab", activeTab);
    params.set("compare", comparisonMode.toString());
    params.set("p_preset", primaryPreset);
    params.set("p_start", format(primaryDateRange.start, "yyyy-MM-dd"));
    params.set("p_end", format(primaryDateRange.end, "yyyy-MM-dd"));
    if (primaryRegion) params.set("p_region", primaryRegion);
    if (primaryProvince) params.set("p_province", primaryProvince);
    if (primaryMunicipality) params.set("p_municipality", primaryMunicipality);
    
    if (comparisonMode) {
      params.set("c_preset", comparisonPreset);
      params.set("c_start", format(comparisonDateRange.start, "yyyy-MM-dd"));
      params.set("c_end", format(comparisonDateRange.end, "yyyy-MM-dd"));
      if (comparisonRegion) params.set("c_region", comparisonRegion);
      if (comparisonProvince) params.set("c_province", comparisonProvince);
      if (comparisonMunicipality) params.set("c_municipality", comparisonMunicipality);
    }
    
    setSearchParams(params, { replace: true });
  }, [activeTab, comparisonMode, primaryPreset, primaryDateRange, primaryRegion, primaryProvince, primaryMunicipality, comparisonPreset, comparisonDateRange, comparisonRegion, comparisonProvince, comparisonMunicipality]);

  // Data fetching
  const { data: stats, isLoading: statsLoading, error: statsError } = useGovernmentStats(
    primaryDateRange.start,
    primaryDateRange.end,
    primaryRegion,
    primaryProvince,
    primaryMunicipality,
    { enabled: !!hasAccess }
  );

  const { data: comparisonStats, isLoading: comparisonStatsLoading } = useGovernmentStats(
    comparisonDateRange.start,
    comparisonDateRange.end,
    comparisonRegion,
    comparisonProvince,
    comparisonMunicipality,
    { enabled: !!hasAccess && comparisonMode }
  );

  const daysDiff = Math.ceil(
    (primaryDateRange.end.getTime() - primaryDateRange.start.getTime()) / (1000 * 60 * 60 * 24)
  );

  const { data: heatmapData, isLoading: heatmapLoading, error: heatmapError } = useHealthHeatmap(
    daysDiff,
    primaryRegion,
    primaryProvince,
    primaryMunicipality,
    { enabled: !!hasAccess }
  );

  const { data: comparisonHeatmapData, isLoading: comparisonHeatmapLoading } = useHealthHeatmap(
    daysDiff,
    comparisonRegion,
    comparisonProvince,
    comparisonMunicipality,
    { enabled: !!hasAccess && comparisonMode }
  );

  const { data: farmerQueries, isLoading: queriesLoading } = useFarmerQueries(
    primaryDateRange.start,
    primaryDateRange.end,
    { enabled: !!hasAccess }
  );

  const { data: comparisonFarmerQueries, isLoading: comparisonQueriesLoading } = useFarmerQueries(
    comparisonDateRange.start,
    comparisonDateRange.end,
    { enabled: !!hasAccess && comparisonMode }
  );

  const { data: timeseriesData, isLoading: timeseriesLoading } = useGovernmentStatsTimeseries(
    primaryDateRange.start,
    primaryDateRange.end,
    primaryRegion,
    primaryProvince,
    primaryMunicipality,
    { enabled: !!hasAccess }
  );

  const { data: comparisonTimeseriesData, isLoading: comparisonTimeseriesLoading } = useGovernmentStatsTimeseries(
    comparisonDateRange.start,
    comparisonDateRange.end,
    comparisonRegion,
    comparisonProvince,
    comparisonMunicipality,
    { enabled: !!hasAccess && comparisonMode }
  );

  // Breeding stats data fetching
  const { data: breedingStats, isLoading: breedingStatsLoading } = useBreedingStats(
    primaryDateRange.start,
    primaryDateRange.end,
    primaryRegion,
    primaryProvince,
    primaryMunicipality,
    { enabled: !!hasAccess }
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

  // Cascading filter handlers for Primary
  const handlePrimaryRegionChange = (value: string) => {
    const newRegion = value === "all" ? undefined : value;
    setPrimaryRegion(newRegion);
    setPrimaryProvince(undefined);
    setPrimaryMunicipality(undefined);
  };

  const handlePrimaryProvinceChange = (value: string) => {
    const newProvince = value === "all" ? undefined : value;
    setPrimaryProvince(newProvince);
    setPrimaryMunicipality(undefined);
  };

  const handlePrimaryMunicipalityChange = (value: string) => {
    setPrimaryMunicipality(value === "all" ? undefined : value);
  };

  // Cascading filter handlers for Comparison
  const handleComparisonRegionChange = (value: string) => {
    const newRegion = value === "all" ? undefined : value;
    setComparisonRegion(newRegion);
    setComparisonProvince(undefined);
    setComparisonMunicipality(undefined);
  };

  const handleComparisonProvinceChange = (value: string) => {
    const newProvince = value === "all" ? undefined : value;
    setComparisonProvince(newProvince);
    setComparisonMunicipality(undefined);
  };

  const handleComparisonMunicipalityChange = (value: string) => {
    setComparisonMunicipality(value === "all" ? undefined : value);
  };

  // Get available provinces and municipalities
  const primaryProvinces = getProvinces(primaryRegion);
  const primaryMunicipalities = getMunicipalities(primaryRegion, primaryProvince);
  const comparisonProvinces = getProvinces(comparisonRegion);
  const comparisonMunicipalities = getMunicipalities(comparisonRegion, comparisonProvince);

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
                    onClick={() => setActiveTab("livestock")}
                  >
                    <BarChart3 className="h-4 w-4" />
                    Livestock Analytics
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                    onClick={() => setActiveTab("farmer-voice")}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Farmer Voice
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                    onClick={() => setActiveTab("programs")}
                  >
                    <Target className="h-4 w-4" />
                    Programs & Insights
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="livestock" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Livestock Analytics</span>
              <span className="sm:hidden">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="farmer-voice" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Farmer Voice</span>
              <span className="sm:hidden">Voice</span>
            </TabsTrigger>
            <TabsTrigger value="programs" className="gap-2">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Programs & Insights</span>
              <span className="sm:hidden">Programs</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Livestock Analytics */}
          <TabsContent value="livestock" className="space-y-6">
            <div className="flex flex-col gap-4">
              {/* Export Buttons */}
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

              {/* Filter Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Primary Filters */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300">
                          PRIMARY
                        </Badge>
                        <CardTitle className="text-base sm:text-lg">Dataset</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          Compare
                        </span>
                        <Switch
                          id="comparison-mode"
                          checked={comparisonMode}
                          onCheckedChange={setComparisonMode}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>
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
                        onValueChange={handlePrimaryRegionChange}
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

                    {primaryRegion && primaryProvinces.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm">Province</Label>
                        <Select 
                          value={primaryProvince || "all"} 
                          onValueChange={handlePrimaryProvinceChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="All Provinces" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Provinces</SelectItem>
                            {primaryProvinces.map((province) => (
                              <SelectItem key={province} value={province}>
                                {province}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {primaryRegion && primaryProvince && primaryMunicipalities.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm">Municipality/City</Label>
                        <Select 
                          value={primaryMunicipality || "all"} 
                          onValueChange={handlePrimaryMunicipalityChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="All Municipalities" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Municipalities</SelectItem>
                            {primaryMunicipalities.map((municipality) => (
                              <SelectItem key={municipality} value={municipality}>
                                {municipality}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
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
                          onValueChange={handleComparisonRegionChange}
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

                      {comparisonRegion && comparisonProvinces.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs sm:text-sm">Province</Label>
                          <Select 
                            value={comparisonProvince || "all"} 
                            onValueChange={handleComparisonProvinceChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="All Provinces" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Provinces</SelectItem>
                              {comparisonProvinces.map((province) => (
                                <SelectItem key={province} value={province}>
                                  {province}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {comparisonRegion && comparisonProvince && comparisonMunicipalities.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs sm:text-sm">Municipality/City</Label>
                          <Select 
                            value={comparisonMunicipality || "all"} 
                            onValueChange={handleComparisonMunicipalityChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="All Municipalities" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Municipalities</SelectItem>
                              {comparisonMunicipalities.map((municipality) => (
                                <SelectItem key={municipality} value={municipality}>
                                  {municipality}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Overview Stats */}
            <GovDashboardOverview
              stats={stats as any} 
              comparisonStats={comparisonMode ? (comparisonStats as any) : undefined}
              isLoading={statsLoading} 
              error={statsError}
              comparisonMode={comparisonMode}
              breedingStats={breedingStats}
              breedingStatsLoading={breedingStatsLoading}
            />

            {/* Regional Map */}
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
              <RegionalLivestockMap dateRange={primaryDateRange} />
            </Suspense>

            {/* Comparison Summary */}
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

            {/* Trend Charts */}
            <GovTrendCharts
              data={timeseriesData || []}
              comparisonData={comparisonMode ? (comparisonTimeseriesData || []) : undefined}
              isLoading={timeseriesLoading}
              error={undefined}
              comparisonMode={comparisonMode}
            />

            {/* Breeding & Reproduction Analytics */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <HeartPulse className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Breeding & Reproduction Analytics</h3>
              </div>
              
              <BreedingOverviewCards
                totalAIProcedures={breedingStats?.total_ai_scheduled || 0}
                totalAIPerformed={breedingStats?.total_ai_performed || 0}
                currentlyPregnant={breedingStats?.currently_pregnant || 0}
                aiSuccessRate={breedingStats?.ai_success_rate || 0}
                dueThisQuarter={breedingStats?.due_this_quarter || 0}
                isLoading={breedingStatsLoading}
              />
              
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                <BreedingSuccessChart
                  cattleSuccessRate={breedingStats?.cattle_success_rate || 0}
                  goatSuccessRate={breedingStats?.goat_success_rate || 0}
                  carabaoSuccessRate={breedingStats?.carabao_success_rate || 0}
                  sheepSuccessRate={breedingStats?.sheep_success_rate || 0}
                  isLoading={breedingStatsLoading}
                />
                <ExpectedDeliveriesTimeline
                  deliveriesByMonth={breedingStats?.expected_deliveries_by_month || {}}
                  isLoading={breedingStatsLoading}
                />
              </div>
            </div>

            {/* Health & Queries Grid */}
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
              <div className="min-w-0">
                <AnimalHealthHeatmap 
                  data={heatmapData as any}
                  comparisonData={comparisonMode ? (comparisonHeatmapData as any) : undefined}
                  isLoading={heatmapLoading} 
                  error={heatmapError}
                  comparisonMode={comparisonMode}
                />
              </div>
              <div className="min-w-0">
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
          </TabsContent>

          {/* Tab 2: Farmer Voice */}
          <TabsContent value="farmer-voice" className="space-y-6">
            <div className="space-y-6">
              {/* Persistent Stats Header */}
              <FarmerVoiceDashboard />

              {/* Farmer Voice Sub-tabs */}
              <Tabs defaultValue="queue" className="space-y-6">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="queue" className="gap-1">
                    Queue
                    <Badge variant="destructive" className="ml-1 h-5 px-1 text-xs">
                      ⚡
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="insights">Insights</TabsTrigger>
                  <TabsTrigger value="clusters">Clusters</TabsTrigger>
                  <TabsTrigger value="templates">Templates</TabsTrigger>
                  <TabsTrigger value="export">Export</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <FeedbackGeoHeatmap />
                    <SentimentTrendChart />
                  </div>
                </TabsContent>

                <TabsContent value="queue">
                  <FeedbackPriorityQueue />
                </TabsContent>

                <TabsContent value="insights">
                  <SmartInsightsPanel />
                </TabsContent>

                <TabsContent value="clusters">
                  <FeedbackClusterView />
                </TabsContent>

                <TabsContent value="templates">
                  <ResponseTemplates />
                </TabsContent>

                <TabsContent value="export">
                  <FeedbackExport />
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          {/* Tab 3: Programs & Insights */}
          <TabsContent value="programs" className="space-y-6">
            {/* Farmer Queries Deep Dive */}
            <Card>
              <CardHeader>
                <CardTitle>Farmer Queries Analysis</CardTitle>
                <CardDescription>
                  Detailed breakdown of farmer questions and concerns over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FarmerQueriesTopics 
                  startDate={primaryDateRange.start} 
                  endDate={primaryDateRange.end}
                  enabled={hasAccess}
                  comparisonMode={false}
                />
              </CardContent>
            </Card>

            {/* Coming Soon Sections */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
              <Card className="border-dashed">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    <CardTitle>Production Trends</CardTitle>
                  </div>
                  <CardDescription>Coming Soon</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Regional milk yield comparisons</li>
                    <li>• Seasonal production patterns</li>
                    <li>• Growth indicators by livestock type</li>
                    <li>• Feed efficiency metrics</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-dashed">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <CardTitle>Program Participation</CardTitle>
                  </div>
                  <CardDescription>Coming Soon</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Training program attendance</li>
                    <li>• Veterinary service utilization</li>
                    <li>• Infrastructure improvements tracked</li>
                    <li>• Subsidy program reach</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-dashed">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-muted-foreground" />
                    <CardTitle>Impact Analysis</CardTitle>
                  </div>
                  <CardDescription>Coming Soon</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Program Impact Analysis - Pilot vs control groups</li>
                    <li>• ROI metrics for government programs</li>
                    <li>• Comparative effectiveness studies</li>
                    <li>• Long-term outcome tracking</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-dashed">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <CardTitle>Advanced Features</CardTitle>
                  </div>
                  <CardDescription>Coming Soon</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• FFEDIS Sync & Export - Farm registry with QR codes</li>
                    <li>• Priority Alerts - Automated outbreak detection</li>
                    <li>• Procurement Validation - Cooperative accreditation</li>
                    <li>• Custom report builder</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </GovernmentLayout>
  );
};

export default GovernmentDashboard;
