import { useState, useEffect } from 'react';
import { Wifi, Download, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { preloadAllData, getCacheStats } from '@/lib/dataCache';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface OfflineOnboardingProps {
  farmId: string;
}

export function OfflineOnboarding({ farmId }: OfflineOnboardingProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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
    
    try {
      await preloadAllData(farmId, isOnline);
      localStorage.setItem('hasSeenOfflineOnboarding', 'true');
      setOpen(false);
    } catch (error) {
      console.error('Failed to preload data:', error);
    }
    
    setLoading(false);
  };

  const handleSkip = () => {
    localStorage.setItem('hasSeenOfflineOnboarding', 'true');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Enable Offline Access
          </DialogTitle>
          <DialogDescription>
            Would you like to download your farm data for offline access? (Recommended)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
            <p className="font-medium mb-1">💡 Why enable offline access?</p>
            <ul className="text-xs space-y-1 text-blue-800">
              <li>• Access your data even without internet</li>
              <li>• Faster loading times</li>
              <li>• Continue working in remote areas</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            <X className="h-4 w-4 mr-2" />
            Skip for Now
          </Button>
          <Button
            onClick={handleDownload}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            <Download className={`h-4 w-4 mr-2 ${loading ? 'animate-bounce' : ''}`} />
            {loading ? 'Downloading...' : 'Download Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
