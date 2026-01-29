import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AnimalOption } from "@/components/milk-recording/AnimalCombobox";
import { getEffectiveWeight, formatWeightWithSource } from "@/lib/animalWeightUtils";

export interface FarmAnimal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  livestock_type: string;
  current_weight_kg: number | null;
  entry_weight_kg?: number | null;
  entry_weight_unknown?: boolean | null;
  birth_weight_kg?: number | null;
  farm_entry_date?: string | null;
  birth_date?: string | null;
}

export function useFarmAnimals(farmId: string | null) {
  return useQuery({
    queryKey: ['farm-animals', farmId],
    queryFn: async () => {
      if (!farmId) return [];

      const { data, error } = await supabase
        .from('animals')
        .select('id, name, ear_tag, livestock_type, current_weight_kg, entry_weight_kg, entry_weight_unknown, birth_weight_kg, farm_entry_date, birth_date')
        .eq('farm_id', farmId)
        .is('exit_date', null)
        .eq('is_deleted', false)
        .order('name');

      if (error) throw error;
      return (data || []) as FarmAnimal[];
    },
    enabled: !!farmId,
  });
}

// Re-export utility for consumers
export { getEffectiveWeight, formatWeightWithSource };

export function getAnimalDropdownOptions(animals: FarmAnimal[]): AnimalOption[] {
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
  }, {} as Record<string, FarmAnimal[]>);

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
    
    options.push({
      value: animal.id,
      label: name,
      group: 'individual',
      subLabel: weightDisplay,
    });
  });

  return options;
}

export function getSelectedAnimals(
  animals: FarmAnimal[],
  selectedOption: string
): FarmAnimal[] {
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
