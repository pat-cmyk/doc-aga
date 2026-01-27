/**
 * useBreedingAlerts Hook
 * 
 * Provides breeding-specific smart alerts for the dashboard:
 * - Proestrus alerts (2 days before expected heat)
 * - Pregnancy check reminders (28-35 days post-AI)
 * - VWP completion alerts (when postpartum animal ready for breeding)
 * - Repeat breeder flags (3+ failed services)
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, addDays, format } from 'date-fns';
import { CYCLE_LENGTH_DAYS, VWP_DAYS } from '@/types/fertility';

export type BreedingAlertType = 
  | 'proestrus' 
  | 'preg_check_due' 
  | 'vwp_ending' 
  | 'repeat_breeder'
  | 'in_heat';

export type BreedingAlertUrgency = 'critical' | 'warning' | 'info';

export interface BreedingAlert {
  id: string;
  alertType: BreedingAlertType;
  animalId: string;
  animalName: string | null;
  animalEarTag: string | null;
  title: string;
  titleTagalog: string;
  description: string;
  descriptionTagalog: string;
  urgency: BreedingAlertUrgency;
  actionDate: string;
  daysUntil: number;
  metadata?: Record<string, unknown>;
}

export function useBreedingAlerts(farmId: string | null) {
  return useQuery({
    queryKey: ['breeding-alerts', farmId],
    queryFn: async (): Promise<BreedingAlert[]> => {
      if (!farmId) return [];

      const alerts: BreedingAlert[] = [];
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');

      // Fetch female animals with fertility data
      const { data: animals, error: animalsError } = await supabase
        .from('animals')
        .select(`
          id, name, ear_tag, livestock_type, 
          fertility_status, last_heat_date, last_ai_date,
          last_calving_date, services_this_cycle, voluntary_waiting_end_date
        `)
        .eq('farm_id', farmId)
        .eq('is_deleted', false)
        .is('exit_date', null)
        .ilike('gender', 'female');

      if (animalsError) throw animalsError;

      // Fetch latest AI records for preg check calculations
      const animalIds = animals?.map(a => a.id) || [];
      const { data: aiRecords, error: aiError } = await supabase
        .from('ai_records')
        .select('animal_id, performed_date, pregnancy_confirmed, expected_delivery_date')
        .in('animal_id', animalIds.length > 0 ? animalIds : ['no-match'])
        .order('performed_date', { ascending: false });

      if (aiError) throw aiError;

      // Build lookup map for latest AI per animal
      const latestAIByAnimal = new Map<string, typeof aiRecords[0]>();
      aiRecords?.forEach(record => {
        if (!latestAIByAnimal.has(record.animal_id)) {
          latestAIByAnimal.set(record.animal_id, record);
        }
      });

      // Process each animal for alerts
      for (const animal of animals || []) {
        const status = animal.fertility_status;
        const cycleLength = CYCLE_LENGTH_DAYS[animal.livestock_type] || 21;
        const vwpDays = VWP_DAYS[animal.livestock_type] || 60;
        const latestAI = latestAIByAnimal.get(animal.id);

        // 1. PROESTRUS ALERT (2 days before expected heat)
        if (status === 'open_cycling' && animal.last_heat_date) {
          const lastHeat = new Date(animal.last_heat_date);
          const expectedNextHeat = addDays(lastHeat, cycleLength);
          const daysUntilHeat = differenceInDays(expectedNextHeat, now);

          // Alert 1-3 days before expected heat
          if (daysUntilHeat >= 1 && daysUntilHeat <= 3) {
            alerts.push({
              id: `proestrus-${animal.id}`,
              alertType: 'proestrus',
              animalId: animal.id,
              animalName: animal.name,
              animalEarTag: animal.ear_tag,
              title: `Heat expected in ${daysUntilHeat} day${daysUntilHeat > 1 ? 's' : ''}`,
              titleTagalog: `Inaasahang init sa ${daysUntilHeat} araw`,
              description: 'Prepare for heat observation and AI scheduling',
              descriptionTagalog: 'Maghanda para sa pagmamasid at pag-schedule ng AI',
              urgency: daysUntilHeat === 1 ? 'warning' : 'info',
              actionDate: format(expectedNextHeat, 'yyyy-MM-dd'),
              daysUntil: daysUntilHeat,
            });
          }
        }

        // 2. PREGNANCY CHECK DUE (28-45 days post-AI, not yet confirmed)
        if (status === 'bred_waiting' && latestAI?.performed_date && !latestAI.pregnancy_confirmed) {
          const aiDate = new Date(latestAI.performed_date);
          const daysSinceAI = differenceInDays(now, aiDate);

          // Preg check window: 28-45 days
          if (daysSinceAI >= 28 && daysSinceAI <= 45) {
            const isOverdue = daysSinceAI >= 35;
            alerts.push({
              id: `pregcheck-${animal.id}`,
              alertType: 'preg_check_due',
              animalId: animal.id,
              animalName: animal.name,
              animalEarTag: animal.ear_tag,
              title: `Pregnancy check due (${daysSinceAI} days post-AI)`,
              titleTagalog: `Kailangan ng preg check (${daysSinceAI} araw matapos ang AI)`,
              description: isOverdue 
                ? 'Overdue for pregnancy confirmation' 
                : 'Schedule ultrasound or blood test',
              descriptionTagalog: isOverdue 
                ? 'Lampas na sa araw ng pagkumpirma ng pagbubuntis' 
                : 'Mag-schedule ng ultrasound o blood test',
              urgency: isOverdue ? 'critical' : 'warning',
              actionDate: format(addDays(aiDate, 30), 'yyyy-MM-dd'),
              daysUntil: 0,
              metadata: { daysSinceAI },
            });
          }
        }

        // 3. VWP ENDING ALERT (when postpartum animal ready for breeding)
        if (status === 'fresh_postpartum') {
          let vwpEndDate: Date | null = null;

          if (animal.voluntary_waiting_end_date) {
            vwpEndDate = new Date(animal.voluntary_waiting_end_date);
          } else if (animal.last_calving_date) {
            vwpEndDate = addDays(new Date(animal.last_calving_date), vwpDays);
          }

          if (vwpEndDate) {
            const daysUntilVWPEnd = differenceInDays(vwpEndDate, now);

            // Alert 3 days before to 5 days after VWP ends
            if (daysUntilVWPEnd >= -5 && daysUntilVWPEnd <= 3) {
              const isReady = daysUntilVWPEnd <= 0;
              alerts.push({
                id: `vwp-${animal.id}`,
                alertType: 'vwp_ending',
                animalId: animal.id,
                animalName: animal.name,
                animalEarTag: animal.ear_tag,
                title: isReady 
                  ? 'Ready for breeding' 
                  : `VWP ends in ${daysUntilVWPEnd} days`,
                titleTagalog: isReady 
                  ? 'Handa na para sa pagpapalahi' 
                  : `VWP matatapos sa ${daysUntilVWPEnd} araw`,
                description: isReady 
                  ? 'Uterus recovered, can resume breeding' 
                  : 'Monitor for return to cycling',
                descriptionTagalog: isReady 
                  ? 'Gumaling na ang matris, pwede nang magpalahi' 
                  : 'Bantayan ang pagbabalik ng cycle',
                urgency: isReady ? 'warning' : 'info',
                actionDate: format(vwpEndDate, 'yyyy-MM-dd'),
                daysUntil: Math.max(0, daysUntilVWPEnd),
              });
            }
          }
        }

        // 4. REPEAT BREEDER FLAG (3+ failed services)
        const servicesThisCycle = animal.services_this_cycle || 0;
        if (servicesThisCycle >= 3 && (status === 'open_cycling' || status === 'bred_waiting')) {
          alerts.push({
            id: `repeat-${animal.id}`,
            alertType: 'repeat_breeder',
            animalId: animal.id,
            animalName: animal.name,
            animalEarTag: animal.ear_tag,
            title: `Repeat breeder (${servicesThisCycle} services)`,
            titleTagalog: `Paulit-ulit na pagpapalahi (${servicesThisCycle} serbisyo)`,
            description: 'Consider fertility evaluation or culling decision',
            descriptionTagalog: 'Isaalang-alang ang pagsusuri ng fertility o desisyon sa pagtatanggal',
            urgency: servicesThisCycle >= 5 ? 'critical' : 'warning',
            actionDate: today,
            daysUntil: 0,
            metadata: { servicesCount: servicesThisCycle },
          });
        }

        // 5. IN HEAT NOW (supplement to Breeding Hub)
        if (status === 'in_heat') {
          alerts.push({
            id: `heat-${animal.id}`,
            alertType: 'in_heat',
            animalId: animal.id,
            animalName: animal.name,
            animalEarTag: animal.ear_tag,
            title: 'In heat - breed now',
            titleTagalog: 'May init - magpalahi ngayon',
            description: 'Optimal breeding window active',
            descriptionTagalog: 'Aktibo ang pinakamainam na oras para magpalahi',
            urgency: 'critical',
            actionDate: today,
            daysUntil: 0,
          });
        }
      }

      // Sort by urgency (critical first) then by days until action
      return alerts.sort((a, b) => {
        const urgencyOrder = { critical: 0, warning: 1, info: 2 };
        const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        return a.daysUntil - b.daysUntil;
      });
    },
    enabled: !!farmId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}

export function getBreedingAlertIcon(alertType: BreedingAlertType): string {
  switch (alertType) {
    case 'in_heat': return '🔥';
    case 'proestrus': return '📅';
    case 'preg_check_due': return '🔍';
    case 'vwp_ending': return '✅';
    case 'repeat_breeder': return '⚠️';
    default: return '🐄';
  }
}

export function getBreedingAlertColor(urgency: BreedingAlertUrgency): string {
  switch (urgency) {
    case 'critical':
      return 'text-destructive bg-destructive/10 border-destructive/20';
    case 'warning':
      return 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800';
    case 'info':
    default:
      return 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800';
  }
}

export function groupBreedingAlertsByType(alerts: BreedingAlert[]): Record<BreedingAlertType, BreedingAlert[]> {
  const grouped: Record<BreedingAlertType, BreedingAlert[]> = {
    in_heat: [],
    proestrus: [],
    preg_check_due: [],
    vwp_ending: [],
    repeat_breeder: [],
  };

  alerts.forEach(alert => {
    if (grouped[alert.alertType]) {
      grouped[alert.alertType].push(alert);
    }
  });

  return grouped;
}
