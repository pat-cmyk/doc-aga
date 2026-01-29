import { format } from "date-fns";

interface AnimalDateInfo {
  farm_entry_date?: string | null;
  birth_date?: string | null;
}

export interface AnimalWithDates {
  id: string;
  farm_entry_date?: string | null;
  birth_date?: string | null;
  [key: string]: any;
}

interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Validates that a record date is not before the animal's farm entry date.
 * This prevents recording activities for a time when the animal wasn't yet on the farm.
 */
export function validateRecordDate(
  recordDate: string | Date,
  animal: AnimalDateInfo
): ValidationResult {
  const date = new Date(recordDate);
  
  // Check against farm entry date (for new entrants)
  if (animal.farm_entry_date) {
    const entryDate = new Date(animal.farm_entry_date);
    // Reset time to compare dates only
    entryDate.setHours(0, 0, 0, 0);
    const recordDateOnly = new Date(date);
    recordDateOnly.setHours(0, 0, 0, 0);
    
    if (recordDateOnly < entryDate) {
      return {
        valid: false,
        message: `Record date (${format(date, "MMM d, yyyy")}) cannot be before farm entry date (${format(entryDate, "MMM d, yyyy")})`
      };
    }
  }
  
  return { valid: true };
}

/**
 * Gets the earliest valid date for records (farm entry date or birth date)
 */
export function getEarliestValidDate(animal: AnimalDateInfo): Date | null {
  if (animal.farm_entry_date) {
    return new Date(animal.farm_entry_date);
  }
  if (animal.birth_date) {
    return new Date(animal.birth_date);
  }
  return null;
}

/**
 * Filters animals to only include those that were on the farm
 * on the specified date.
 * 
 * Logic:
 * - If farm_entry_date exists: animal must have entered on or before recordDate
 * - If no farm_entry_date (farm-born): use birth_date, must be on or before recordDate
 * - If neither date exists: include animal (defensive - shouldn't happen)
 */
export function filterAnimalsByFarmDate<T extends AnimalWithDates>(
  animals: T[],
  recordDate: Date
): T[] {
  const recordDateOnly = new Date(recordDate);
  recordDateOnly.setHours(0, 0, 0, 0);

  return animals.filter(animal => {
    // Determine the earliest date this animal was on the farm
    const effectiveDate = animal.farm_entry_date || animal.birth_date;
    
    if (!effectiveDate) {
      // No date info - include by default (edge case)
      return true;
    }

    const animalDate = new Date(effectiveDate);
    animalDate.setHours(0, 0, 0, 0);

    // Animal must have been on farm on or before the record date
    return animalDate <= recordDateOnly;
  });
}
