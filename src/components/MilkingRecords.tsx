import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { getCachedRecords } from "@/lib/dataCache";
import { useLastMilkPrice, useAddRevenue } from "@/hooks/useRevenues";

const MilkingRecords = ({ animalId }: { animalId: string }) => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ 
    date: new Date().toISOString().split("T")[0], 
    liters: "",
    isSold: false,
    pricePerLiter: ""
  });
  const [filterPeriod, setFilterPeriod] = useState<"all" | "cycle" | "month">("all");
  const [latestCalvingDate, setLatestCalvingDate] = useState<Date | null>(null);
  const [animalGender, setAnimalGender] = useState<string | null>(null);
  const [animalFarmId, setAnimalFarmId] = useState<string | null>(null);
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  
  const { data: lastMilkPrice } = useLastMilkPrice(animalFarmId || "");
  const addRevenue = useAddRevenue();

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
      .select("gender, farm_id")
      .eq("id", animalId)
      .single();
    setAnimalGender(data?.gender || null);
    setAnimalFarmId(data?.farm_id || null);
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
    
    const liters = parseFloat(formData.liters);
    const pricePerLiter = formData.isSold ? parseFloat(formData.pricePerLiter) : null;
    const saleAmount = formData.isSold && pricePerLiter ? liters * pricePerLiter : null;
    
    const { data: milkRecord, error } = await supabase
      .from("milking_records")
      .insert({ 
        animal_id: animalId, 
        record_date: formData.date, 
        liters: liters, 
        created_by: user?.id,
        is_sold: formData.isSold,
        price_per_liter: pricePerLiter,
        sale_amount: saleAmount
      })
      .select()
      .single();
      
    if (error) {
      console.error('Insert milking record error:', error);
      toast({ title: "Error", description: "Unable to add milking record. Please try again.", variant: "destructive" });
      return;
    }
    
    // If sold, create a revenue record
    if (formData.isSold && saleAmount && animalFarmId && milkRecord) {
      try {
        await addRevenue.mutateAsync({
          farm_id: animalFarmId,
          amount: saleAmount,
          source: "Milk Sale",
          transaction_date: formData.date,
          linked_animal_id: animalId,
          linked_milk_log_id: milkRecord.id,
          notes: `${liters}L @ ₱${pricePerLiter}/L`
        });
      } catch (revenueError) {
        console.error('Insert revenue error:', revenueError);
        // Still show success for milking record, but warn about revenue
        toast({ title: "Partial Success", description: "Milking record added, but revenue tracking failed.", variant: "default" });
        setShowForm(false);
        resetForm();
        loadRecords();
        return;
      }
    }
    
    toast({ title: "Success", description: formData.isSold ? "Milking record and revenue added" : "Record added" }); 
    setShowForm(false); 
    resetForm();
    loadRecords();
  };
  
  const resetForm = () => {
    setFormData({ 
      date: new Date().toISOString().split("T")[0], 
      liters: "",
      isSold: false,
      pricePerLiter: ""
    });
  };

  // Set default price when last milk price loads
  useEffect(() => {
    if (lastMilkPrice && !formData.pricePerLiter) {
      setFormData(prev => ({ ...prev, pricePerLiter: String(lastMilkPrice) }));
    }
  }, [lastMilkPrice]);

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
            
            {/* Sale Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="is-sold" className="text-base">Did you sell this milk?</Label>
                <p className="text-xs text-muted-foreground">Track revenue from this production</p>
              </div>
              <Switch 
                id="is-sold" 
                checked={formData.isSold} 
                onCheckedChange={(checked) => setFormData(prev => ({ 
                  ...prev, 
                  isSold: checked,
                  pricePerLiter: checked && !prev.pricePerLiter ? String(lastMilkPrice || 65) : prev.pricePerLiter
                }))} 
              />
            </div>
            
            {/* Sale Details */}
            {formData.isSold && (
              <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="space-y-2">
                  <Label htmlFor="price-per-liter">Price per Liter (₱)</Label>
                  <Input 
                    id="price-per-liter" 
                    type="number" 
                    step="0.01" 
                    value={formData.pricePerLiter} 
                    onChange={(e) => setFormData(prev => ({ ...prev, pricePerLiter: e.target.value }))} 
                    required 
                    className="min-h-[48px]" 
                    placeholder="e.g. 65.00"
                  />
                </div>
                
                {formData.liters && formData.pricePerLiter && (
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <Info className="h-4 w-4" />
                    <span>
                      Total Earnings: ₱{(parseFloat(formData.liters) * parseFloat(formData.pricePerLiter)).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            )}
            
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