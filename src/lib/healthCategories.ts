import { Syringe, Pill, Stethoscope, ClipboardCheck, Bandage, MoreHorizontal, type LucideIcon } from "lucide-react";

export interface HealthCategory {
  id: string;
  label: string;
  labelFilipino: string;
  icon: LucideIcon;
  color: string;
}

export const HEALTH_CATEGORIES: HealthCategory[] = [
  { id: 'vaccination', label: 'Vaccination', labelFilipino: 'Bakuna', icon: Syringe, color: 'text-blue-500' },
  { id: 'deworming', label: 'Deworming', labelFilipino: 'Pagpurga', icon: Pill, color: 'text-purple-500' },
  { id: 'treatment', label: 'Treatment', labelFilipino: 'Gamutan', icon: Stethoscope, color: 'text-red-500' },
  { id: 'checkup', label: 'Check-up', labelFilipino: 'Pagsusuri', icon: ClipboardCheck, color: 'text-green-500' },
  { id: 'injury', label: 'Injury', labelFilipino: 'Sugat', icon: Bandage, color: 'text-orange-500' },
  { id: 'other', label: 'Other', labelFilipino: 'Iba pa', icon: MoreHorizontal, color: 'text-muted-foreground' },
];

export const QUICK_DIAGNOSES: Record<string, string[]> = {
  vaccination: [
    'FMD Vaccination',
    'Hemorrhagic Septicemia',
    'Brucellosis Vaccination',
    'Anthrax Vaccination',
    'Rabies Vaccination',
  ],
  deworming: [
    'Routine Deworming',
    'Albendazole Treatment',
    'Ivermectin Treatment',
    'Levamisole Treatment',
  ],
  treatment: [
    'Antibiotic Treatment',
    'Mastitis Treatment',
    'Respiratory Infection',
    'Digestive Issue',
    'Fever Treatment',
  ],
  checkup: [
    'Routine Health Check',
    'Pre-breeding Check',
    'Pregnancy Check',
    'Post-partum Check',
  ],
  injury: [
    'Wound Treatment',
    'Lameness Treatment',
    'Eye Injury',
    'Hoof Problem',
  ],
  other: [],
};

export const QUICK_TREATMENTS: Record<string, string[]> = {
  vaccination: [
    'Vaccine administered',
    'Booster dose given',
  ],
  deworming: [
    'Oral dewormer given',
    'Injectable dewormer given',
  ],
  treatment: [
    'Antibiotic injection',
    'Oral medication given',
    'Topical treatment applied',
    'IV fluids administered',
  ],
  checkup: [
    'All normal',
    'Follow-up scheduled',
    'Medication prescribed',
  ],
  injury: [
    'Wound cleaned and dressed',
    'Anti-inflammatory given',
    'Bandage applied',
  ],
  other: [],
};
