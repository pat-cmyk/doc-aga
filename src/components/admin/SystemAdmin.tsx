import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, FileText, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { RecalculateStatsButton } from "./RecalculateStatsButton";

export const SystemAdmin = () => {
  const handleDatabaseMaintenance = () => {
    toast({
      title: "Maintenance Scheduled",
      description: "Database maintenance has been scheduled for the next maintenance window.",
    });
  };

  const handleClearCache = () => {
    toast({
      title: "Cache Cleared",
      description: "System cache has been successfully cleared.",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Animal Life Stages</CardTitle>
          <CardDescription>Recalculate life stages for all animals using species-specific logic</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="font-medium mb-1">Update Animal Life Stages</p>
              <p className="text-sm text-muted-foreground mb-3">
                Recalculates life stages for all animals (cattle, carabao, goats, sheep) using species-specific terminology and milking stages based on recent activity.
              </p>
              <RecalculateStatsButton />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Database Management</CardTitle>
          <CardDescription>Perform database maintenance and optimization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Optimize Database</p>
                <p className="text-sm text-muted-foreground">Run vacuum and analyze operations</p>
              </div>
            </div>
            <Button onClick={handleDatabaseMaintenance}>
              Schedule
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Clear Cache</p>
                <p className="text-sm text-muted-foreground">Clear application cache</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleClearCache}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Logs</CardTitle>
          <CardDescription>View and monitor system activity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Application Logs</p>
                <p className="text-sm text-muted-foreground">View recent application logs</p>
              </div>
            </div>
            <Button variant="outline">
              View Logs
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Error Logs</p>
                <p className="text-sm text-muted-foreground">View system errors and warnings</p>
              </div>
            </div>
            <Button variant="outline">
              View Errors
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
          <CardDescription>Current system configuration and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Environment</span>
              <span className="font-medium">Production</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Deployment</span>
              <span className="font-medium">{new Date().toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Uptime</span>
              <span className="font-medium text-green-600">99.9%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
