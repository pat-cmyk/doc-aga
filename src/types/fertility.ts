/**
 * Fertility Status Types
 * 
 * Centralized types for the fertility management system
 * to prevent circular dependencies between hooks and components.
 */

// Must match the database enum exactly
export type FertilityStatus =
  | 'not_eligible'
  | 'open_cycling'
  | 'in_heat'
  | 'bred_waiting'
  | 'suspected_pregnant'
  | 'confirmed_pregnant'
  | 'fresh_postpartum';

export interface FertilityStatusConfig {
  status: FertilityStatus;
  label: string;
  labelTagalog: string;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
  descriptionTagalog: string;
}

export const FERTILITY_STATUS_CONFIG: Record<FertilityStatus, FertilityStatusConfig> = {
  not_eligible: {
    status: 'not_eligible',
    label: 'Not Eligible',
    labelTagalog: 'Hindi Karapat-dapat',
    icon: '⚪',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    description: 'Too young, underweight, or male',
    descriptionTagalog: 'Masyadong bata, mababa ang timbang, o lalaki',
  },
  open_cycling: {
    status: 'open_cycling',
    label: 'Open & Cycling',
    labelTagalog: 'Bukas at Umiikot',
    icon: '🟢',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    description: 'Eligible, awaiting heat detection',
    descriptionTagalog: 'Karapat-dapat, naghihintay ng init',
  },
  in_heat: {
    status: 'in_heat',
    label: 'In Heat',
    labelTagalog: 'May Init',
    icon: '🔥',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    description: 'Optimal breeding window active',
    descriptionTagalog: 'Aktibo ang pinakamainam na panahon ng pagpapaanak',
  },
  bred_waiting: {
    status: 'bred_waiting',
    label: 'Bred - Waiting',
    labelTagalog: 'Na-AI - Naghihintay',
    icon: '🎯',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    description: 'AI performed, waiting for non-return',
    descriptionTagalog: 'Natapos ang AI, naghihintay kung hindi na babalik ang init',
  },
  suspected_pregnant: {
    status: 'suspected_pregnant',
    label: 'Suspected Pregnant',
    labelTagalog: 'Posibleng Buntis',
    icon: '🔍',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    description: 'No heat return, needs confirmation',
    descriptionTagalog: 'Walang bumalik na init, kailangan ng kumpirmasyon',
  },
  confirmed_pregnant: {
    status: 'confirmed_pregnant',
    label: 'Pregnant',
    labelTagalog: 'Buntis',
    icon: '🤰',
    color: 'text-pink-600 dark:text-pink-400',
    bgColor: 'bg-pink-100 dark:bg-pink-900/30',
    description: 'Pregnancy verified',
    descriptionTagalog: 'Nakumpirma ang pagbubuntis',
  },
  fresh_postpartum: {
    status: 'fresh_postpartum',
    label: 'Fresh (Postpartum)',
    labelTagalog: 'Bagong Panganak',
    icon: '👶',
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-100 dark:bg-teal-900/30',
    description: 'Just calved, in voluntary waiting period',
    descriptionTagalog: 'Kakapanganak, nasa panahon ng pagpapahinga',
  },
};

export type BreedingEventType =
  | 'heat_detected'
  | 'ai_scheduled'
  | 'ai_performed'
  | 'non_return'
  | 'pregnancy_check_scheduled'
  | 'pregnancy_confirmed'
  | 'pregnancy_failed'
  | 'calving'
  | 'vwp_ended'
  | 'heat_return';

export interface BreedingEvent {
  id: string;
  animal_id: string;
  farm_id: string;
  event_type: BreedingEventType;
  event_date: string;
  related_heat_record_id?: string;
  related_ai_record_id?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  created_by?: string;
  created_at: string;
}

// Livestock type specific configurations
export const GESTATION_DAYS: Record<string, number> = {
  cattle: 283,
  carabao: 310,
  goat: 150,
  sheep: 147,
};

export const MIN_BREEDING_AGE_MONTHS: Record<string, number> = {
  cattle: 15,
  carabao: 18,
  goat: 8,
  sheep: 8,
};

export const CYCLE_LENGTH_DAYS: Record<string, number> = {
  cattle: 21,
  carabao: 21,
  goat: 21,
  sheep: 17,
};

export const VWP_DAYS: Record<string, number> = {
  cattle: 60,
  carabao: 60,
  goat: 45,
  sheep: 45,
};
