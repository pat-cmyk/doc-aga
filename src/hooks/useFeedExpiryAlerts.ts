import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, differenceInDays, format } from "date-fns";

export interface FeedExpiryAlert {
  id: string;
  feed_type: string;
  quantity_kg: number;
  expiry_date: string;
  daysUntilExpiry: number;
  urgency: 'expired' | 'critical' | 'warning' | 'upcoming';
}

export function useFeedExpiryAlerts(farmId: string) {
  return useQuery({
    queryKey: ['feed-expiry-alerts', farmId],
    queryFn: async (): Promise<FeedExpiryAlert[]> => {
      if (!farmId) return [];

      const thirtyDaysFromNow = addDays(new Date(), 30);
      
      const { data, error } = await supabase
        .from('feed_inventory')
        .select('id, feed_type, quantity_kg, expiry_date')
        .eq('farm_id', farmId)
        .gt('quantity_kg', 0)
        .not('expiry_date', 'is', null)
        .lte('expiry_date', format(thirtyDaysFromNow, 'yyyy-MM-dd'))
        .order('expiry_date');

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return (data || []).map(item => {
        const expiryDate = new Date(item.expiry_date!);
        expiryDate.setHours(0, 0, 0, 0);
        const daysUntilExpiry = differenceInDays(expiryDate, today);

        let urgency: FeedExpiryAlert['urgency'];
        if (daysUntilExpiry < 0) {
          urgency = 'expired';
        } else if (daysUntilExpiry <= 7) {
          urgency = 'critical';
        } else if (daysUntilExpiry <= 14) {
          urgency = 'warning';
        } else {
          urgency = 'upcoming';
        }

        return {
          id: item.id,
          feed_type: item.feed_type,
          quantity_kg: item.quantity_kg,
          expiry_date: item.expiry_date!,
          daysUntilExpiry,
          urgency,
        };
      });
    },
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function getExpiryUrgencyColor(urgency: FeedExpiryAlert['urgency']): string {
  switch (urgency) {
    case 'expired':
      return 'border-destructive bg-destructive/5 text-destructive';
    case 'critical':
      return 'border-destructive/50 bg-destructive/5';
    case 'warning':
      return 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30';
    case 'upcoming':
      return 'border-muted bg-muted/30';
    default:
      return 'border-muted';
  }
}
