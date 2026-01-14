import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, differenceInDays, parseISO } from "date-fns";

export interface DataGapAlert {
  id: string;
  alertType: 'milking_gap' | 'feeding_gap' | 'health_gap';
  title: string;
  description: string;
  daysMissing: number;
  lastRecordDate: string | null;
  affectedAnimalsCount: number;
  urgency: 'critical' | 'warning' | 'info';
}

export interface DataGapSummary {
  milking: {
    lastRecordDate: string | null;
    daysSinceLastRecord: number;
    hasGap: boolean;
    lactatingAnimalsCount: number;
  };
  feeding: {
    lastRecordDate: string | null;
    daysSinceLastRecord: number;
    hasGap: boolean;
  };
  alerts: DataGapAlert[];
}

export function useDataGapAlerts(farmId: string | null) {
  return useQuery<DataGapSummary>({
    queryKey: ["data-gap-alerts", farmId],
    queryFn: async () => {
      if (!farmId) throw new Error("Farm ID required");

      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const lookbackDays = 14; // Check last 2 weeks for gaps
      const lookbackDate = format(subDays(today, lookbackDays), 'yyyy-MM-dd');

      // Get active lactating animals for this farm
      const { data: animals, error: animalsError } = await supabase
        .from("animals")
        .select("id, farm_id")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .is("exit_date", null);

      if (animalsError) throw animalsError;
      const animalIds = animals?.map(a => a.id) || [];

      if (animalIds.length === 0) {
        return {
          milking: {
            lastRecordDate: null,
            daysSinceLastRecord: 0,
            hasGap: false,
            lactatingAnimalsCount: 0,
          },
          feeding: {
            lastRecordDate: null,
            daysSinceLastRecord: 0,
            hasGap: false,
          },
          alerts: [],
        };
      }

      // Get lactating animals count - use case-insensitive match for gender
      const { data: lactatingAnimals } = await supabase
        .from("animals")
        .select("id")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .is("exit_date", null)
        .ilike("gender", "female")
        .or("is_currently_lactating.eq.true,milking_stage.in.(\"Early Lactation\",\"Mid-Lactation\",\"Late Lactation\")");

      const lactatingCount = lactatingAnimals?.length || 0;

      // Get latest milking record date for this farm's animals (no lookback limit for accurate gap detection)
      const { data: latestMilking } = await supabase
        .from("milking_records")
        .select("record_date, animal_id")
        .in("animal_id", animalIds)
        .lte("record_date", todayStr)
        .order("record_date", { ascending: false })
        .limit(1);

      // Get latest feeding record date (no lookback limit for accurate gap detection)
      const { data: latestFeeding } = await supabase
        .from("feeding_records")
        .select("record_datetime, animal_id")
        .in("animal_id", animalIds)
        .lte("record_datetime", `${todayStr}T23:59:59`)
        .order("record_datetime", { ascending: false })
        .limit(1);

      // Calculate gaps
      const lastMilkingDate = latestMilking?.[0]?.record_date || null;
      const lastFeedingDate = latestFeeding?.[0]?.record_datetime 
        ? format(parseISO(latestFeeding[0].record_datetime), 'yyyy-MM-dd')
        : null;

      // Calculate actual days since last record (no artificial caps)
      const daysSinceMilking = lastMilkingDate 
        ? differenceInDays(today, parseISO(lastMilkingDate))
        : 999; // Very high number to indicate never recorded

      const daysSinceFeeding = lastFeedingDate
        ? differenceInDays(today, parseISO(lastFeedingDate))
        : 999; // Very high number to indicate never recorded

      // Generate alerts
      const alerts: DataGapAlert[] = [];

      // Milking gap alert (if lactating animals exist and gap > 1 day)
      if (lactatingCount > 0 && daysSinceMilking > 1) {
        const urgency = daysSinceMilking >= 3 ? 'critical' 
          : daysSinceMilking >= 2 ? 'warning' 
          : 'info';

        alerts.push({
          id: 'milking-gap',
          alertType: 'milking_gap',
          title: daysSinceMilking >= 999 
            ? 'No milking records found' 
            : `No milk records for ${daysSinceMilking} days`,
          description: lastMilkingDate 
            ? `Last record: ${format(parseISO(lastMilkingDate), 'MMM d')}`
            : 'No records in database',
          daysMissing: daysSinceMilking,
          lastRecordDate: lastMilkingDate,
          affectedAnimalsCount: lactatingCount,
          urgency,
        });
      }

      // Feeding gap alert (if gap > 1 day)
      if (daysSinceFeeding > 1) {
        const urgency = daysSinceFeeding >= 3 ? 'critical' 
          : daysSinceFeeding >= 2 ? 'warning' 
          : 'info';

        alerts.push({
          id: 'feeding-gap',
          alertType: 'feeding_gap',
          title: daysSinceFeeding >= 999 
            ? 'No feeding records found' 
            : `No feeding records for ${daysSinceFeeding} days`,
          description: lastFeedingDate 
            ? `Last record: ${format(parseISO(lastFeedingDate), 'MMM d')}`
            : 'No records in database',
          daysMissing: daysSinceFeeding,
          lastRecordDate: lastFeedingDate,
          affectedAnimalsCount: animalIds.length,
          urgency,
        });
      }

      return {
        milking: {
          lastRecordDate: lastMilkingDate,
          daysSinceLastRecord: daysSinceMilking,
          hasGap: lactatingCount > 0 && daysSinceMilking > 1,
          lactatingAnimalsCount: lactatingCount,
        },
        feeding: {
          lastRecordDate: lastFeedingDate,
          daysSinceLastRecord: daysSinceFeeding,
          hasGap: daysSinceFeeding > 1,
        },
        alerts,
      };
    },
    enabled: !!farmId,
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // Refresh every 5 minutes
  });
}

export function getGapUrgencyColor(urgency: DataGapAlert['urgency']) {
  switch (urgency) {
    case 'critical':
      return 'text-destructive bg-destructive/10 border-destructive/30';
    case 'warning':
      return 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800';
    default:
      return 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800';
  }
}
