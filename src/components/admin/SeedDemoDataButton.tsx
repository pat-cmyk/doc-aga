import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Sprout } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface FarmSeedResult {
  farm_id: string;
  farm_name: string;
  livestock_type: string;
  animals_processed: number;
  milking_inserted: number;
  weight_inserted: number;
  health_inserted: number;
  bcs_inserted: number;
  feeding_inserted: number;
  ai_inserted: number;
}

interface SeedResult {
  success: boolean;
  farms_processed: number;
  total_records_inserted: number;
  summary: FarmSeedResult[];
}

export const SeedDemoDataButton = () => {
  const [isSeeding, setIsSeeding] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<SeedResult | null>(null);

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-demo-data', {
        body: {},
      });

      if (error) throw error;

      setResults(data as SeedResult);
      setShowResults(true);

      toast({
        title: "Demo Data Seeded",
        description: `Inserted ${data.total_records_inserted} records across ${data.farms_processed} farms.`,
      });
    } catch (error) {
      console.error('Seed demo data error:', error);
      toast({
        title: "Seeding Failed",
        description: error instanceof Error ? error.message : "Failed to seed demo data",
        variant: "destructive",
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const totalByType = results?.summary.reduce(
    (acc, s) => ({
      milking: acc.milking + s.milking_inserted,
      weight: acc.weight + s.weight_inserted,
      health: acc.health + s.health_inserted,
      bcs: acc.bcs + s.bcs_inserted,
      feeding: acc.feeding + s.feeding_inserted,
      ai: acc.ai + (s.ai_inserted || 0),
    }),
    { milking: 0, weight: 0, health: 0, bcs: 0, feeding: 0, ai: 0 }
  );

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Sprout className="h-4 w-4 text-green-600" />
            <p className="font-medium">Seed Demo Farm Data</p>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Assess all demo farms for missing data (milking, weight, health, BCS, feeding) and auto-fill gaps with realistic species-specific records. Only affects farms with <code className="text-xs bg-muted px-1 rounded">data_category = 'demo'</code>. Runs automatically daily at 2 AM UTC.
          </p>
          <Button
            onClick={handleSeed}
            disabled={isSeeding}
            variant="outline"
          >
            {isSeeding ? "Seeding..." : "Seed Demo Farm Data"}
          </Button>
        </div>
      </div>

      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Demo Data Seeding Results</DialogTitle>
            <DialogDescription>
              {results?.farms_processed} farms processed, {results?.total_records_inserted} total records inserted
            </DialogDescription>
          </DialogHeader>

          {results && totalByType && (
            <div className="space-y-4">
              <div className="grid grid-cols-6 gap-3 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Milking</p>
                  <p className="text-lg font-bold">{totalByType.milking}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Weight</p>
                  <p className="text-lg font-bold">{totalByType.weight}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Health</p>
                  <p className="text-lg font-bold">{totalByType.health}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">BCS</p>
                  <p className="text-lg font-bold">{totalByType.bcs}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Feeding</p>
                  <p className="text-lg font-bold">{totalByType.feeding}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">AI</p>
                  <p className="text-lg font-bold">{totalByType.ai}</p>
                </div>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Farm</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-center">Animals</TableHead>
                      <TableHead className="text-center">Milk</TableHead>
                      <TableHead className="text-center">Weight</TableHead>
                      <TableHead className="text-center">Health</TableHead>
                      <TableHead className="text-center">BCS</TableHead>
                      <TableHead className="text-center">Feed</TableHead>
                      <TableHead className="text-center">AI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.summary.map((farm) => (
                      <TableRow key={farm.farm_id}>
                        <TableCell className="font-medium text-sm">{farm.farm_name}</TableCell>
                        <TableCell className="text-sm capitalize">{farm.livestock_type}</TableCell>
                        <TableCell className="text-center">{farm.animals_processed}</TableCell>
                        <TableCell className="text-center">{farm.milking_inserted}</TableCell>
                        <TableCell className="text-center">{farm.weight_inserted}</TableCell>
                        <TableCell className="text-center">{farm.health_inserted}</TableCell>
                        <TableCell className="text-center">{farm.bcs_inserted}</TableCell>
                        <TableCell className="text-center">{farm.feeding_inserted}</TableCell>
                        <TableCell className="text-center">{farm.ai_inserted || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
