import { format } from "date-fns";

interface AnimalDateInfo {
  farm_entry_date?: string | null;
  birth_date?: string | null;
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
