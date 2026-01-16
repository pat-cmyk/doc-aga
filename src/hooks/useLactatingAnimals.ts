import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getLactatingAnimalsOrFilter } from "@/lib/animalQueries";
import { formatWeightWithSource } from "@/lib/animalWeightUtils";

export interface LactatingAnimal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  livestock_type: string;
  milking_stage: string | null;
  current_weight_kg: number | null;
  entry_weight_kg?: number | null;
  entry_weight_unknown?: boolean | null;
  birth_weight_kg?: number | null;
  is_currently_lactating?: boolean | null;
  milking_start_date?: string | null;
  estimated_days_in_milk?: number | null;
}

export function useLactatingAnimals(farmId: string | null) {
  return useQuery({
    queryKey: ['lactating-animals', farmId],
    queryFn: async () => {
      if (!farmId) return [];

      // Include animals with is_currently_lactating = true OR milking_stage in lactating stages
      const { data, error } = await supabase
        .from('animals')
        .select('id, name, ear_tag, livestock_type, milking_stage, current_weight_kg, entry_weight_kg, entry_weight_unknown, birth_weight_kg, is_currently_lactating, milking_start_date, estimated_days_in_milk')
        .eq('farm_id', farmId)
        .eq('gender', 'Female')
        .is('exit_date', null)
        .eq('is_deleted', false)
        .or(getLactatingAnimalsOrFilter())
        .order('name');

      if (error) throw error;
      return (data || []) as LactatingAnimal[];
    },
    enabled: !!farmId,
  });
}

// Re-export utility for consumers
export { formatWeightWithSource };

import type { AnimalOption } from "@/components/milk-recording/AnimalCombobox";

export function getAnimalDropdownOptions(animals: LactatingAnimal[]): AnimalOption[] {
  if (animals.length === 0) return [];

  const options: AnimalOption[] = [];

  // "All Animals" option
  options.push({
    value: 'all',
    label: `All Animals (${animals.length})`,
    group: 'quick',
  });

  // Group by species for "All Species" options
  const speciesGroups = animals.reduce((acc, animal) => {
    const species = animal.livestock_type;
    if (!acc[species]) acc[species] = [];
    acc[species].push(animal);
    return acc;
  }, {} as Record<string, LactatingAnimal[]>);

  const speciesTypes = Object.keys(speciesGroups);

  // Add "All {Species}" options if multiple species exist
  if (speciesTypes.length > 1) {
    speciesTypes.forEach((species) => {
      const count = speciesGroups[species].length;
      options.push({
        value: `species:${species}`,
        label: `All ${species.charAt(0).toUpperCase() + species.slice(1)} (${count})`,
        group: 'quick',
      });
    });
  }

  // Add individual animals
  animals.forEach((animal) => {
    const name = animal.name || animal.ear_tag || 'Unknown';
    const weightDisplay = formatWeightWithSource(animal);
    const stage = animal.milking_stage || 'Unknown stage';
    
    options.push({
      value: animal.id,
      label: name,
      group: 'individual',
      subLabel: `${weightDisplay} • ${stage}`,
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

  if (selectedOption.startsWith('species:')) {
    const species = selectedOption.replace('species:', '');
    return animals.filter(a => a.livestock_type === species);
  }

  // Individual animal
  const animal = animals.find(a => a.id === selectedOption);
  return animal ? [animal] : [];
}
