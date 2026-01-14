import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useDailyActivityCompliance } from '@/hooks/useDailyActivityCompliance';
import { useDailyHeatMonitoring } from '@/hooks/useDailyHeatMonitoring';
import { Json } from '@/integrations/supabase/types';

export interface ChecklistItemStatus {
  completed: boolean;
  time?: string;
  completedBy?: string;
}

export interface CompletedItems {
  am_milking?: ChecklistItemStatus;
  pm_milking?: ChecklistItemStatus;
  morning_feeding?: ChecklistItemStatus;
  evening_feeding?: ChecklistItemStatus;
  heat_observation?: ChecklistItemStatus;
  health_check?: ChecklistItemStatus;
  [key: string]: ChecklistItemStatus | undefined;
}

function parseCompletedItems(json: Json | null): CompletedItems {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return {};
  }
  return json as unknown as CompletedItems;
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  required: boolean;
  icon: 'milk' | 'wheat' | 'heart' | 'stethoscope';
  timeCategory: 'morning' | 'afternoon' | 'anytime';
  autoCompleted?: boolean;
}

export interface DailyChecklist {
  id?: string;
  date: string;
  items: ChecklistItem[];
  completionPercent: number;
  allRequiredComplete: boolean;
}

function getDefaultChecklistItems(
  hasLactatingAnimals: boolean,
  hasBreedingEligible: boolean,
  amMilkingDone: boolean,
  pmMilkingDone: boolean,
  feedingDone: boolean
): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  // Morning tasks
  if (hasLactatingAnimals) {
    items.push({
      id: 'am_milking',
      label: 'AM Milking',
      completed: amMilkingDone,
      required: true,
      icon: 'milk',
      timeCategory: 'morning',
      autoCompleted: amMilkingDone,
    });
  }

  items.push({
    id: 'morning_feeding',
    label: 'Morning Feeding',
    completed: feedingDone,
    required: true,
    icon: 'wheat',
    timeCategory: 'morning',
    autoCompleted: feedingDone,
  });

  if (hasBreedingEligible) {
    items.push({
      id: 'heat_observation',
      label: 'Heat Detection Check',
      completed: false,
      required: true,
      icon: 'heart',
      timeCategory: 'morning',
    });
  }

  // Afternoon tasks
  if (hasLactatingAnimals) {
    items.push({
      id: 'pm_milking',
      label: 'PM Milking',
      completed: pmMilkingDone,
      required: true,
      icon: 'milk',
      timeCategory: 'afternoon',
      autoCompleted: pmMilkingDone,
    });
  }

  items.push({
    id: 'evening_feeding',
    label: 'Evening Feeding',
    completed: false,
    required: true,
    icon: 'wheat',
    timeCategory: 'afternoon',
  });

  // Anytime tasks
  items.push({
    id: 'health_check',
    label: 'Visual Health Check',
    completed: false,
    required: false,
    icon: 'stethoscope',
    timeCategory: 'anytime',
  });

  return items;
}

export function useDailyChecklist(farmId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  // Get compliance data to auto-complete items
  const { data: compliance } = useDailyActivityCompliance(farmId || '');
  const { data: heatData } = useDailyHeatMonitoring(farmId);

  const hasLactatingAnimals = (compliance?.lactatingAnimalsCount || 0) > 0;
  const hasBreedingEligible = (heatData?.breedingEligibleCount || 0) > 0;

  // Check if milking/feeding is done from compliance data
  const amMilkingDone = (compliance?.completedMilkingSessions?.AM || 0) > 0;
  const pmMilkingDone = (compliance?.completedMilkingSessions?.PM || 0) > 0;
  const feedingDone = compliance?.hasFeedingToday || false;

  const { data: checklist, isLoading } = useQuery({
    queryKey: ['daily-checklist', farmId, today],
    queryFn: async (): Promise<DailyChecklist> => {
      if (!farmId) {
        return {
          date: today,
          items: [],
          completionPercent: 0,
          allRequiredComplete: true,
        };
      }

      // Fetch existing checklist for today
      const { data: existing, error } = await supabase
        .from('daily_farm_checklists')
        .select('*')
        .eq('farm_id', farmId)
        .eq('checklist_date', today)
        .maybeSingle();

      if (error) throw error;

      // Get default items with auto-completion
      const defaultItems = getDefaultChecklistItems(
        hasLactatingAnimals,
        hasBreedingEligible,
        amMilkingDone,
        pmMilkingDone,
        feedingDone
      );

      // Merge with saved data
      const savedItems = parseCompletedItems(existing?.completed_items ?? null);
      const mergedItems = defaultItems.map(item => {
        const saved = savedItems[item.id];
        // Auto-completed items always show as completed
        if (item.autoCompleted) {
          return item;
        }
        return {
          ...item,
          completed: saved?.completed || false,
          completedAt: saved?.time,
          completedBy: saved?.completedBy,
        };
      });

      const completedCount = mergedItems.filter(i => i.completed).length;
      const requiredItems = mergedItems.filter(i => i.required);
      const allRequiredComplete = requiredItems.every(i => i.completed);

      return {
        id: existing?.id,
        date: today,
        items: mergedItems,
        completionPercent: mergedItems.length > 0 ? Math.round((completedCount / mergedItems.length) * 100) : 0,
        allRequiredComplete,
      };
    },
    enabled: !!farmId,
    staleTime: 30 * 1000,
  });

  const toggleItem = useMutation({
    mutationFn: async ({ itemId, completed }: { itemId: string; completed: boolean }) => {
      if (!farmId) throw new Error('No farm selected');

      const { data: userData } = await supabase.auth.getUser();
      const now = format(new Date(), 'HH:mm');

      // Get current items
      const { data: existing } = await supabase
        .from('daily_farm_checklists')
        .select('completed_items')
        .eq('farm_id', farmId)
        .eq('checklist_date', today)
        .maybeSingle();

      const currentItems = parseCompletedItems(existing?.completed_items ?? null);
      const updatedItems: Record<string, ChecklistItemStatus> = {
        ...currentItems,
        [itemId]: completed
          ? { completed: true, time: now, completedBy: userData?.user?.id }
          : { completed: false },
      };

      // Upsert the checklist
      const { error } = await supabase
        .from('daily_farm_checklists')
        .upsert(
          {
            farm_id: farmId,
            checklist_date: today,
            completed_items: updatedItems as unknown as Json,
            completed_by: userData?.user?.id,
            updated_at: new Date().toISOString(),
          }, 
          { onConflict: 'farm_id,checklist_date' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-checklist', farmId, today] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    checklist,
    isLoading,
    toggleItem,
  };
}
