import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wrench, TestTube, Settings, RefreshCw, ShieldCheck, Calendar, Loader2 } from "lucide-react";
import { SystemAdmin } from "../SystemAdmin";
import { QADashboard } from "../QADashboard";
import { SyncMonitoringDashboard } from "../SyncMonitoringDashboard";
import { DataIntegrityDashboard } from "../DataIntegrityDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchParams } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlatformSettings, useUpdatePlatformSettings } from "@/hooks/usePlatformSettings";
import { toast } from "sonner";

export const SystemTab = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const subtab = searchParams.get("subtab") || "maintenance";

  const handleSubtabChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("subtab", value);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-6">
      <Tabs value={subtab} onValueChange={handleSubtabChange}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="maintenance" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Maintenance
          </TabsTrigger>
          <TabsTrigger value="integrity" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Data Integrity
          </TabsTrigger>
          <TabsTrigger value="sync" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Sync Monitoring
          </TabsTrigger>
          <TabsTrigger value="qa" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            QA & Tests
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="maintenance" className="mt-6">
          <SystemAdmin />
        </TabsContent>

        <TabsContent value="integrity" className="mt-6">
          <DataIntegrityDashboard />
        </TabsContent>

        <TabsContent value="sync" className="mt-6">
          <SyncMonitoringDashboard />
        </TabsContent>

        <TabsContent value="qa" className="mt-6">
          <QADashboard />
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <ConfigurationPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const ConfigurationPanel = () => {
  return (
    <div className="space-y-6">
      <PlatformSettingsPanel />

      <Card>
        <CardHeader>
          <CardTitle>Application Configuration</CardTitle>
          <CardDescription>View and manage system configuration settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-medium">Feature Flags</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Voice Training</span>
                    <span className="text-green-600">Enabled</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Marketplace</span>
                    <span className="text-green-600">Enabled</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Government Portal</span>
                    <span className="text-green-600">Enabled</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">API Integrations</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Lovable AI</span>
                    <span className="text-green-600">Connected</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mapbox</span>
                    <span className="text-green-600">Connected</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Environment Details</CardTitle>
          <CardDescription>Current deployment environment information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Build Mode</span>
              <span className="font-medium">Production</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Node Environment</span>
              <span className="font-medium">production</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Region</span>
              <span className="font-medium">Asia Pacific</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const PlatformSettingsPanel = () => {
  const { data: settings, isLoading } = usePlatformSettings();
  const updateSettings = useUpdatePlatformSettings();

  const handleToggle = async (checked: boolean) => {
    try {
      await updateSettings.mutateAsync({
        enabled: checked,
        maxDays: settings?.maxBackdateDays ?? 7
      });
      toast.success(checked ? "Backdating limit enabled" : "Backdating limit disabled");
    } catch (error) {
      toast.error("Failed to update setting");
    }
  };

  const handleDaysChange = async (value: string) => {
    const days = parseInt(value, 10);
    try {
      await updateSettings.mutateAsync({
        enabled: settings?.backdatingEnabled ?? false,
        maxDays: days
      });
      toast.success(`Backdating limit updated to ${days} days`);
    } catch (error) {
      toast.error("Failed to update setting");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Platform Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const isEnabled = settings?.backdatingEnabled ?? false;
  const maxDays = settings?.maxBackdateDays ?? 7;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Platform Settings
        </CardTitle>
        <CardDescription>
          Control platform-wide behavior and restrictions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Backdating Toggle */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="backdating-toggle" className="text-base font-medium">
                Enforce backdating limit
              </Label>
              <p className="text-sm text-muted-foreground">
                {isEnabled 
                  ? `Farmers can only record activities up to ${maxDays} days in the past`
                  : "Farmers can record activities for any past date (acquisition mode)"}
              </p>
            </div>
            <Switch
              id="backdating-toggle"
              checked={isEnabled}
              onCheckedChange={handleToggle}
              disabled={updateSettings.isPending}
            />
          </div>

          {/* Days Selection - only shown when enabled */}
          {isEnabled && (
            <div className="space-y-2 pl-0 md:pl-4 border-l-2 border-muted ml-0 md:ml-2">
              <Label htmlFor="max-days" className="text-sm font-medium">
                Maximum days
              </Label>
              <Select
                value={maxDays.toString()}
                onValueChange={handleDaysChange}
                disabled={updateSettings.isPending}
              >
                <SelectTrigger id="max-days" className="w-full md:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="365">365 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Status Indicator */}
          <div className="flex items-center gap-2 pt-2">
            <div className={`h-2 w-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-blue-500'}`} />
            <span className="text-sm text-muted-foreground">
              {isEnabled 
                ? `Enabled — ${maxDays} days maximum`
                : "Disabled — No limit (acquisition mode)"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
