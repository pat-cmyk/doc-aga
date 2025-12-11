import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wrench, TestTube, Settings } from "lucide-react";
import { SystemAdmin } from "../SystemAdmin";
import { QADashboard } from "../QADashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchParams } from "react-router-dom";

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
        <TabsList>
          <TabsTrigger value="maintenance" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Maintenance
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
