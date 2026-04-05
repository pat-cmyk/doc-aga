/**
 * ExportAnimalProfileButton
 *
 * Header button on the Animal Profile that lets Owner / Manager / Vet roles
 * download a full animal profile as PDF, CSV, or both.
 *
 * SSOT: pulls data from `useAnimalProfileExport`, which composes
 * useBioCardData + useAnimalExpenseSummary + getCachedAnimalDetails.
 *
 * Offline-first: the underlying hook reads from IndexedDB, so this button
 * works even without connectivity. Farmhands see no button (cost data is
 * considered sensitive).
 */

import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { hapticNotification } from '@/lib/haptics';
import { useUnifiedPermissions } from '@/contexts/PermissionsContext';
import { useAnimalProfileExport } from '@/hooks/useAnimalProfileExport';
import { downloadAnimalProfile } from '@/lib/animalProfileExport';
import type { ExportFormat } from '@/lib/animalProfileExport/types';

interface ExportAnimalProfileButtonProps {
  animalId: string;
  farmId: string | undefined;
  farmName?: string | null;
  farmerName?: string | null;
  variant?: 'outline' | 'secondary' | 'ghost';
  size?: 'sm' | 'default' | 'icon';
  className?: string;
}

export function ExportAnimalProfileButton({
  animalId,
  farmId,
  farmName,
  farmerName,
  variant = 'outline',
  size = 'sm',
  className,
}: ExportAnimalProfileButtonProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const { toast } = useToast();
  const permissions = useUnifiedPermissions();

  const { data, isReady, isLoading } = useAnimalProfileExport(animalId, farmId, {
    farmName,
    farmerName,
  });

  // Farmhand-only users don't see the export (sensitive cost data).
  if (permissions.isOnlyFarmhand) return null;

  const handleExport = async (format: ExportFormat) => {
    if (!data) {
      toast({
        title: 'Export unavailable',
        description: 'Animal data is still loading. Please try again in a moment.',
        variant: 'destructive',
      });
      return;
    }
    setExporting(format);
    try {
      downloadAnimalProfile(data, format);
      hapticNotification('success');
      toast({
        title: 'Export ready',
        description:
          format === 'both'
            ? 'PDF and CSV saved to your downloads.'
            : `${format.toUpperCase()} saved to your downloads.`,
      });
      setOpen(false);
    } catch (err) {
      console.error('[ExportAnimalProfileButton] export failed', err);
      hapticNotification('error');
      toast({
        title: 'Export failed',
        description:
          err instanceof Error ? err.message : 'Could not generate the file.',
        variant: 'destructive',
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          disabled={isLoading || !isReady}
          aria-label="Export animal profile"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-1" />
          )}
          Export
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Export animal profile</SheetTitle>
          <SheetDescription>
            I-export ang profile ng hayop. Pumili ng format — gagana ito kahit
            offline.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-3"
            disabled={exporting !== null}
            onClick={() => handleExport('pdf')}
          >
            {exporting === 'pdf' ? (
              <Loader2 className="h-5 w-5 mr-3 animate-spin" />
            ) : (
              <FileText className="h-5 w-5 mr-3 text-primary" />
            )}
            <div className="text-left">
              <div className="font-medium">PDF — printable report</div>
              <div className="text-xs text-muted-foreground">
                Para sa bet, LGU subsidy, o print
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-3"
            disabled={exporting !== null}
            onClick={() => handleExport('csv')}
          >
            {exporting === 'csv' ? (
              <Loader2 className="h-5 w-5 mr-3 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-5 w-5 mr-3 text-primary" />
            )}
            <div className="text-left">
              <div className="font-medium">CSV — full raw data</div>
              <div className="text-xs text-muted-foreground">
                Excel / Sheets, lahat ng record
              </div>
            </div>
          </Button>
          <Button
            variant="default"
            className="w-full justify-start h-auto py-3"
            disabled={exporting !== null}
            onClick={() => handleExport('both')}
          >
            {exporting === 'both' ? (
              <Loader2 className="h-5 w-5 mr-3 animate-spin" />
            ) : (
              <Download className="h-5 w-5 mr-3" />
            )}
            <div className="text-left">
              <div className="font-medium">Both / Pareho</div>
              <div className="text-xs opacity-80">PDF + CSV sabay-sabay</div>
            </div>
          </Button>
          {data?.meta.sourceIsOffline && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              Offline snapshot — data as of{' '}
              {data.meta.cacheLastUpdated
                ? new Date(data.meta.cacheLastUpdated).toLocaleDateString()
                : 'unknown'}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
