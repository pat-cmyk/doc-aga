import { useState, useEffect } from 'react';
import { Wifi, Download, X, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { preloadAllData, getCacheStats, onCacheProgress, type CacheProgress } from '@/lib/dataCache';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface OfflineOnboardingProps {
  farmId: string;
}

/**
 * Calculate overall download percentage from phase-specific progress.
 * Records phase is weighted heaviest (70%) since it loops per animal.
 */
function getOverallPercent(p: CacheProgress): number {
  const weights: Record<string, number> = { animals: 0.1, records: 0.7, feed: 0.1, farm: 0.1 };
  const offsets: Record<string, number> = { animals: 0, records: 0.1, feed: 0.8, farm: 0.9 };

  if (p.phase === 'complete') return 100;
  const phaseProgress = p.total > 0 ? p.current / p.total : 0;
  return Math.round((offsets[p.phase] + weights[p.phase] * phaseProgress) * 100);
}

export function OfflineOnboarding({ farmId }: OfflineOnboardingProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<CacheProgress | null>(null);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem('hasSeenOfflineOnboarding');
    
    // Check if cache already exists
    if (!hasSeenOnboarding && farmId && isOnline) {
      getCacheStats(farmId).then((stats) => {
        // Only show if no cache exists
        if (stats.animals.count === 0) {
          setOpen(true);
        }
      });
    }
  }, [farmId, isOnline]);

  const handleDownload = async () => {
    setLoading(true);
    const unsubscribe = onCacheProgress((p) => setProgress(p));

    try {
      await preloadAllData(farmId, isOnline);
      localStorage.setItem('hasSeenOfflineOnboarding', 'true');
      // Brief pause to show "complete" state before closing
      await new Promise(resolve => setTimeout(resolve, 800));
      setOpen(false);
    } catch (error) {
      console.error('Failed to preload data:', error);
    }

    unsubscribe();
    setProgress(null);
    setLoading(false);
  };

  const handleSkip = () => {
    localStorage.setItem('hasSeenOfflineOnboarding', 'true');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            <div className="flex flex-col">
              <span>Enable Offline Access</span>
              <span className="text-xs font-normal text-muted-foreground">I-enable ang Offline Access</span>
            </div>
          </DialogTitle>
          <DialogDescription>
            Would you like to download your farm data for offline access? (Recommended)
            <span className="block text-xs mt-0.5">Gusto mo bang i-download ang data ng iyong farm para sa offline access?</span>
          </DialogDescription>
        </DialogHeader>

        {loading && progress ? (
          <div className="flex-1 space-y-4 py-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{progress.message}</span>
                <span className="font-medium">{getOverallPercent(progress)}%</span>
              </div>
              <Progress value={getOverallPercent(progress)} className="h-3" />
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {(['animals', 'records', 'feed', 'farm'] as const).map((phase) => {
                const isActive = progress.phase === phase;
                const isDone = progress.phase === 'complete' ||
                  (['animals', 'records', 'feed', 'farm'].indexOf(progress.phase) >
                   ['animals', 'records', 'feed', 'farm'].indexOf(phase));
                return (
                  <div key={phase} className={`flex flex-col items-center gap-1 ${isActive ? 'text-primary font-medium' : isDone ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <div className={`h-4 w-4 rounded-full border-2 ${isActive ? 'border-primary animate-pulse' : 'border-muted-foreground/30'}`} />
                    )}
                    <span className="capitalize">{phase === 'feed' ? 'Feeds' : phase === 'farm' ? 'Farm' : phase === 'animals' ? 'Animals' : 'Records'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h4 className="font-medium text-sm">This will cache:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span> All animals
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span> All records
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span> Feeds
                </li>
              </ul>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm text-blue-900">
              <p className="font-medium mb-1">Why enable offline access?</p>
              <ul className="text-xs space-y-1 text-blue-800">
                <li>• Access your data even without internet</li>
                <li>• Faster loading times</li>
                <li>• Continue working in remote areas</li>
              </ul>
            </div>
          </div>
        )}

        {!loading && (
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleSkip}
              className="w-full sm:w-auto"
            >
              <X className="h-4 w-4 mr-2" />
              Skip for Now
            </Button>
            <Button
              onClick={handleDownload}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Now
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
