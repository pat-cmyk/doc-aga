import { useState, useEffect } from 'react';
import { WifiOff, Database, RefreshCw, X, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface OfflineModeCardProps {
  className?: string;
}

/**
 * First-time offline user guidance card
 * Explains how offline mode works and what data is available
 */
export function OfflineModeCard({ className }: OfflineModeCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [hasSeenCard, setHasSeenCard] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('offlineModeCardDismissed');
    setHasSeenCard(seen === 'true');
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('offlineModeCardDismissed', 'true');
  };

  // Don't show if user has already dismissed
  if (dismissed || hasSeenCard) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <WifiOff className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">Offline Mode Available</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mr-2 -mt-2"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Doc Aga works offline! Here's what you can do without internet:
        </p>

        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <span>View all cached animals and records</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <span>Record milk, feed, and health activities</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <span>Add new animals with voice or form</span>
          </li>
          <li className="flex items-start gap-2">
            <RefreshCw className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <span>Data syncs automatically when online</span>
          </li>
        </ul>

        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
          <Database className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Your data is stored locally and synced securely when you're back online.
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleDismiss}
        >
          Got it!
        </Button>
      </CardContent>
    </Card>
  );
}
