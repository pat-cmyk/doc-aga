export const EXPENSE_CATEGORIES = [
  "Feed & Supplements",
  "Veterinary Services",
  "Medicine & Vaccines",
  "Labor/Wages",
  "Equipment & Tools",
  "Facility Maintenance",
  "Utilities",
  "Transportation",
  "Breeding Services",
  "Marketing & Sales",
  "Other",
] as const;

export const PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "Credit/Loan",
  "Mobile Money",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
