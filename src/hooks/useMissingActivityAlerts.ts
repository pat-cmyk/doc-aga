import { useMemo } from "react";
import { useDailyActivityCompliance } from "./useDailyActivityCompliance";

export interface MissingActivityAlert {
  id: string;
  alertType: 'missing_milking' | 'no_feeding' | 'inactive_farmhand';
  title: string;
  description: string;
  animalId?: string;
  animalName?: string;
  farmhandName?: string;
  session?: 'AM' | 'PM';
  urgency: 'urgent' | 'warning' | 'info';
}

export function useMissingActivityAlerts(farmId: string | null) {
  const { data: compliance, isLoading } = useDailyActivityCompliance(farmId);

  const alerts = useMemo<MissingActivityAlert[]>(() => {
    if (!compliance) return [];

    const result: MissingActivityAlert[] = [];
    const { currentHour, isAfternoon, animalsMissingMilking, hasFeedingToday, farmhandActivity } = compliance;

    // Missing AM milking alerts (urgent after 9 AM)
    if (currentHour >= 9) {
      const missingAM = animalsMissingMilking.filter(a => a.missingSessions.includes('AM'));
      if (missingAM.length > 0) {
        if (missingAM.length <= 3) {
          missingAM.forEach(animal => {
            result.push({
              id: `missing-am-${animal.animalId}`,
              alertType: 'missing_milking',
              title: 'AM milking not recorded',
              description: `${animal.animalName || animal.earTag || 'Animal'} hasn't been milked this morning`,
              animalId: animal.animalId,
              animalName: animal.animalName || animal.earTag || undefined,
              session: 'AM',
              urgency: 'urgent'
            });
          });
        } else {
          result.push({
            id: 'missing-am-multiple',
            alertType: 'missing_milking',
            title: 'AM milking incomplete',
            description: `${missingAM.length} animals haven't been milked this morning`,
            session: 'AM',
            urgency: 'urgent'
          });
        }
      }
    }

    // Missing PM milking alerts (urgent after 5 PM)
    if (currentHour >= 17) {
      const missingPM = animalsMissingMilking.filter(a => a.missingSessions.includes('PM'));
      if (missingPM.length > 0) {
        if (missingPM.length <= 3) {
          missingPM.forEach(animal => {
            result.push({
              id: `missing-pm-${animal.animalId}`,
              alertType: 'missing_milking',
              title: 'PM milking not recorded',
              description: `${animal.animalName || animal.earTag || 'Animal'} hasn't been milked this afternoon`,
              animalId: animal.animalId,
              animalName: animal.animalName || animal.earTag || undefined,
              session: 'PM',
              urgency: 'urgent'
            });
          });
        } else {
          result.push({
            id: 'missing-pm-multiple',
            alertType: 'missing_milking',
            title: 'PM milking incomplete',
            description: `${missingPM.length} animals haven't been milked this afternoon`,
            session: 'PM',
            urgency: 'urgent'
          });
        }
      }
    } else if (isAfternoon && currentHour >= 14) {
      // Warning for PM session starting at 2 PM
      const missingPM = animalsMissingMilking.filter(a => a.missingSessions.includes('PM'));
      if (missingPM.length > 0) {
        result.push({
          id: 'pm-milking-reminder',
          alertType: 'missing_milking',
          title: 'PM milking pending',
          description: `${missingPM.length} animal${missingPM.length > 1 ? 's' : ''} waiting for PM milking`,
          session: 'PM',
          urgency: 'warning'
        });
      }
    }

    // No feeding activity alert (warning after 10 AM)
    if (!hasFeedingToday && currentHour >= 10) {
      result.push({
        id: 'no-feeding',
        alertType: 'no_feeding',
        title: 'No feeding recorded today',
        description: 'No feeding activity has been logged yet',
        urgency: currentHour >= 14 ? 'urgent' : 'warning'
      });
    }

    // Inactive farmhand alerts (if expected to be working)
    if (currentHour >= 8 && currentHour <= 17) {
      const inactiveFarmhands = farmhandActivity.filter(f => 
        f.activitiesCount === 0 && 
        f.role !== 'owner' // Don't alert about owners
      );
      
      inactiveFarmhands.forEach(farmhand => {
        result.push({
          id: `inactive-${farmhand.userId}`,
          alertType: 'inactive_farmhand',
          title: 'No activity logged',
          description: `${farmhand.userName} has not logged any activities today`,
          farmhandName: farmhand.userName,
          urgency: 'info'
        });
      });
    }

    return result;
  }, [compliance]);

  return { alerts, isLoading, compliance };
}
