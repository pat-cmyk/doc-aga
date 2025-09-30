import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";

const MilkingRecords = ({ animalId }: { animalId: string }) => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ date: new Date().toISOString().split("T")[0], liters: "" });
  const [filterPeriod, setFilterPeriod] = useState<"all" | "cycle" | "month">("all");
  const [latestCalvingDate, setLatestCalvingDate] = useState<Date | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadRecords();
    loadLatestCalvingDate();
  }, [animalId]);

  const loadLatestCalvingDate = async () => {
    const { data } = await supabase
      .from("animals")
      .select("birth_date")
      .eq("mother_id", animalId)
      .order("birth_date", { ascending: false })
      .limit(1);
    
    if (data && data.length > 0 && data[0].birth_date) {
      setLatestCalvingDate(new Date(data[0].birth_date));
    }
  };

  const loadRecords = async () => {
    const { data } = await supabase.from("milking_records").select("*").eq("animal_id", animalId).order("record_date", { ascending: true });
    setRecords(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("milking_records").insert({ animal_id: animalId, record_date: formData.date, liters: parseFloat(formData.liters), created_by: user?.id });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Success", description: "Record added" }); setShowForm(false); setFormData({ date: new Date().toISOString().split("T")[0], liters: "" }); loadRecords(); }
  };

  if (loading) return <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;

  const getFilteredRecords = () => {
    const now = new Date();
    
    switch (filterPeriod) {
      case "cycle":
        if (!latestCalvingDate) return records;
        return records.filter(r => new Date(r.record_date) >= latestCalvingDate);
      
      case "month":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return records.filter(r => new Date(r.record_date) >= startOfMonth);
      
      case "all":
      default:
        return records;
    }
  };

  const filteredRecords = getFilteredRecords();
  
  const chartData = filteredRecords.map(r => ({
    date: new Date(r.record_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    liters: parseFloat(r.liters)
  }));

  const chartConfig = {
    liters: {
      label: "Liters",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Milking Production</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          {!showForm ? (
            <Button onClick={() => setShowForm(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />Add Record
            </Button>
          ) : (
            <Button onClick={() => setShowForm(false)} size="sm" variant="outline">
              Cancel
            </Button>
          )}
          
          <Tabs value={filterPeriod} onValueChange={(v) => setFilterPeriod(v as "all" | "cycle" | "month")} className="ml-auto">
            <TabsList>
              <TabsTrigger value="all" className="text-xs">All-Time</TabsTrigger>
              <TabsTrigger value="cycle" className="text-xs" disabled={!latestCalvingDate}>This Cycle</TabsTrigger>
              <TabsTrigger value="month" className="text-xs">Month-to-Date</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Date</Label><Input type="date" value={formData.date} onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))} required /></div>
            <div><Label>Liters</Label><Input type="number" step="0.01" value={formData.liters} onChange={(e) => setFormData(prev => ({ ...prev, liters: e.target.value }))} required /></div>
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button><Button type="submit" className="flex-1">Save</Button></div>
          </form>
        )}
        
        {records.length > 0 ? (
          <>
            <div className="text-xs text-muted-foreground mb-2">
              Showing {filteredRecords.length} records {filterPeriod === "all" ? "(all-time)" : filterPeriod === "cycle" ? "(current cycle)" : "(this month)"}
            </div>
            <ChartContainer key={filterPeriod} config={chartConfig} className="h-[300px] w-full">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" label={{ value: 'Liters', angle: -90, position: 'insideLeft' }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="liters" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ChartContainer>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No milking records yet. Add your first record to see the production chart.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MilkingRecords;