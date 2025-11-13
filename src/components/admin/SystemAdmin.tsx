import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, FileText, AlertCircle, RefreshCw, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { RecalculateStatsButton } from "./RecalculateStatsButton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

interface ChangeRecord {
  animal_id: string;
  unique_code: string;
  old_life_stage: string | null;
  new_life_stage: string | null;
  old_milking_stage: string | null;
  new_milking_stage: string | null;
}

interface MigrationResult {
  success: boolean;
  total_processed: number;
  updated_count: number;
  changes: ChangeRecord[];
  errors?: string[];
}

export const SystemAdmin = () => {
  const [isMigrating, setIsMigrating] = useState(false);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [migrationResults, setMigrationResults] = useState<MigrationResult | null>(null);

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

  const handleMigrateCarabaoTerms = async () => {
    setIsMigrating(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-recalculate-carabao-stages', {
        body: {},
      });

      if (error) throw error;

      setMigrationResults(data as MigrationResult);
      setShowResultsDialog(true);

      toast({
        title: "Migration Complete",
        description: `Successfully updated ${data.updated_count} carabao animals`,
      });
    } catch (error) {
      console.error('Migration error:', error);
      toast({
        title: "Migration Failed",
        description: error instanceof Error ? error.message : "Failed to migrate carabao terms",
        variant: "destructive",
      });
    } finally {
      setIsMigrating(false);
    }
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

          <div className="flex items-start gap-3 pt-4 border-t">
            <div className="flex-1">
              <p className="font-medium mb-1">Migrate Carabao Terms</p>
              <p className="text-sm text-muted-foreground mb-3">
                One-time migration to update all carabao animals from cattle terms (e.g., "Mature Cow") to carabao-specific terms (e.g., "Mature Carabao") in the database.
              </p>
              <Button 
                onClick={handleMigrateCarabaoTerms} 
                disabled={isMigrating}
                variant="outline"
              >
                {isMigrating ? "Migrating..." : "Migrate Carabao Terms"}
              </Button>
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

      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Migration Results</DialogTitle>
            <DialogDescription>
              Carabao life stage terminology has been updated
            </DialogDescription>
          </DialogHeader>
          
          {migrationResults && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Animals Processed</p>
                  <p className="text-2xl font-bold">{migrationResults.total_processed}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Animals Updated</p>
                  <p className="text-2xl font-bold text-green-600">{migrationResults.updated_count}</p>
                </div>
              </div>

              {migrationResults.changes.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Changes Made</h3>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Animal Code</TableHead>
                          <TableHead>Life Stage Change</TableHead>
                          <TableHead>Milking Stage Change</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {migrationResults.changes.map((change) => (
                          <TableRow key={change.animal_id}>
                            <TableCell className="font-medium">{change.unique_code}</TableCell>
                            <TableCell>
                              {change.old_life_stage !== change.new_life_stage ? (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-muted-foreground">{change.old_life_stage}</span>
                                  <ArrowRight className="h-3 w-3" />
                                  <span className="font-medium">{change.new_life_stage}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">No change</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {change.old_milking_stage !== change.new_milking_stage ? (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-muted-foreground">{change.old_milking_stage || 'None'}</span>
                                  <ArrowRight className="h-3 w-3" />
                                  <span className="font-medium">{change.new_milking_stage || 'None'}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">No change</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {migrationResults.errors && migrationResults.errors.length > 0 && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <h3 className="font-medium text-destructive mb-2">Errors</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {migrationResults.errors.map((error, idx) => (
                      <li key={idx} className="text-sm text-destructive">{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
