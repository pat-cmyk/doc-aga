import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { format, parseISO, isWithinInterval, addDays } from "date-fns";

interface ExpectedDeliveriesTimelineProps {
  deliveriesByMonth: Record<string, {
    total: number;
    by_type: Record<string, number>;
  }>;
  isLoading?: boolean;
}

export const ExpectedDeliveriesTimeline = ({
  deliveriesByMonth,
  isLoading,
}: ExpectedDeliveriesTimelineProps) => {
  const sortedMonths = Object.keys(deliveriesByMonth).sort();
  
  // Calculate deliveries in next 30 days
  const now = new Date();
  const thirtyDaysFromNow = addDays(now, 30);
  
  const urgentDeliveries = sortedMonths.reduce((count, monthKey) => {
    const monthDate = parseISO(`${monthKey}-01`);
    if (isWithinInterval(monthDate, { start: now, end: thirtyDaysFromNow })) {
      return count + deliveriesByMonth[monthKey].total;
    }
    return count;
  }, 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expected Deliveries Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-24 mb-2" />
                <div className="h-8 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sortedMonths.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expected Deliveries Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No upcoming deliveries</p>
              <p className="text-xs mt-1">Expected deliveries will appear here</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Expected Deliveries Timeline</CardTitle>
          {urgentDeliveries > 0 && (
            <Badge variant="destructive" className="font-normal">
              {urgentDeliveries} due in 30 days
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[300px] overflow-y-auto">
          {sortedMonths.slice(0, 8).map((monthKey) => {
            const delivery = deliveriesByMonth[monthKey];
            const monthDate = parseISO(`${monthKey}-01`);
            const isUrgent = isWithinInterval(monthDate, { start: now, end: thirtyDaysFromNow });
            
            return (
              <div key={monthKey} className={`space-y-2 pb-4 border-b last:border-0 ${isUrgent ? 'bg-orange-500/5 -mx-4 px-4 rounded' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{format(monthDate, 'MMMM yyyy')}</span>
                    {isUrgent && (
                      <Badge variant="destructive" className="text-xs">Urgent</Badge>
                    )}
                  </div>
                  <Badge variant="secondary">{delivery.total} total</Badge>
                </div>
                
                <div className="flex flex-wrap gap-2 ml-6">
                  {Object.entries(delivery.by_type).map(([type, count]) => (
                    <div key={type} className="text-xs text-muted-foreground flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="capitalize">{type}: {count}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          
          {sortedMonths.length > 8 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              And {sortedMonths.length - 8} more months...
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
