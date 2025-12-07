/**
 * Standard expense categories for farm financial tracking
 * 
 * These categories help farmers organize and analyze their farm expenses.
 * Each category represents a major cost center in livestock farming operations.
 * 
 * @constant
 * @example
 * ```typescript
 * // Use in dropdown selection
 * <Select>
 *   {EXPENSE_CATEGORIES.map(category => (
 *     <SelectItem key={category} value={category}>
 *       {category}
 *     </SelectItem>
 *   ))}
 * </Select>
 * ```
 */
export const EXPENSE_CATEGORIES = [
  "Feed & Supplements",      // Animal feed, minerals, vitamins
  "Veterinary Services",     // Vet visits, consultations
  "Medicine & Vaccines",     // Drugs, vaccines, treatments
  "Labor/Wages",            // Employee salaries, contractor fees
  "Equipment & Tools",      // Farm machinery, tools, repairs
  "Facility Maintenance",   // Building repairs, infrastructure
  "Utilities",             // Water, electricity, gas
  "Transportation",        // Vehicle fuel, transport fees
  "Breeding Services",     // AI, bull services
  "Marketing & Sales",     // Advertising, market fees
  "Other",                // Miscellaneous expenses
] as const;

/**
 * Payment methods available for recording farm expenses
 * 
 * Tracks how expenses were paid to help with cash flow management
 * and financial reconciliation.
 * 
 * @constant
 * @example
 * ```typescript
 * // Use in payment method selection
 * <RadioGroup>
 *   {PAYMENT_METHODS.map(method => (
 *     <RadioGroupItem key={method} value={method}>
 *       {method}
 *     </RadioGroupItem>
 *   ))}
 * </RadioGroup>
 * ```
 */
export const PAYMENT_METHODS = [
  "Cash",              // Physical cash payment
  "Bank Transfer",     // Electronic bank transfer
  "Credit/Loan",      // Borrowed money, credit purchase
  "Mobile Money",     // GCash, PayMaya, etc.
  "Other",           // Alternative payment methods
] as const;

/**
 * TypeScript type for expense categories
 * 
 * Ensures type safety when working with expense categories throughout the app.
 * 
 * @example
 * ```typescript
 * const handleExpense = (category: ExpenseCategory, amount: number) => {
 *   // TypeScript will ensure category is valid
 * };
 * ```
 */
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/**
 * TypeScript type for payment methods
 * 
 * Ensures type safety when working with payment methods throughout the app.
 * 
 * @example
 * ```typescript
 * const processPayment = (method: PaymentMethod) => {
 *   if (method === "Mobile Money") {
 *     // Handle mobile payment
 *   }
 * };
 * ```
 */
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Allocation types for expense tracking
 * 
 * Distinguishes between farm business expenses and personal expenses.
 * Personal expenses are tracked in cash flow but excluded from farm profitability calculations.
 * 
 * @constant
 */
export const ALLOCATION_TYPES = {
  FARM: 'Operational',
  PERSONAL: 'Personal',
} as const;

/**
 * TypeScript type for allocation types
 */
export type AllocationType = (typeof ALLOCATION_TYPES)[keyof typeof ALLOCATION_TYPES];
