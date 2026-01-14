import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, format } from "date-fns";

export interface AnimalMissingMilking {
  animalId: string;
  animalName: string | null;
  earTag: string | null;
  missingSessions: ('AM' | 'PM')[];
}

export interface FarmhandActivity {
  userId: string;
  userName: string;
  role: string;
  activitiesCount: number;
  milkingCount: number;
  feedingCount: number;
  healthCount: number;
  lastActivityAt: string | null;
}

export interface DailyActivityCompliance {
  date: string;
  
  // Milking Compliance
  lactatingAnimalsCount: number;
  expectedMilkingSessions: number;
  completedMilkingSessions: { AM: number; PM: number; total: number };
  milkingCompliancePercent: number;
  animalsMissingMilking: AnimalMissingMilking[];
  
  // Feeding Compliance
  totalAnimalsCount: number;
  expectedFeedingSessions: number;
  completedFeedingSessions: number;
  feedingCompliancePercent: number;
  hasFeedingToday: boolean;
  
  // Team Activity
  farmhandActivity: FarmhandActivity[];
  
  // Current time context
  currentHour: number;
  isAfternoon: boolean;
}

export function useDailyActivityCompliance(farmId: string | null) {
  return useQuery<DailyActivityCompliance>({
    queryKey: ["daily-activity-compliance", farmId],
    queryFn: async () => {
      if (!farmId) throw new Error("Farm ID required");

      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const currentHour = today.getHours();
      const isAfternoon = currentHour >= 12;

      // Fetch all data in parallel
      const [
        animalsResult,
        milkingResult,
        feedingResult,
        membershipsResult
      ] = await Promise.all([
        // Get all active animals
        supabase
          .from("animals")
          .select("id, name, ear_tag, gender, milking_stage, is_currently_lactating")
          .eq("farm_id", farmId)
          .eq("is_deleted", false)
          .is("exit_date", null),
        
        // Get today's milking records
        supabase
          .from("milking_records")
          .select("id, animal_id, session, created_by, created_at")
          .gte("record_date", todayStr)
          .lte("record_date", todayStr),
        
        // Get today's feeding records
        supabase
          .from("feeding_records")
          .select("id, animal_id, created_by, created_at")
          .gte("record_datetime", startOfDay(today).toISOString())
          .lte("record_datetime", endOfDay(today).toISOString()),
        
        // Get farm memberships with profiles
        supabase
          .from("farm_memberships")
          .select(`
            user_id,
            role_in_farm,
            profiles!farm_memberships_user_id_fkey(
              full_name
            )
          `)
          .eq("farm_id", farmId)
          .not("user_id", "is", null)
      ]);

      const animals = animalsResult.data || [];
      const milkingRecords = milkingResult.data || [];
      const feedingRecords = feedingResult.data || [];
      const memberships = membershipsResult.data || [];

      // Filter lactating animals - use case-insensitive match for gender
      const lactatingAnimals = animals.filter(a => 
        a.gender?.toLowerCase() === 'female' && 
        (a.is_currently_lactating === true || 
         (a.milking_stage && a.milking_stage !== 'Dry Period'))
      );

      // Calculate milking compliance
      const lactatingAnimalsCount = lactatingAnimals.length;
      const expectedMilkingSessions = lactatingAnimalsCount * 2; // AM + PM

      // Group milking records by session
      const amMilkingAnimalIds = new Set(
        milkingRecords.filter(r => r.session === 'AM').map(r => r.animal_id)
      );
      const pmMilkingAnimalIds = new Set(
        milkingRecords.filter(r => r.session === 'PM').map(r => r.animal_id)
      );

      const completedMilkingSessions = {
        AM: amMilkingAnimalIds.size,
        PM: pmMilkingAnimalIds.size,
        total: amMilkingAnimalIds.size + pmMilkingAnimalIds.size
      };

      // Find animals missing milking
      const animalsMissingMilking: AnimalMissingMilking[] = lactatingAnimals
        .map(animal => {
          const missingSessions: ('AM' | 'PM')[] = [];
          if (!amMilkingAnimalIds.has(animal.id)) missingSessions.push('AM');
          if (!pmMilkingAnimalIds.has(animal.id) && isAfternoon) missingSessions.push('PM');
          
          if (missingSessions.length === 0) return null;
          
          return {
            animalId: animal.id,
            animalName: animal.name,
            earTag: animal.ear_tag,
            missingSessions
          };
        })
        .filter((a): a is AnimalMissingMilking => a !== null);

      const milkingCompliancePercent = expectedMilkingSessions > 0 
        ? Math.round((completedMilkingSessions.total / expectedMilkingSessions) * 100)
        : 100;

      // Calculate feeding compliance
      const totalAnimalsCount = animals.length;
      const expectedFeedingSessions = totalAnimalsCount * 2; // At least 2x/day
      const completedFeedingSessions = feedingRecords.length;
      const hasFeedingToday = feedingRecords.length > 0;
      const feedingCompliancePercent = expectedFeedingSessions > 0
        ? Math.min(100, Math.round((completedFeedingSessions / expectedFeedingSessions) * 100))
        : 100;

      // Calculate farmhand activity
      const farmhandActivity: FarmhandActivity[] = memberships.map(member => {
        const userId = member.user_id!;
        const milkingCount = milkingRecords.filter(r => r.created_by === userId).length;
        const feedingCount = feedingRecords.filter(r => r.created_by === userId).length;
        
        // Get last activity time
        const userMilkingTimes = milkingRecords
          .filter(r => r.created_by === userId)
          .map(r => new Date(r.created_at).getTime());
        const userFeedingTimes = feedingRecords
          .filter(r => r.created_by === userId)
          .map(r => new Date(r.created_at).getTime());
        
        const allTimes = [...userMilkingTimes, ...userFeedingTimes];
        const lastActivityAt = allTimes.length > 0 
          ? new Date(Math.max(...allTimes)).toISOString()
          : null;

        return {
          userId,
          userName: (member.profiles as any)?.full_name || 'Unknown',
          role: member.role_in_farm,
          activitiesCount: milkingCount + feedingCount,
          milkingCount,
          feedingCount,
          healthCount: 0, // Could add health records count
          lastActivityAt
        };
      });

      return {
        date: todayStr,
        lactatingAnimalsCount,
        expectedMilkingSessions,
        completedMilkingSessions,
        milkingCompliancePercent,
        animalsMissingMilking,
        totalAnimalsCount,
        expectedFeedingSessions,
        completedFeedingSessions,
        feedingCompliancePercent,
        hasFeedingToday,
        farmhandActivity,
        currentHour,
        isAfternoon
      };
    },
    enabled: !!farmId,
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000
  });
}
