import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { 
  getCachedUpcomingAlerts, 
  updateUpcomingAlertsCache 
} from '@/lib/dataCache';

export interface UpcomingAlert {
  alert_type: 'vaccination' | 'deworming' | 'delivery';
  alert_title: string;
  animal_id: string;
  animal_name: string | null;
  animal_ear_tag: string | null;
  due_date: string;
  days_until_due: number;
  urgency: 'overdue' | 'urgent' | 'soon' | 'upcoming';
  schedule_id: string;
}

/**
 * Cache-first hook for upcoming alerts (offline-first compliant)
 * 
 * Read path: IndexedDB cache → Supabase RPC (if online)
 * Write path: RPC result → IndexedDB cache update
 */
export function useUpcomingAlerts(farmId?: string, daysAhead: number = 7) {
  const isOnline = useOnlineStatus();

  return useQuery({
    queryKey: ['upcoming-alerts', farmId, daysAhead],
    queryFn: async () => {
      if (!farmId) return [];

      // 1. Check IndexedDB cache first
      const cached = await getCachedUpcomingAlerts(farmId);
      if (cached?.alerts && cached.daysAhead >= daysAhead) {
        // If offline, return cache immediately
        if (!isOnline) {
          return cached.alerts as UpcomingAlert[];
        }
      }

      // 2. If online, fetch fresh data from RPC
      if (isOnline) {
        const { data, error } = await supabase.rpc('get_upcoming_alerts', {
          p_farm_id: farmId,
          p_days_ahead: daysAhead,
        });

        if (error) throw error;
        const alerts = (data || []) as UpcomingAlert[];

        // 3. Update cache with fresh data
        await updateUpcomingAlertsCache(farmId, alerts, daysAhead);
        return alerts;
      }

      // 4. Offline with valid cache - return it
      if (cached?.alerts) {
        return cached.alerts as UpcomingAlert[];
      }

      // 5. Offline, no cache - return empty gracefully
      return [];
    },
    enabled: !!farmId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

export function groupAlertsByType(alerts: UpcomingAlert[]) {
  const grouped: Record<string, UpcomingAlert[]> = {
    vaccination: [],
    deworming: [],
    delivery: [],
  };

  alerts.forEach((alert) => {
    if (grouped[alert.alert_type]) {
      grouped[alert.alert_type].push(alert);
    }
  });

  return grouped;
}

export function getUrgencyColor(urgency: string) {
  switch (urgency) {
    case 'overdue':
      return 'text-destructive bg-destructive/10 border-destructive/20';
    case 'urgent':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'soon':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    default:
      return 'text-muted-foreground bg-muted border-border';
  }
}

export function getUrgencyLabel(urgency: string, daysUntilDue: number) {
  if (urgency === 'overdue') {
    return `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''} overdue`;
  }
  if (daysUntilDue === 0) {
    return 'Today';
  }
  if (daysUntilDue === 1) {
    return 'Tomorrow';
  }
  return `In ${daysUntilDue} days`;
}
