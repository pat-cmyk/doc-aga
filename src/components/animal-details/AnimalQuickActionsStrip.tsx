/**
 * AnimalQuickActionsStrip
 *
 * Animal-scoped quick action row shown at the top of the Animal Profile,
 * between the BioCardSummary / GrowthBenchmarkCard and the tabs.
 *
 * Reduces the most common record-entry tasks from 4-5 taps to 2:
 *   1) Open animal profile
 *   2) Tap "Milk" / "Weight" / "Health" chip → dialog opens with animal pre-selected
 *
 * SSOT / Reuse:
 *   - Re-uses the existing standalone dialogs that the current tab-level
 *     "+" buttons already invoke — no behavior duplication, no new hooks.
 *   - Respects `readOnly` and `useOnlineStatus` exactly like the existing
 *     tab-level buttons.
 *
 * Farmer persona notes:
 *   - Chips are big touch targets (≥44px) with Taglish labels.
 *   - Milk chip is hidden for males (parity with tab visibility).
 */

import { useState } from 'react';
import { Milk, Scale, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hapticSelection } from '@/lib/haptics';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { RecordSingleMilkDialog } from '@/components/milk-recording/RecordSingleMilkDialog';
import { RecordSingleWeightDialog } from '@/components/weight-recording/RecordSingleWeightDialog';
import { RecordSingleHealthDialog } from '@/components/health-recording/RecordSingleHealthDialog';

interface AnimalQuickActionsStripProps {
  animalId: string;
  farmId: string;
  animalName: string | null;
  earTag: string | null;
  gender: string | null;
  livestockType: string;
  lifeStage: string | null;
  /** Optional — used to constrain date pickers in the recording dialogs. */
  farmEntryDate?: string | null;
  readOnly?: boolean;
  /** Visual density — "compact" for embedding inside the BioCardSheet drawer. */
  variant?: 'default' | 'compact';
  onRecorded?: () => void;
}

export function AnimalQuickActionsStrip({
  animalId,
  farmId,
  animalName,
  earTag,
  gender,
  livestockType,
  lifeStage,
  farmEntryDate = null,
  readOnly = false,
  variant = 'default',
  onRecorded,
}: AnimalQuickActionsStripProps) {
  const isCompact = variant === 'compact';
  const [openMilk, setOpenMilk] = useState(false);
  const [openWeight, setOpenWeight] = useState(false);
  const [openHealth, setOpenHealth] = useState(false);
  const isOnline = useOnlineStatus();

  if (readOnly) return null;

  const isFemale = gender?.toLowerCase() === 'female';
  const displayName = animalName ?? earTag ?? 'Animal';
  const compactGridCols = isFemale ? 'grid-cols-3' : 'grid-cols-2';
  const buttonSizing = isCompact ? 'w-full justify-center' : 'shrink-0';

  const handleOpen = (opener: (v: boolean) => void) => {
    hapticSelection();
    opener(true);
  };

  return (
    <>
      <div
        className={
          isCompact
            ? `grid ${compactGridCols} gap-2`
            : 'flex items-center gap-2 overflow-x-auto scrollbar-hide py-2 -mx-1 px-1'
        }
        role="toolbar"
        aria-label="Quick record actions for this animal"
      >
        {isFemale && (
          <Button
            variant="outline"
            size="sm"
            className={`${buttonSizing} h-11 gap-1.5 touch-manipulation`}
            onClick={() => handleOpen(setOpenMilk)}
            disabled={!isOnline}
          >
            <Milk className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-medium leading-tight">
              Record milk
              <span className="block text-[9px] text-muted-foreground font-normal">
                Gatas
              </span>
            </span>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className={`${buttonSizing} h-11 gap-1.5 touch-manipulation`}
          onClick={() => handleOpen(setOpenWeight)}
          disabled={!isOnline}
        >
          <Scale className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-medium leading-tight">
            Add weight
            <span className="block text-[9px] text-muted-foreground font-normal">
              Timbang
            </span>
          </span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={`${buttonSizing} h-11 gap-1.5 touch-manipulation`}
          onClick={() => handleOpen(setOpenHealth)}
          disabled={!isOnline}
        >
          <Stethoscope className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-medium leading-tight">
            Log health
            <span className="block text-[9px] text-muted-foreground font-normal">
              Kalusugan
            </span>
          </span>
        </Button>
      </div>

      {isFemale && (
        <RecordSingleMilkDialog
          open={openMilk}
          onOpenChange={setOpenMilk}
          animalId={animalId}
          animalName={animalName}
          earTag={earTag}
          farmId={farmId}
          farmEntryDate={farmEntryDate}
        />
      )}
      <RecordSingleWeightDialog
        open={openWeight}
        onOpenChange={setOpenWeight}
        animalId={animalId}
        animalName={displayName}
        farmId={farmId}
        livestockType={livestockType}
        gender={gender}
        lifeStage={lifeStage}
        animalFarmEntryDate={farmEntryDate}
        onSuccess={onRecorded}
      />
      <RecordSingleHealthDialog
        open={openHealth}
        onOpenChange={setOpenHealth}
        animalId={animalId}
        animalName={displayName}
        earTag={earTag}
        farmId={farmId}
        animalFarmEntryDate={farmEntryDate}
        onSuccess={onRecorded}
      />
    </>
  );
}
