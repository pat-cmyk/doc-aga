import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { getCachedRecords } from "@/lib/dataCache";

const MilkingRecords = ({ animalId }: { animalId: string }) => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ date: new Date().toISOString().split("T")[0], liters: "" });
  const [filterPeriod, setFilterPeriod] = useState<"all" | "cycle" | "month">("all");
  const [latestCalvingDate, setLatestCalvingDate] = useState<Date | null>(null);
  const [animalGender, setAnimalGender] = useState<string | null>(null);
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    loadAnimalGender();
    loadRecords();
    loadLatestCalvingDate();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('milking_records_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'milking_records',
          filter: `animal_id=eq.${animalId}`
        },
        () => {
          loadRecords();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [animalId]);

  const loadAnimalGender = async () => {
    const { data } = await supabase
      .from("animals")
      .select("gender")
      .eq("id", animalId)
      .single();
    setAnimalGender(data?.gender || null);
  };

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
    // Try cache first
    const cached = await getCachedRecords(animalId);
    if (cached?.milking) {
      setRecords(cached.milking);
      setLoading(false);
    }
    
    // Fetch fresh if online
    if (isOnline) {
      const { data } = await supabase.from("milking_records").select("*").eq("animal_id", animalId).order("record_date", { ascending: true });
      setRecords(data || []);
    }
    
    // Always set loading to false, even if offline with no cache
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

  // Show message for male animals
  if (animalGender?.toLowerCase() === 'male') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Milking Production</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Milking records are only available for female cattle.
          </p>
        </CardContent>
      </Card>
    );
  }

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
      <CardContent className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {!showForm ? (
            <Button 
              onClick={() => setShowForm(true)} 
              className="w-full sm:w-auto min-h-[48px]"
              disabled={!isOnline}
              title={!isOnline ? "Available when online" : ""}
            >
              <Plus className="h-5 w-5 mr-2" />Add Record
            </Button>
          ) : (
            <Button onClick={() => setShowForm(false)} variant="outline" className="w-full sm:w-auto min-h-[48px]">
              Cancel
            </Button>
          )}
          
          <Select value={filterPeriod} onValueChange={(v) => setFilterPeriod(v as "all" | "cycle" | "month")}>
            <SelectTrigger className="w-full sm:w-[180px] min-h-[48px] sm:ml-auto">
              <SelectValue placeholder="Filter by period" />
            </SelectTrigger>
            <SelectContent className="bg-card z-50">
              <SelectItem value="all">All-Time</SelectItem>
              <SelectItem value="cycle" disabled={!latestCalvingDate}>This Cycle</SelectItem>
              <SelectItem value="month">Month-to-Date</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={formData.date} onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))} required className="min-h-[48px]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="liters">Liters</Label>
              <Input id="liters" type="number" step="0.01" value={formData.liters} onChange={(e) => setFormData(prev => ({ ...prev, liters: e.target.value }))} required className="min-h-[48px]" />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1 min-h-[48px]">Cancel</Button>
              <Button type="submit" className="flex-1 min-h-[48px]">Save</Button>
            </div>
          </form>
        )}
        
        {records.length > 0 ? (
          <>
            <div className="text-sm text-muted-foreground px-1">
              Showing {filteredRecords.length} records {filterPeriod === "all" ? "(all-time)" : filterPeriod === "cycle" ? "(current cycle)" : "(this month)"}
            </div>
            <ChartContainer key={filterPeriod} config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis className="text-xs" tick={{ fontSize: 11 }} label={{ value: 'Liters', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="liters" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 3 }} />
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