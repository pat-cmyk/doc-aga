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
     description: 'Mortality or morbidity rate 20% or higher',
     descriptionTagalog: 'Mortality o morbidity rate na 20% o higit pa',
     threshold: 'rate >= 20%',
     textClass: 'text-destructive',
     bgClass: 'bg-destructive/10',
   },
   high: {
     level: 'high',
     label: 'High',
     labelTagalog: 'Mataas',
     description: 'Mortality or morbidity rate 10% or higher',
     descriptionTagalog: 'Mortality o morbidity rate na 10% o higit pa',
     threshold: 'rate >= 10%',
     textClass: 'text-orange-600',
     bgClass: 'bg-orange-50',
   },
   moderate: {
     level: 'moderate',
     label: 'Moderate',
     labelTagalog: 'Katamtaman',
     description: 'Mortality or morbidity rate 5% or higher',
     descriptionTagalog: 'Mortality o morbidity rate na 5% o higit pa',
     threshold: 'rate >= 5%',
     textClass: 'text-yellow-600',
     bgClass: 'bg-yellow-50',
   },
   low: {
     level: 'low',
     label: 'Low',
     labelTagalog: 'Mababa',
     description: 'Mortality or morbidity rate below 5%',
     descriptionTagalog: 'Mortality o morbidity rate na mas mababa sa 5%',
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
 // HELPER: Generate AI Prompt Context
 // ============================================
 export function getUrgencyGlossaryForPrompt(): string {
   return `
 DASHBOARD TERMINOLOGY DEFINITIONS:
 
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