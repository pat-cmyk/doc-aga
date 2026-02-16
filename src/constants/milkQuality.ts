/**
 * Milk quality status and rejection reason constants.
 * SSOT for all milk recording forms (single, bulk, edit dialogs).
 */

export const MILK_QUALITY_OPTIONS = [
  { value: 'good', label: 'Good Quality / Magandang Kalidad' },
  { value: 'rejected', label: 'Rejected / Tinanggihan' },
] as const;

export const MILK_REJECTION_REASONS = [
  { value: 'abnormal_color', label: 'Abnormal Color / Kakaibang Kulay' },
  { value: 'blood_in_milk', label: 'Blood in Milk / May Dugo' },
  { value: 'bad_smell', label: 'Bad Smell / Mabaho' },
  { value: 'clots_or_flakes', label: 'Clots or Flakes / May Buo-buo' },
  { value: 'watery', label: 'Watery / Malapot' },
  { value: 'contaminated', label: 'Contaminated / Kontaminado' },
  { value: 'mastitis', label: 'Mastitis Suspected / Hinala na Mastitis' },
  { value: 'antibiotic_withdrawal', label: 'Antibiotic Withdrawal Period' },
  { value: 'other', label: 'Other / Iba Pa' },
  { value: 'none', label: 'No Data / Hindi Alam' },
] as const;

export type MilkQuality = 'good' | 'rejected';
export type MilkRejectionReason = typeof MILK_REJECTION_REASONS[number]['value'];
