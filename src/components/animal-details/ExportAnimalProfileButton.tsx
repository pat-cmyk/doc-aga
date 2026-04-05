/**
 * ExportAnimalProfileButton
 *
 * Header button on the Animal Profile that lets Owner / Manager / Vet roles
 * download an animal profile as PDF, CSV, or both.
 *
 * Two report kinds:
 *   - Full profile — identity, vitals, OVR, genealogy, costs, all records.
 *     For vets, LGU subsidy claims, archival.
 *   - Production focus — milk + feed with line charts (PDF) or joined daily
 *     totals (CSV). For quick production reviews.
 *
 * SSOT: pulls data from `useAnimalProfileExport`, which composes
 * useBioCardData + useAnimalExpenseSummary + getCachedAnimalDetails.
 *
 * Offline-first: the underlying hook reads from IndexedDB, so this button
 * works even without connectivity. Farmhands see no button (cost data is
 * considered sensitive).
 */

import { useState } from 'react';
import {
  Download,
  FileText,
  FileSpreadsheet,
  Loader2,
  LineChart,
  FileBadge,
} from 'lucide-react';
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
import { hapticNotification, hapticSelection } from '@/lib/haptics';
import { useUnifiedPermissions } from '@/contexts/PermissionsContext';
import { useAnimalProfileExport } from '@/hooks/useAnimalProfileExport';
import { downloadAnimalProfile } from '@/lib/animalProfileExport';
import type {
  ExportFormat,
  ReportKind,
} from '@/lib/animalProfileExport/types';
import { cn } from '@/lib/utils';

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
  const [reportKind, setReportKind] = useState<ReportKind>('full');
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const { toast } = useToast();
  const permissions = useUnifiedPermissions();

  const { data, isReady, isLoading } = useAnimalProfileExport(animalId, farmId, {
    farmName,
    farmerName,
  });

  // Farmhand-only users don't see the export (sensitive cost data).
  if (permissions.isOnlyFarmhand) return null;

  const handleReportKindChange = (next: ReportKind) => {
    hapticSelection();
    setReportKind(next);
  };

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
      downloadAnimalProfile(data, format, reportKind);
      hapticNotification('success');
      const kindLabel = reportKind === 'production' ? 'Production report' : 'Animal profile';
      toast({
        title: `${kindLabel} ready`,
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
          <SheetTitle>Export animal data</SheetTitle>
          <SheetDescription>
            I-export ang data ng hayop — gagana ito kahit offline.
          </SheetDescription>
        </SheetHeader>

        {/* Report kind segmented toggle */}
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Report type · Uri ng ulat
          </p>
          <div className="grid grid-cols-2 gap-2">
            <ReportKindOption
              active={reportKind === 'full'}
              icon={<FileBadge className="h-4 w-4" />}
              title="Full profile"
              subtitle="Buong profile"
              onClick={() => handleReportKindChange('full')}
            />
            <ReportKindOption
              active={reportKind === 'production'}
              icon={<LineChart className="h-4 w-4" />}
              title="Production focus"
              subtitle="Gatas at pakain"
              onClick={() => handleReportKindChange('production')}
            />
          </div>
        </div>

        {/* Format picker */}
        <div className="mt-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            Format
          </p>
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
              <div className="font-medium">PDF — printable</div>
              <div className="text-xs text-muted-foreground">
                {reportKind === 'production'
                  ? 'Graph ng gatas at pakain'
                  : 'Para sa bet, LGU subsidy, o print'}
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
              <div className="font-medium">CSV — raw data</div>
              <div className="text-xs text-muted-foreground">
                {reportKind === 'production'
                  ? 'Araw-araw na gatas at pakain'
                  : 'Excel / Sheets, lahat ng record'}
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

// ---------- report-kind option card ----------
interface ReportKindOptionProps {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}

function ReportKindOption({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: ReportKindOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors touch-manipulation',
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
          : 'border-border hover:bg-muted/50',
      )}
    >
      <div className="flex items-center gap-1.5 text-primary">{icon}</div>
      <div className="text-sm font-medium leading-tight">{title}</div>
      <div className="text-[11px] text-muted-foreground leading-tight">
        {subtitle}
      </div>
    </button>
  );
}
