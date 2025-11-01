import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getCachedRecords } from "@/lib/dataCache";

export const useHealthRecords = (animalId: string) => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    loadRecords();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('health_records_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'health_records',
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

  const loadRecords = async () => {
    // Try cache first
    const cached = await getCachedRecords(animalId);
    if (cached?.health) {
      setRecords(cached.health);
      setLoading(false);
    }
    
    // Fetch fresh if online
    if (isOnline) {
      const { data, error } = await supabase
        .from("health_records")
        .select("*")
        .eq("animal_id", animalId)
        .order("visit_date", { ascending: false });
      
      if (error) {
        console.error('Error loading health records:', error);
        toast({
          title: "Error loading records",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setRecords(data || []);
      }
    }
    
    setLoading(false);
  };

  return {
    records,
    loading,
    reload: loadRecords
  };
};
