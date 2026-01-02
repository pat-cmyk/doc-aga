import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const LACTATING_STAGES = ['Early Lactation', 'Mid-Lactation', 'Late Lactation'];

export interface LactatingAnimal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  livestock_type: string;
  milking_stage: string | null;
  current_weight_kg: number | null;
}

export function useLactatingAnimals(farmId: string | null) {
  return useQuery({
    queryKey: ['lactating-animals', farmId],
    queryFn: async () => {
      if (!farmId) return [];

      const { data, error } = await supabase
        .from('animals')
        .select('id, name, ear_tag, livestock_type, milking_stage, current_weight_kg')
        .eq('farm_id', farmId)
        .eq('gender', 'Female')
        .in('milking_stage', LACTATING_STAGES)
        .is('exit_date', null)
        .eq('is_deleted', false)
        .order('name');

      if (error) throw error;
      return (data || []) as LactatingAnimal[];
    },
    enabled: !!farmId,
  });
}

export function getAnimalDropdownOptions(animals: LactatingAnimal[]) {
  const options: { value: string; label: string; count?: number }[] = [];
  
  if (animals.length === 0) return options;

  // Get unique species
  const species = [...new Set(animals.map(a => a.livestock_type))];

  // Add "All Animals" option
  options.push({
    value: 'all',
    label: `All Animals (${animals.length})`,
    count: animals.length,
  });

  // Add "All {Species}" for multi-species farms
  if (species.length > 1) {
    species.forEach(s => {
      const count = animals.filter(a => a.livestock_type === s).length;
      const displayName = s.charAt(0).toUpperCase() + s.slice(1);
      options.push({
        value: `all-${s}`,
        label: `All ${displayName} (${count})`,
        count,
      });
    });
  }

  // Add separator marker
  options.push({ value: '__separator__', label: '───────────' });

  // Add individual animals
  animals.forEach(a => {
    const stageSuffix = a.milking_stage ? ` • ${a.milking_stage.replace(' Lactation', '')}` : '';
    options.push({
      value: a.id,
      label: `${a.name || a.ear_tag || 'Unknown'}${stageSuffix}`,
    });
  });

  return options;
}

export function getSelectedAnimals(
  animals: LactatingAnimal[],
  selectedOption: string
): LactatingAnimal[] {
  if (!selectedOption || selectedOption === '__separator__') return [];

  if (selectedOption === 'all') {
    return animals;
  }

  if (selectedOption.startsWith('all-')) {
    const species = selectedOption.replace('all-', '');
    return animals.filter(a => a.livestock_type === species);
  }

  // Individual animal
  const animal = animals.find(a => a.id === selectedOption);
  return animal ? [animal] : [];
}
