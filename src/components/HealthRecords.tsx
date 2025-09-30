import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const HealthRecords = ({ animalId }: { animalId: string }) => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("health_records").select("*").eq("animal_id", animalId).order("visit_date", { ascending: false });
      setRecords(data || []);
      setLoading(false);
    };
    load();
  }, [animalId]);

  if (loading) return <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;

  return (
    <Card><CardContent className="pt-6">
      {records.length === 0 ? <p className="text-center text-muted-foreground">No health records yet</p> :
      <div className="space-y-2">{records.map(r => <Card key={r.id}><CardContent className="p-3"><p className="text-sm font-medium">{new Date(r.visit_date).toLocaleDateString()}</p><p className="text-sm text-muted-foreground">{r.diagnosis}</p></CardContent></Card>)}</div>}
    </CardContent></Card>
  );
};

export default HealthRecords;