 /**
  * App-Wide Urgency/Status Glossary
  * Single Source of Truth (SSOT) for all tag, badge, and banner definitions
  * Used by components AND Doc Aga AI for consistent terminology
  */
 
 export interface UrgencyDefinition {
   level: string;
   label: string;
   labelTagalog: string;
   description: string;
   descriptionTagalog: string;
   threshold: string;
   textClass: string;
   bgClass: string;
 }
 
 // ============================================
 // EXPECTED DELIVERIES (Breeding Timeline)
 // ============================================
 export const EXPECTED_DELIVERIES_URGENCY: Record<string, UrgencyDefinition> = {
   urgent: {
     level: 'urgent',
     label: 'Urgent',
     labelTagalog: 'Kagyat',
     description: 'Expected delivery within 30 days',
     descriptionTagalog: 'Inaasahang panganganak sa loob ng 30 araw',
     threshold: '<= 30 days',
     textClass: 'text-destructive',
     bgClass: 'bg-orange-500/5',
   },
   upcoming: {
     level: 'upcoming',
     label: 'Upcoming',
     labelTagalog: 'Paparating',
     description: 'Expected delivery beyond 30 days',
     descriptionTagalog: 'Inaasahang panganganak lampas sa 30 araw',
     threshold: '> 30 days',
     textClass: 'text-muted-foreground',
     bgClass: 'bg-muted',
   },
 };
 
 // ============================================
 // HEALTH ALERTS (Vaccinations, Dewormings)
 // ============================================
 export const HEALTH_ALERT_URGENCY: Record<string, UrgencyDefinition> = {
   overdue: {
     level: 'overdue',
     label: 'Overdue',
     labelTagalog: 'Lampas na',
     description: 'Past the scheduled date',
     descriptionTagalog: 'Lagpas na sa nakatakdang petsa',
     threshold: 'days_until_due < 0',
     textClass: 'text-destructive',
     bgClass: 'bg-destructive/10',
   },
   urgent: {
     level: 'urgent',
     label: 'Urgent',
     labelTagalog: 'Kagyat',
     description: 'Due within 2 days',
     descriptionTagalog: 'Kailangan sa loob ng 2 araw',
     threshold: 'days_until_due <= 2',
     textClass: 'text-orange-600',
     bgClass: 'bg-orange-50',
   },
   soon: {
     level: 'soon',
     label: 'Soon',
     labelTagalog: 'Malapit na',
     description: 'Due within 7 days',
     descriptionTagalog: 'Kailangan sa loob ng 7 araw',
     threshold: 'days_until_due <= 7',
     textClass: 'text-yellow-600',
     bgClass: 'bg-yellow-50',
   },
   upcoming: {
     level: 'upcoming',
     label: 'Upcoming',
     labelTagalog: 'Paparating',
     description: 'Scheduled beyond 7 days',
     descriptionTagalog: 'Nakatakda lampas sa 7 araw',
     threshold: 'days_until_due > 7',
     textClass: 'text-muted-foreground',
     bgClass: 'bg-muted',
   },
 };
 
 // ============================================
 // FEED INVENTORY EXPIRY
 // ============================================
 export const FEED_EXPIRY_URGENCY: Record<string, UrgencyDefinition> = {
   expired: {
     level: 'expired',
     label: 'Expired',
     labelTagalog: 'Expired na',
     description: 'Past the expiry date',
     descriptionTagalog: 'Lagpas na sa expiry date',
     threshold: 'days_until_expiry < 0',
     textClass: 'text-destructive',
     bgClass: 'bg-destructive/10',
   },
   critical: {
     level: 'critical',
     label: 'Critical',
     labelTagalog: 'Kritikal',
     description: 'Expires within 7 days',
     descriptionTagalog: 'Mag-expire sa loob ng 7 araw',
     threshold: 'days_until_expiry <= 7',
     textClass: 'text-destructive',
     bgClass: 'bg-destructive/5',
   },
   warning: {
     level: 'warning',
     label: 'Warning',
     labelTagalog: 'Babala',
     description: 'Expires within 14 days',
     descriptionTagalog: 'Mag-expire sa loob ng 14 araw',
     threshold: 'days_until_expiry <= 14',
     textClass: 'text-orange-600',
     bgClass: 'bg-orange-50',
   },
   upcoming: {
     level: 'upcoming',
     label: 'Upcoming',
     labelTagalog: 'Paparating',
     description: 'Expires within 30 days',
     descriptionTagalog: 'Mag-expire sa loob ng 30 araw',
     threshold: 'days_until_expiry <= 30',
     textClass: 'text-yellow-600',
     bgClass: 'bg-yellow-50',
   },
 };
 
 // ============================================
 // FEED SECURITY (Stock Levels)
 // ============================================
 export const FEED_SECURITY_URGENCY: Record<string, UrgencyDefinition> = {
   critical: {
     level: 'critical',
     label: 'Critical',
     labelTagalog: 'Kritikal',
     description: 'Less than 7 days of stock remaining',
     descriptionTagalog: 'Wala pang 7 araw na stock ang natitira',
     threshold: 'days_of_stock < 7',
     textClass: 'text-destructive',
     bgClass: 'bg-destructive/10',
   },
   warning: {
     level: 'warning',
     label: 'Warning',
     labelTagalog: 'Babala',
     description: 'Less than 30 days of stock remaining',
     descriptionTagalog: 'Wala pang 30 araw na stock ang natitira',
     threshold: 'days_of_stock < 30',
     textClass: 'text-orange-600',
     bgClass: 'bg-orange-50',
   },
   adequate: {
     level: 'adequate',
     label: 'Adequate',
     labelTagalog: 'Sapat',
     description: '30 or more days of stock remaining',
     descriptionTagalog: '30 araw o higit pa ang stock na natitira',
     threshold: 'days_of_stock >= 30',
     textClass: 'text-green-600',
     bgClass: 'bg-green-50',
   },
 };
 
 // ============================================
 // BREEDING ALERTS
 // ============================================
 export const BREEDING_ALERT_URGENCY: Record<string, UrgencyDefinition> = {
   critical: {
     level: 'critical',
     label: 'Critical',
     labelTagalog: 'Kritikal',
     description: 'Animal in heat now OR repeat breeder (5+ failed services)',
     descriptionTagalog: 'Hayop na nag-heat ngayon O repeat breeder (5+ failed services)',
     threshold: 'in_heat OR services_this_cycle >= 5',
     textClass: 'text-destructive',
     bgClass: 'bg-destructive/10',
   },
   warning: {
     level: 'warning',
     label: 'Warning',
     labelTagalog: 'Babala',
     description: 'Pregnancy check overdue OR proestrus (1 day to heat)',
     descriptionTagalog: 'Pregnancy check overdue O proestrus (1 araw bago mag-heat)',
     threshold: 'preg_check_overdue OR days_to_heat <= 1',
     textClass: 'text-orange-600',
     bgClass: 'bg-orange-50',
   },
   info: {
     level: 'info',
     label: 'Info',
     labelTagalog: 'Impormasyon',
     description: 'VWP ending soon OR proestrus (2-3 days to heat)',
     descriptionTagalog: 'VWP malapit na matapos O proestrus (2-3 araw bago mag-heat)',
     threshold: 'vwp_ending OR days_to_heat <= 3',
     textClass: 'text-blue-600',
     bgClass: 'bg-blue-50',
   },
 };
 
 // ============================================
 // DATA RECORDING GAPS
 // ============================================
 export const DATA_GAP_URGENCY: Record<string, UrgencyDefinition> = {
   critical: {
     level: 'critical',
     label: 'Critical',
     labelTagalog: 'Kritikal',
     description: '3 or more days without milking/feeding records',
     descriptionTagalog: '3 araw o higit pa na walang milking/feeding records',
     threshold: 'days_since_record >= 3',
     textClass: 'text-destructive',
     bgClass: 'bg-destructive/10',
   },
   warning: {
     level: 'warning',
     label: 'Warning',
     labelTagalog: 'Babala',
     description: '2 days without records',
     descriptionTagalog: '2 araw na walang records',
     threshold: 'days_since_record == 2',
     textClass: 'text-orange-600',
     bgClass: 'bg-orange-50',
   },
   info: {
     level: 'info',
     label: 'Info',
     labelTagalog: 'Impormasyon',
     description: '1 day gap in records',
     descriptionTagalog: '1 araw na gap sa records',
     threshold: 'days_since_record == 1',
     textClass: 'text-blue-600',
     bgClass: 'bg-blue-50',
   },
 };
 
 // ============================================
 // HEALTH STATUS SEVERITY (Regional Analytics)
 // ============================================
export const HEALTH_STATUS_SEVERITY: Record<string, UrgencyDefinition> = {
  critical: {
    level: 'critical',
    label: 'Critical',
    labelTagalog: 'Kritikal',
    description: 'Health event prevalence rate 20% or higher. High density of reported health concerns relative to animal population.',
    descriptionTagalog: 'Health event prevalence rate na 20% o higit pa. Mataas na dami ng naiulat na health concerns kumpara sa bilang ng hayop.',
    threshold: 'rate >= 20%',
    textClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
  },
  high: {
    level: 'high',
    label: 'High',
    labelTagalog: 'Mataas',
    description: 'Health event prevalence rate 10% or higher. Elevated health concern activity in the area.',
    descriptionTagalog: 'Health event prevalence rate na 10% o higit pa. Mataas na aktibidad ng health concerns sa lugar.',
    threshold: 'rate >= 10%',
    textClass: 'text-orange-600',
    bgClass: 'bg-orange-50',
  },
  moderate: {
    level: 'moderate',
    label: 'Moderate',
    labelTagalog: 'Katamtaman',
    description: 'Health event prevalence rate 5% or higher. Some health concerns present but manageable.',
    descriptionTagalog: 'Health event prevalence rate na 5% o higit pa. May mga health concerns pero kayang hawakan.',
    threshold: 'rate >= 5%',
    textClass: 'text-yellow-600',
    bgClass: 'bg-yellow-50',
  },
  low: {
    level: 'low',
    label: 'Low',
    labelTagalog: 'Mababa',
    description: 'Health event prevalence rate below 5%. Minimal health concerns reported.',
    descriptionTagalog: 'Health event prevalence rate na mas mababa sa 5%. Kaunti lamang ang naiulat na health concerns.',
    threshold: 'rate < 5%',
    textClass: 'text-green-600',
    bgClass: 'bg-green-50',
  },
};
 
// ============================================
// FARMER FEEDBACK SENTIMENT
// ============================================
export const FEEDBACK_SENTIMENT: Record<string, UrgencyDefinition> = {
  urgent: {
    level: 'urgent',
    label: 'Urgent',
    labelTagalog: 'Kagyat',
    description: 'Requires immediate government attention',
    descriptionTagalog: 'Nangangailangan ng agarang atensiyon ng gobyerno',
    threshold: 'sentiment = urgent',
    textClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
  },
  negative: {
    level: 'negative',
    label: 'Negative',
    labelTagalog: 'Negatibo',
    description: 'Concern or complaint from farmer',
    descriptionTagalog: 'Alalahanin o reklamo mula sa magsasaka',
    threshold: 'sentiment = negative',
    textClass: 'text-orange-600',
    bgClass: 'bg-orange-50',
  },
  neutral: {
    level: 'neutral',
    label: 'Neutral',
    labelTagalog: 'Neutral',
    description: 'General inquiry or observation',
    descriptionTagalog: 'General na tanong o obserbasyon',
    threshold: 'sentiment = neutral',
    textClass: 'text-muted-foreground',
    bgClass: 'bg-muted',
  },
  positive: {
    level: 'positive',
    label: 'Positive',
    labelTagalog: 'Positibo',
    description: 'Appreciation or success story',
    descriptionTagalog: 'Pasasalamat o success story',
    threshold: 'sentiment = positive',
    textClass: 'text-green-600',
    bgClass: 'bg-green-50',
  },
};

// ============================================
// FEEDBACK PRIORITY (Government Dashboard)
// ============================================
export const FEEDBACK_PRIORITY_URGENCY: Record<string, UrgencyDefinition> = {
  critical: {
    level: 'critical',
    label: 'Critical',
    labelTagalog: 'Kritikal',
    description: 'Disease outbreak, animal death, or system-wide issue affecting multiple farms. Requires immediate escalation.',
    descriptionTagalog: 'Outbreak ng sakit, pagkamatay ng hayop, o malawakang problema. Kailangan ng agarang aksyon.',
    threshold: 'priority = critical',
    textClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
  },
  high: {
    level: 'high',
    label: 'High',
    labelTagalog: 'Mataas',
    description: 'Feed shortage, veterinary emergency, or time-sensitive concern. Needs attention within 24 hours.',
    descriptionTagalog: 'Kakulangan ng feeds, emergency sa beterinaryo, o madaliang alalahanin. Kailangan ng atensiyon sa loob ng 24 oras.',
    threshold: 'priority = high',
    textClass: 'text-orange-600',
    bgClass: 'bg-orange-50',
  },
  medium: {
    level: 'medium',
    label: 'Medium',
    labelTagalog: 'Katamtaman',
    description: 'General inquiry, program feedback, or non-urgent request. Standard response time.',
    descriptionTagalog: 'General na tanong, feedback sa programa, o hindi madaliang kahilingan.',
    threshold: 'priority = medium',
    textClass: 'text-yellow-600',
    bgClass: 'bg-yellow-50',
  },
  low: {
    level: 'low',
    label: 'Low',
    labelTagalog: 'Mababa',
    description: 'Positive feedback, suggestions, or general observations. Informational only.',
    descriptionTagalog: 'Positibong feedback, suhestiyon, o pangkalahatang obserbasyon.',
    threshold: 'priority = low',
    textClass: 'text-blue-600',
    bgClass: 'bg-blue-50',
  },
};

// ============================================
// VETERINARY COST SEVERITY (Government Dashboard)
// ============================================
export const VETERINARY_COST_SEVERITY: Record<string, UrgencyDefinition> = {
  critical: {
    level: 'critical',
    label: 'Critical',
    labelTagalog: 'Kritikal',
    description: 'Cost per animal is 2x or more the regional average. Indicates potential disease outbreak or systemic issue.',
    descriptionTagalog: '2x o higit pa sa average ng rehiyon. Posibleng may outbreak o systemic issue.',
    threshold: 'ratio >= 2.0',
    textClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
  },
  high: {
    level: 'high',
    label: 'High',
    labelTagalog: 'Mataas',
    description: 'Cost per animal is 1.5x to 2x the regional average. Above normal veterinary expenses.',
    descriptionTagalog: '1.5x hanggang 2x sa average ng rehiyon. Mataas na gastos sa beterinaryo.',
    threshold: 'ratio >= 1.5',
    textClass: 'text-orange-600',
    bgClass: 'bg-orange-50',
  },
  moderate: {
    level: 'moderate',
    label: 'Moderate',
    labelTagalog: 'Katamtaman',
    description: 'Cost per animal is at or slightly above the regional average.',
    descriptionTagalog: 'Katumbas o bahagyang mataas sa average ng rehiyon.',
    threshold: 'ratio >= 1.0',
    textClass: 'text-yellow-600',
    bgClass: 'bg-yellow-50',
  },
  low: {
    level: 'low',
    label: 'Low',
    labelTagalog: 'Mababa',
    description: 'Cost per animal is below the regional average. Healthy herd with minimal veterinary needs.',
    descriptionTagalog: 'Mas mababa sa average ng rehiyon. Malusog na kawan.',
    threshold: 'ratio < 1.0',
    textClass: 'text-green-600',
    bgClass: 'bg-green-50',
  },
};
 
 // ============================================
 // BREEDING ANALYTICS DEFINITIONS
 // ============================================
 export const BREEDING_METRICS = {
   aiSuccessRate: {
     label: 'AI Success Rate',
     labelTagalog: 'AI Success Rate',
     formula: '(Confirmed pregnancies / Total AI procedures performed) × 100',
     formulaTagalog: '(Confirmed pregnancies / Total AI procedures na ginawa) × 100',
   },
   currentlyPregnant: {
     label: 'Currently Pregnant',
     labelTagalog: 'Kasalukuyang Buntis',
     definition: 'Animals with pregnancy_confirmed = true and no recorded birth/loss',
     definitionTagalog: 'Mga hayop na may pregnancy_confirmed = true at walang naitala na panganganak/pagkalugi',
   },
   repeatBreeder: {
     label: 'Repeat Breeder',
     labelTagalog: 'Repeat Breeder',
     definition: 'Animal with 5 or more failed breeding services in current cycle',
     definitionTagalog: 'Hayop na may 5 o higit pang failed breeding services sa kasalukuyang cycle',
   },
 };
 
// ============================================
// PRE-CALVING RISK SCORE (PCRS) - Phase 1
// ============================================

/**
 * Pre-Calving Risk Score (PCRS) System
 * 
 * A 100-point scoring system based on veterinary research from:
 * - Penn State Extension
 * - University of Georgia Extension
 * - Merck Veterinary Manual
 * - USDA/NAHBS studies
 */

export interface PCRSScoreComponent {
  name: string;
  maxPoints: number;
  description: string;
  thresholds: {
    value: string;
    points: number;
    label: string;
  }[];
}

export const PCRS_SCORING_COMPONENTS: Record<string, PCRSScoreComponent> = {
  timelineProximity: {
    name: 'Timeline Proximity',
    maxPoints: 35,
    description: 'Days until expected delivery',
    thresholds: [
      { value: '<7 days', points: 35, label: 'Imminent' },
      { value: '7-14 days', points: 25, label: 'Very Soon' },
      { value: '15-30 days', points: 15, label: 'Soon' },
      { value: '31-60 days', points: 5, label: 'Approaching' },
      { value: '>60 days', points: 0, label: 'Not urgent' },
    ],
  },
  bcsRisk: {
    name: 'Body Condition Score Risk',
    maxPoints: 25,
    description: 'BCS deviation from ideal range (2.5-3.5)',
    thresholds: [
      { value: '<2.0', points: 25, label: 'Severely underweight' },
      { value: '2.0-2.4', points: 15, label: 'Underweight' },
      { value: '>4.5', points: 25, label: 'Severely overweight' },
      { value: '4.0-4.5', points: 10, label: 'Overweight' },
      { value: '2.5-3.5', points: 0, label: 'Ideal' },
    ],
  },
  parityRisk: {
    name: 'Parity Risk',
    maxPoints: 15,
    description: 'First-calf heifers have 3-4x higher dystocia risk',
    thresholds: [
      { value: 'Parity 0 (first calving)', points: 15, label: 'Primiparous - High Risk' },
      { value: 'Parity 1-2', points: 5, label: 'Low parity' },
      { value: 'Parity 3+', points: 0, label: 'Experienced' },
    ],
  },
  healthHistory: {
    name: 'Health History',
    maxPoints: 15,
    description: 'Health issues in the last 90 days',
    thresholds: [
      { value: '3+ issues', points: 15, label: 'Multiple issues' },
      { value: '2 issues', points: 10, label: 'Some issues' },
      { value: '1 issue', points: 5, label: 'Minor concern' },
      { value: '0 issues', points: 0, label: 'Healthy' },
    ],
  },
  dataFreshness: {
    name: 'Data Freshness',
    maxPoints: 10,
    description: 'Days since last BCS assessment',
    thresholds: [
      { value: '>60 days', points: 10, label: 'Stale data - blind spot' },
      { value: '31-60 days', points: 5, label: 'Needs update' },
      { value: '≤30 days', points: 0, label: 'Recent' },
    ],
  },
};

export interface PCRSTier {
  tier: 'critical' | 'high' | 'moderate' | 'low';
  label: string;
  labelTagalog: string;
  description: string;
  descriptionTagalog: string;
  minScore: number;
  maxScore: number;
  textClass: string;
  bgClass: string;
  badgeVariant: 'destructive' | 'outline' | 'secondary' | 'default';
  actionLevel: string;
}

export const PCRS_TIERS: Record<string, PCRSTier> = {
  critical: {
    tier: 'critical',
    label: 'Critical',
    labelTagalog: 'Kritikal',
    description: 'Immediate veterinary review required',
    descriptionTagalog: 'Kailangan ng agarang pagsusuri ng beterinaryo',
    minScore: 75,
    maxScore: 100,
    textClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
    badgeVariant: 'destructive',
    actionLevel: 'Immediate veterinary review required',
  },
  high: {
    tier: 'high',
    label: 'High',
    labelTagalog: 'Mataas',
    description: 'Priority monitoring, prep calving area',
    descriptionTagalog: 'Kailangan ng priority monitoring, ihanda ang calving area',
    minScore: 50,
    maxScore: 74,
    textClass: 'text-orange-600',
    bgClass: 'bg-orange-50',
    badgeVariant: 'outline',
    actionLevel: 'Priority monitoring, prepare calving area',
  },
  moderate: {
    tier: 'moderate',
    label: 'Moderate',
    labelTagalog: 'Katamtaman',
    description: 'Standard close-up protocols',
    descriptionTagalog: 'Standard close-up protocols',
    minScore: 25,
    maxScore: 49,
    textClass: 'text-yellow-600',
    bgClass: 'bg-yellow-50',
    badgeVariant: 'secondary',
    actionLevel: 'Standard close-up protocols',
  },
  low: {
    tier: 'low',
    label: 'Low',
    labelTagalog: 'Mababa',
    description: 'Routine monitoring',
    descriptionTagalog: 'Routine monitoring',
    minScore: 0,
    maxScore: 24,
    textClass: 'text-green-600',
    bgClass: 'bg-green-50',
    badgeVariant: 'default',
    actionLevel: 'Routine monitoring',
  },
};

/**
 * Calculate the PCRS tier based on total score
 */
export function getPCRSTier(score: number): PCRSTier {
  if (score >= 75) return PCRS_TIERS.critical;
  if (score >= 50) return PCRS_TIERS.high;
  if (score >= 25) return PCRS_TIERS.moderate;
  return PCRS_TIERS.low;
}

/**
 * Calculate timeline proximity score
 */
export function calculateTimelineScore(daysUntilDelivery: number): number {
  if (daysUntilDelivery < 7) return 35;
  if (daysUntilDelivery <= 14) return 25;
  if (daysUntilDelivery <= 30) return 15;
  if (daysUntilDelivery <= 60) return 5;
  return 0;
}

/**
 * Calculate BCS risk score
 * Ideal BCS at calving: 2.5-3.5 (on 5-point scale)
 */
export function calculateBCSScore(bcs: number | null): number {
  if (bcs === null) return 5; // Missing data = slight penalty
  if (bcs < 2.0) return 25;
  if (bcs < 2.5) return 15;
  if (bcs > 4.5) return 25;
  if (bcs > 4.0) return 10;
  return 0; // Ideal range
}

/**
 * Calculate parity risk score
 * Primiparous (first-calf) have 3-4x higher dystocia risk
 */
export function calculateParityScore(parity: number | null): number {
  if (parity === null) return 5; // Unknown parity = slight penalty
  if (parity === 0) return 15; // First calving
  if (parity <= 2) return 5;
  return 0; // Experienced
}

/**
 * Calculate health history score
 * Based on number of health issues in last 90 days
 */
export function calculateHealthHistoryScore(issueCount: number): number {
  if (issueCount >= 3) return 15;
  if (issueCount === 2) return 10;
  if (issueCount === 1) return 5;
  return 0;
}

/**
 * Calculate data freshness score
 * Based on days since last BCS assessment
 */
export function calculateDataFreshnessScore(daysSinceLastBCS: number | null): number {
  if (daysSinceLastBCS === null) return 10; // No BCS data = high penalty
  if (daysSinceLastBCS > 60) return 10;
  if (daysSinceLastBCS > 30) return 5;
  return 0;
}

export interface PCRSInput {
  daysUntilDelivery: number;
  latestBCS: number | null;
  parity: number | null;
  healthIssueCount: number;
  daysSinceLastBCS: number | null;
}

export interface PCRSResult {
  totalScore: number;
  tier: PCRSTier;
  breakdown: {
    timeline: number;
    bcs: number;
    parity: number;
    health: number;
    dataFreshness: number;
  };
  factors: string[];
}

/**
 * Calculate complete Pre-Calving Risk Score
 */
export function calculatePCRS(input: PCRSInput): PCRSResult {
  const timeline = calculateTimelineScore(input.daysUntilDelivery);
  const bcs = calculateBCSScore(input.latestBCS);
  const parity = calculateParityScore(input.parity);
  const health = calculateHealthHistoryScore(input.healthIssueCount);
  const dataFreshness = calculateDataFreshnessScore(input.daysSinceLastBCS);

  const totalScore = timeline + bcs + parity + health + dataFreshness;
  const tier = getPCRSTier(totalScore);

  // Build factor explanations
  const factors: string[] = [];
  if (timeline >= 25) factors.push(`Delivery imminent (${input.daysUntilDelivery} days)`);
  if (bcs >= 15) factors.push(input.latestBCS !== null ? `BCS concern (${input.latestBCS})` : 'No BCS data');
  if (parity >= 10) factors.push('First-time calving');
  if (health >= 10) factors.push(`Recent health issues (${input.healthIssueCount})`);
  if (dataFreshness >= 5) factors.push('BCS data needs update');

  return {
    totalScore,
    tier,
    breakdown: {
      timeline,
      bcs,
      parity,
      health,
      dataFreshness,
    },
    factors,
  };
}

/**
 * Generate PCRS glossary for AI prompt context
 */
export function getPCRSGlossaryForPrompt(): string {
  return `
PRE-CALVING RISK SCORE (PCRS) - 100-Point System:

Scoring Components:
- Timeline Proximity (0-35 pts): <7 days=35, 7-14 days=25, 15-30 days=15, 31-60 days=5, >60 days=0
- BCS Risk (0-25 pts): <2.0 or >4.5=25 (severe), 2.0-2.4=15, 4.0-4.5=10, 2.5-3.5=0 (ideal)
- Parity Risk (0-15 pts): First calving=15 (high dystocia risk), Parity 1-2=5, Parity 3+=0
- Health History (0-15 pts): 3+ issues=15, 2 issues=10, 1 issue=5, 0 issues=0
- Data Freshness (0-10 pts): No BCS or >60 days=10, 31-60 days=5, ≤30 days=0

Risk Tiers:
- Critical (75-100): 🔴 Immediate veterinary review required
- High (50-74): 🟠 Priority monitoring, prep calving area
- Moderate (25-49): 🟡 Standard close-up protocols
- Low (0-24): 🟢 Routine monitoring

Use PCRS to identify high-risk deliveries beyond just timeline urgency.
`;
}

 // ============================================
 // HELPER: Generate AI Prompt Context
 // ============================================
 export function getUrgencyGlossaryForPrompt(): string {
   return `
DASHBOARD TERMINOLOGY DEFINITIONS:

${getPCRSGlossaryForPrompt()}
 
 Expected Deliveries Timeline:
 - "Urgent" = Due within 30 days from current date
 - "Upcoming" = Due beyond 30 days
 - Shows pregnant animals with expected_delivery_date set
 
 Health Alerts (Vaccinations/Dewormings):
 - "Overdue" = Past the scheduled vaccination/deworming date
 - "Urgent" = Due within 2 days
 - "Soon" = Due within 7 days
 - "Upcoming" = Scheduled beyond 7 days
 
 Feed Inventory Expiry:
 - "Expired" = Past expiry date
 - "Critical" = Expires within 7 days
 - "Warning" = Expires within 14 days
 - "Upcoming" = Expires within 30 days
 
 Feed Security (Stock Levels):
 - "Critical" = Less than 7 days of stock remaining
 - "Warning" = Less than 30 days of stock remaining
 - "Adequate" = 30 or more days of stock remaining
 
 Breeding Alerts:
 - "Critical" = Animal in heat now OR repeat breeder (5+ failed services)
 - "Warning" = Pregnancy check overdue OR proestrus (1 day to heat)
 - "Info" = VWP ending soon OR proestrus (2-3 days to heat)
 
 Data Recording Gaps:
 - "Critical" = 3+ days without milking/feeding records
 - "Warning" = 2 days without records
 - "Info" = 1 day gap
 
 Health Status Severity (for regions/municipalities):
 - "Critical" = Mortality/morbidity rate >= 20%
 - "High" = Rate >= 10%
 - "Moderate" = Rate >= 5%
 - "Low" = Rate < 5%
 
 Farmer Feedback Sentiment:
 - "Urgent" = Requires immediate government attention
 - "Negative" = Concern or complaint
 - "Neutral" = General inquiry or observation
 - "Positive" = Appreciation or success story
 
 Breeding Analytics:
 - "AI Success Rate" = (Confirmed pregnancies / Total AI procedures performed) × 100
 - "Currently Pregnant" = Animals with pregnancy_confirmed = true
 - "Repeat Breeder" = Animal with 5+ failed services in current cycle
 `;
}

// ============================================
// BREEDING LIFECYCLE ACTION DEFINITIONS
// ============================================

export interface BreedingActionDefinition {
  key: string;
  label: string;
  labelTagalog: string;
  description: string;
  descriptionTagalog: string;
}

export const BREEDING_LIFECYCLE_ACTIONS: Record<string, BreedingActionDefinition> = {
  record_heat: {
    key: 'record_heat',
    label: 'Record Heat',
    labelTagalog: 'Itala ang Heat',
    description: 'Log when an animal shows signs of estrus (standing heat, mucus, restlessness). Use this to start the breeding window timer.',
    descriptionTagalog: 'Itala kapag nagpapakita ng senyales ng estrus ang hayop (standing heat, mucus, pagkabalisa). Gamitin ito para simulan ang breeding window timer.',
  },
  schedule_ai: {
    key: 'schedule_ai',
    label: 'Schedule AI',
    labelTagalog: 'Mag-schedule ng AI',
    description: 'Book an artificial insemination appointment. Use after detecting heat — ideally within 12–18 hours of standing heat.',
    descriptionTagalog: 'Mag-book ng artificial insemination. Gamitin pagkatapos ma-detect ang heat — ideally sa loob ng 12–18 oras.',
  },
  record_calving: {
    key: 'record_calving',
    label: 'Record Calving',
    labelTagalog: 'Itala ang Panganganak',
    description: 'Log a birth event. Use when the animal delivers a calf. This resets her cycle to postpartum recovery (VWP).',
    descriptionTagalog: 'Itala ang panganganak. Gamitin kapag nanganak na ang hayop. Ire-reset nito ang cycle sa postpartum recovery (VWP).',
  },
  non_return: {
    key: 'non_return',
    label: 'Suspected Pregnant',
    labelTagalog: 'Pinaghihinalaang Buntis',
    description: 'Mark non-return to heat 18–24 days after AI. Use when no heat signs reappear, suggesting breeding was successful.',
    descriptionTagalog: 'Markahan na hindi bumalik sa heat 18–24 araw pagkatapos ng AI. Gamitin kapag walang heat signs na lumabas.',
  },
  pregnancy_confirmed: {
    key: 'pregnancy_confirmed',
    label: 'Confirm Pregnancy',
    labelTagalog: 'Kumpirmahin ang Pagbubuntis',
    description: 'Verify pregnancy via ultrasound or rectal palpation, typically 28–35 days post-AI.',
    descriptionTagalog: 'I-verify ang pagbubuntis sa pamamagitan ng ultrasound o rectal palpation, karaniwang 28–35 araw pagkatapos ng AI.',
  },
  pregnancy_failed: {
    key: 'pregnancy_failed',
    label: 'Pregnancy Failed',
    labelTagalog: 'Nabigo ang Pagbubuntis',
    description: 'Record a negative pregnancy check or pregnancy loss. The animal returns to Open & Cycling status.',
    descriptionTagalog: 'Itala ang negatibong pregnancy check o pagkalugi ng pagbubuntis. Babalik ang hayop sa Open & Cycling status.',
  },
  heat_return: {
    key: 'heat_return',
    label: 'Heat Returned',
    labelTagalog: 'Bumalik sa Heat',
    description: 'The animal came back into heat after breeding, meaning the previous AI was unsuccessful.',
    descriptionTagalog: 'Bumalik sa heat ang hayop pagkatapos ng breeding, ibig sabihin hindi naging matagumpay ang nakaraang AI.',
  },
  vwp_ended: {
    key: 'vwp_ended',
    label: 'VWP Complete',
    labelTagalog: 'VWP Tapos na',
    description: 'The voluntary waiting period (typically 60 days postpartum) has ended. The animal is now eligible for breeding again.',
    descriptionTagalog: 'Ang voluntary waiting period (karaniwang 60 araw pagkatapos manganak) ay tapos na. Maaari nang i-breed muli ang hayop.',
  },
};