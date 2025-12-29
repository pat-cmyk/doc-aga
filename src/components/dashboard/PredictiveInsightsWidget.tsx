import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Brain, ChevronDown, ChevronUp, RefreshCw, Sparkles } from 'lucide-react';
import { usePredictiveInsights } from '@/hooks/usePredictiveInsights';
import { useIsMobile } from '@/hooks/use-mobile';
import { MilkPredictionCard } from './prediction-cards/MilkPredictionCard';
import { BreedingPredictionCard } from './prediction-cards/BreedingPredictionCard';
import { HealthTrendCard } from './prediction-cards/HealthTrendCard';
import { formatDistanceToNow, format } from 'date-fns';

interface PredictiveInsightsWidgetProps {
  farmId: string;
}

export function PredictiveInsightsWidget({ farmId }: PredictiveInsightsWidgetProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem('predictive_insights_open');
    return saved !== 'false';
  });
  
  const { insights, loading, error, lastUpdated, dataSource, refresh } = usePredictiveInsights(farmId);

  const handleToggle = (open: boolean) => {
    setIsOpen(open);
    localStorage.setItem('predictive_insights_open', String(open));
  };

  // Format timestamp for mobile - compact version
  const getTimestampDisplay = () => {
    if (!lastUpdated) return null;
    
    if (isMobile) {
      // Show compact format on mobile: "2h ago" or "Dec 29"
      const now = new Date();
      const diff = now.getTime() - lastUpdated.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      
      if (hours < 24) {
        return formatDistanceToNow(lastUpdated, { addSuffix: false }).replace(' hours', 'h').replace(' hour', 'h').replace(' minutes', 'm').replace(' minute', 'm');
      }
      return format(lastUpdated, 'MMM d');
    }
    
    return formatDistanceToNow(lastUpdated, { addSuffix: true });
  };

  if (error && !loading && !insights) {
    return null; // Don't show widget if there's an error and no cached data
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <Collapsible open={isOpen} onOpenChange={handleToggle}>
        <CardHeader className={isMobile ? "pb-2 px-4" : "pb-2"}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Brain className={isMobile ? "h-4 w-4 text-primary" : "h-5 w-5 text-primary"} />
              <CardTitle className={isMobile ? "text-base flex items-center gap-1.5" : "text-lg flex items-center gap-2"}>
                {isMobile ? "AI" : "AI Predictions"}
                <Sparkles className={isMobile ? "h-3 w-3 text-yellow-500" : "h-4 w-4 text-yellow-500"} />
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            
            <div className="flex items-center gap-2">
              {lastUpdated && (
                <span className="text-xs text-muted-foreground">
                  {getTimestampDisplay()}
                  {dataSource === 'fallback' && !isMobile && ' (basic)'}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  refresh();
                }}
                disabled={loading}
                className={isMobile ? "h-9 w-9" : "h-8 w-8"}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className={isMobile ? "pt-2 px-4 pb-4" : "pt-2"}>
            {loading && !insights ? (
              <div className={isMobile ? "space-y-3" : "grid gap-4 md:grid-cols-3"}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-3 p-4 rounded-lg border bg-card">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
            ) : insights ? (
              <div className={isMobile ? "space-y-3" : "grid gap-4 md:grid-cols-3"}>
                <MilkPredictionCard prediction={insights.milk} />
                <BreedingPredictionCard prediction={insights.breeding} />
                <HealthTrendCard prediction={insights.health} />
              </div>
            ) : error ? (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm">Unable to load predictions</p>
                <Button variant="link" size="sm" onClick={refresh}>
                  Try again
                </Button>
              </div>
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
