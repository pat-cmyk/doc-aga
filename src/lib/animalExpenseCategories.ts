/**
 * Expense categories relevant to individual animal cost tracking
 * 
 * These are a subset of farm expense categories specifically for
 * tracking costs associated with individual animals.
 */
export const ANIMAL_EXPENSE_CATEGORIES = [
  "Veterinary Services",
  "Medicine & Vaccines",
  "Breeding Services",
  "Feed & Supplements",
  "Other",
] as const;

export type AnimalExpenseCategory = (typeof ANIMAL_EXPENSE_CATEGORIES)[number];
