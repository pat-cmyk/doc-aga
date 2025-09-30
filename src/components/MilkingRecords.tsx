import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MilkingRecords = ({ animalId }: { animalId: string }) => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ date: new Date().toISOString().split("T")[0], liters: "" });
  const { toast } = useToast();

  useEffect(() => {
    loadRecords();
  }, [animalId]);

  const loadRecords = async () => {
    const { data } = await supabase.from("milking_records").select("*").eq("animal_id", animalId).order("record_date", { ascending: false });
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

  return (
    <Card><CardContent className="pt-6 space-y-4">
      {!showForm ? <Button onClick={() => setShowForm(true)} className="w-full"><Plus className="h-4 w-4 mr-2" />Add Milking Record</Button> : 
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><Label>Date</Label><Input type="date" value={formData.date} onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))} required /></div>
        <div><Label>Liters</Label><Input type="number" step="0.01" value={formData.liters} onChange={(e) => setFormData(prev => ({ ...prev, liters: e.target.value }))} required /></div>
        <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button><Button type="submit" className="flex-1">Save</Button></div>
      </form>}
      <div className="space-y-2">{records.map(r => <Card key={r.id}><CardContent className="p-3 flex justify-between"><span className="text-sm">{new Date(r.record_date).toLocaleDateString()}</span><span className="font-semibold">{r.liters}L</span></CardContent></Card>)}</div>
    </CardContent></Card>
  );
};

export default MilkingRecords;