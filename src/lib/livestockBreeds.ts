/**
 * Comprehensive livestock breed database for Philippine farm management
 * 
 * Contains breed options for cattle, goats, sheep, and carabao (water buffalo).
 * Includes international breeds common in the Philippines as well as native breeds.
 * "Not Sure" and "Mix Breed" options accommodate farmers who don't know exact breeds.
 * 
 * @constant
 * @example
 * ```typescript
 * // Get all cattle breeds
 * const cattleBreeds = LIVESTOCK_BREEDS.cattle;
 * 
 * // Use in form dropdown
 * <Select>
 *   {LIVESTOCK_BREEDS[livestockType].map(breed => (
 *     <SelectItem key={breed} value={breed}>{breed}</SelectItem>
 *   ))}
 * </Select>
 * ```
 */
export const LIVESTOCK_BREEDS = {
  /**
   * Cattle breeds - dairy and beef cattle
   * Includes major dairy breeds (Holstein, Jersey) and beef breeds (Angus, Brahman)
   */
  cattle: [
    "Not Sure",
    "Holstein",                    // Top dairy breed
    "Jersey",                      // High butterfat dairy
    "Guernsey",                   // Golden milk dairy
    "Ayrshire",                   // Hardy dairy breed
    "Brown Swiss",                // Dual-purpose
    "Milking Shorthorn",          // Dairy breed
    "Angus",                      // Premium beef
    "Hereford",                   // Beef breed
    "Brahman",                    // Heat-tolerant beef
    "Simmental",                  // Dual-purpose
    "Charolais",                  // French beef
    "Limousin",                   // Lean beef
    "Gelbvieh",                   // German dual-purpose
    "Red Poll",                   // Dual-purpose
    "Devon",                      // Heritage breed
    "Philippine Native Cattle",    // Local breed
    "Mix Breed"
  ],
  
  /**
   * Goat breeds - dairy and meat goats
   * Includes Boer (meat) and Saanen (dairy) along with local breeds
   */
  goat: [
    "Not Sure",
    "Boer",                       // Premier meat goat
    "Saanen",                     // Top dairy goat
    "Alpine",                     // French dairy
    "Nubian",                     // Anglo-Nubian dairy
    "LaMancha",                   // American dairy
    "Toggenburg",                 // Swiss dairy
    "Oberhasli",                  // Swiss dairy
    "Nigerian Dwarf",             // Miniature dairy
    "Pygmy",                      // Miniature pet/meat
    "Philippine Native Goat",     // Local breed
    "Anglo-Nubian",              // British dairy
    "Mix Breed"
  ],
  
  /**
   * Sheep breeds - wool and meat sheep
   * Includes Merino (wool) and Dorper (meat) breeds
   */
  sheep: [
    "Not Sure",
    "Merino",                     // Fine wool
    "Suffolk",                    // Meat breed
    "Dorper",                     // Hair sheep, meat
    "Hampshire",                  // Meat breed
    "Rambouillet",               // Fine wool
    "Corriedale",                // Dual-purpose
    "Romney",                     // Long wool
    "Lincoln",                    // Long wool
    "Philippine Native Sheep",    // Local breed
    "Mix Breed"
  ],
  
  /**
   * Carabao (water buffalo) breeds - working and dairy animals
   * Specific to Philippines and Southeast Asia
   */
  carabao: [
    "Not Sure",
    "Swamp Buffalo (Philippine Carabao)",  // Local working breed
    "River Buffalo (Murrah)",              // Indian dairy breed
    "River Buffalo (Nili-Ravi)",          // Pakistani dairy breed
    "River Buffalo (Mediterranean)",       // European breed
    "Mix Breed"
  ]
} as const;

/**
 * Type representing available livestock types
 * 
 * @example
 * ```typescript
 * const selectLivestock = (type: LivestockType) => {
 *   const breeds = LIVESTOCK_BREEDS[type];
 * };
 * ```
 */
export type LivestockType = keyof typeof LIVESTOCK_BREEDS;

/**
 * Get breed options for a specific livestock type
 * 
 * Returns the appropriate breed array based on livestock type.
 * Defaults to cattle breeds if an invalid type is provided.
 * 
 * @param type - The type of livestock (cattle, goat, sheep, carabao)
 * @returns Array of breed names for the specified livestock type
 * 
 * @example
 * ```typescript
 * // Get goat breeds
 * const goatBreeds = getBreedsByLivestockType('goat');
 * console.log(goatBreeds); // ['Not Sure', 'Boer', 'Saanen', ...]
 * 
 * // Use in dynamic form
 * const [livestockType, setLivestockType] = useState<LivestockType>('cattle');
 * const breeds = getBreedsByLivestockType(livestockType);
 * ```
 */
export function getBreedsByLivestockType(type: LivestockType): readonly string[] {
  return LIVESTOCK_BREEDS[type] || LIVESTOCK_BREEDS.cattle;
}
