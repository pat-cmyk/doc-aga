import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getLactatingAnimalsOrFilter } from "@/lib/animalQueries";

export interface LactatingAnimal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  livestock_type: string;
  milking_stage: string | null;
  current_weight_kg: number | null;
  is_currently_lactating?: boolean | null;
}

export function useLactatingAnimals(farmId: string | null) {
  return useQuery({
    queryKey: ['lactating-animals', farmId],
    queryFn: async () => {
      if (!farmId) return [];

      // Include animals with is_currently_lactating = true OR milking_stage in lactating stages
      const { data, error } = await supabase
        .from('animals')
        .select('id, name, ear_tag, livestock_type, milking_stage, current_weight_kg, is_currently_lactating')
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
    const weight = animal.current_weight_kg ? `${animal.current_weight_kg}kg` : 'No weight';
    const stage = animal.milking_stage || 'Unknown stage';
    
    options.push({
      value: animal.id,
      label: name,
      group: 'individual',
      subLabel: `${weight} • ${stage}`,
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
