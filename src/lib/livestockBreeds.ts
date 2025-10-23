export const LIVESTOCK_BREEDS = {
  cattle: [
    "Not Sure",
    "Holstein",
    "Jersey",
    "Guernsey",
    "Ayrshire",
    "Brown Swiss",
    "Milking Shorthorn",
    "Angus",
    "Hereford",
    "Brahman",
    "Simmental",
    "Charolais",
    "Limousin",
    "Gelbvieh",
    "Red Poll",
    "Devon",
    "Philippine Native Cattle",
    "Mix Breed"
  ],
  goat: [
    "Not Sure",
    "Boer",
    "Saanen",
    "Alpine",
    "Nubian",
    "LaMancha",
    "Toggenburg",
    "Oberhasli",
    "Nigerian Dwarf",
    "Pygmy",
    "Philippine Native Goat",
    "Anglo-Nubian",
    "Mix Breed"
  ],
  sheep: [
    "Not Sure",
    "Merino",
    "Suffolk",
    "Dorper",
    "Hampshire",
    "Rambouillet",
    "Corriedale",
    "Romney",
    "Lincoln",
    "Philippine Native Sheep",
    "Mix Breed"
  ],
  carabao: [
    "Not Sure",
    "Swamp Buffalo (Philippine Carabao)",
    "River Buffalo (Murrah)",
    "River Buffalo (Nili-Ravi)",
    "River Buffalo (Mediterranean)",
    "Mix Breed"
  ]
} as const;

export type LivestockType = keyof typeof LIVESTOCK_BREEDS;

export function getBreedsByLivestockType(type: LivestockType): readonly string[] {
  return LIVESTOCK_BREEDS[type] || LIVESTOCK_BREEDS.cattle;
}
