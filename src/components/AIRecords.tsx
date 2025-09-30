import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const AIRecords = ({ animalId }: { animalId: string }) => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("ai_records").select("*").eq("animal_id", animalId).order("scheduled_date", { ascending: false });
      setRecords(data || []);
      setLoading(false);
    };
    load();
  }, [animalId]);

  if (loading) return <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;

  return (
    <Card><CardContent className="pt-6">
      {records.length === 0 ? <p className="text-center text-muted-foreground">No AI records yet</p> :
      <div className="space-y-2">{records.map(r => <Card key={r.id}><CardContent className="p-3"><p className="text-sm font-medium">Scheduled: {r.scheduled_date ? new Date(r.scheduled_date).toLocaleDateString() : "N/A"}</p>{r.performed_date && <p className="text-sm text-muted-foreground">Performed: {new Date(r.performed_date).toLocaleDateString()}</p>}</CardContent></Card>)}</div>}
    </CardContent></Card>
  );
};

export default AIRecords;