import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Sun, 
  Sparkles, 
  AlertTriangle, 
  Lightbulb, 
  X, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Milk,
  Heart,
  Syringe,
  TrendingUp
} from 'lucide-react';
import { useMorningBrief, type MorningBrief, type MorningBriefMetrics } from '@/hooks/useMorningBrief';
import { useIsMobile } from '@/hooks/use-mobile';

interface MorningBriefCardProps {
  farmId: string;
}

export function MorningBriefCard({ farmId }: MorningBriefCardProps) {
  const { brief, metrics, isLoading, error, isDismissed, dismiss, refresh } = useMorningBrief(farmId);
  const isMobile = useIsMobile();
  // Default to collapsed on mobile, expanded on desktop
  const [isExpanded, setIsExpanded] = useState(!isMobile);

  // Update expanded state when viewport changes (e.g., rotating device)
  useEffect(() => {
    // Only auto-collapse if switching TO mobile, don't force expand on desktop
    if (isMobile && isExpanded) {
      setIsExpanded(false);
    }
  }, [isMobile]);

  if (isDismissed) {
    return null;
  }

  if (isLoading) {
    return <MorningBriefSkeleton />;
  }

  if (error || !brief) {
    return null; // Silently fail - don't block the dashboard
  }

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Decorative element */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className={`relative ${isMobile ? 'pt-5 pb-4' : 'pb-2'}`}>
          {/* Action buttons - positioned top-right on mobile */}
          <div className={`flex items-center gap-1 ${isMobile ? 'absolute top-3 right-3' : 'absolute top-2 right-4'}`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 active:scale-95 transition-transform"
              onClick={refresh}
              title="Refresh brief"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 active:scale-95 transition-transform">
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 active:scale-95 transition-transform"
              onClick={dismiss}
              title="Dismiss for today"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Main content - full width on mobile */}
          <div className={`${isMobile ? 'pr-28' : 'pr-24'}`}>
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-full bg-primary/10 shrink-0 ${isMobile ? 'mt-0.5' : ''}`}>
                <Sun className={`text-primary ${isMobile ? 'h-6 w-6' : 'h-5 w-5'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold leading-snug ${isMobile ? 'text-lg' : 'text-base'}`}>
                  {brief.greeting}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Doc Aga's Morning Brief</p>
              </div>
            </div>
            
            {/* Compact metrics preview on mobile when collapsed */}
            {!isExpanded && isMobile && metrics && (
              <div className="flex items-center gap-4 mt-3 animate-fade-in">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  <span className="font-medium text-foreground">{metrics.totalAnimals}</span> Hayop
                </span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Milk className="h-4 w-4" />
                  <span className="font-medium text-foreground">{metrics.todayMilk}L</span> Milk
                </span>
              </div>
            )}
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Summary */}
            <p className="text-sm text-foreground/90">{brief.summary}</p>

            {/* Quick Metrics */}
            {metrics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <QuickMetric 
                  icon={<TrendingUp className="h-3.5 w-3.5" />}
                  label="Hayop"
                  value={metrics.totalAnimals.toString()}
                />
                <QuickMetric 
                  icon={<Milk className="h-3.5 w-3.5" />}
                  label="Milk Today"
                  value={`${metrics.todayMilk}L`}
                />
                <QuickMetric 
                  icon={<Heart className="h-3.5 w-3.5" />}
                  label="Buntis"
                  value={metrics.pregnantCount.toString()}
                />
                <QuickMetric 
                  icon={<Syringe className="h-3.5 w-3.5" />}
                  label="Vaccines Due"
                  value={metrics.overdueVaccines.toString()}
                  highlight={metrics.overdueVaccines > 0}
                />
              </div>
            )}

            {/* Highlights */}
            {brief.highlights && brief.highlights.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
                  Highlights
                </div>
                <ul className="space-y-1">
                  {brief.highlights.map((highlight, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Alerts */}
            {brief.alerts && brief.alerts.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                  Kailangan ng Atensyon
                </div>
                <ul className="space-y-1">
                  {brief.alerts.map((alert, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <Badge variant="outline" className="text-xs shrink-0 border-orange-300 text-orange-700 dark:border-orange-800 dark:text-orange-400">
                        !
                      </Badge>
                      <span>{alert}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Daily Tip */}
            {brief.tip && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-primary mb-0.5">Tip ng Araw</p>
                  <p className="text-sm">{brief.tip}</p>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface QuickMetricProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}

function QuickMetric({ icon, label, value, highlight }: QuickMetricProps) {
  return (
    <div className={`flex items-center gap-2 p-2 rounded-md ${highlight ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-muted/50'}`}>
      <div className={`${highlight ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${highlight ? 'text-orange-700 dark:text-orange-300' : ''}`}>{value}</p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

function MorningBriefSkeleton() {
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
