import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Scale, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBodyConditionScores } from '@/hooks/useBodyConditionScores';
import { BCS_LEVELS } from '@/lib/bcsDefinitions';
import { VoiceInputButton } from '@/components/ui/voice-input-button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { BCSReferenceGuide } from './BCSReferenceGuide';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RecordBCSDialogProps {
  animalId: string;
  farmId: string;
  animalName?: string;
  trigger?: React.ReactNode;
}

export function RecordBCSDialog({ animalId, farmId, animalName, trigger }: RecordBCSDialogProps) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(3.0);
  const [notes, setNotes] = useState('');
  const [showGuide, setShowGuide] = useState(true);
  const isOnline = useOnlineStatus();

  const { createBCS } = useBodyConditionScores(animalId);

  const currentLevel = BCS_LEVELS.find(
    (level) => Math.abs(level.score - score) < 0.3
  ) || BCS_LEVELS[3]; // Default to "Ideal"

  const getScoreColor = (s: number) => {
    if (s < 2.0) return 'text-destructive';
    if (s < 2.5) return 'text-yellow-600';
    if (s <= 3.5) return 'text-green-600';
    if (s <= 4.0) return 'text-yellow-600';
    return 'text-destructive';
  };

  const handleSubmit = async () => {
    await createBCS.mutateAsync({
      animal_id: animalId,
      farm_id: farmId,
      score,
      notes: notes || undefined,
    });
    setOpen(false);
    setScore(3.0);
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Scale className="h-4 w-4" />
            Record BCS
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Body Condition Score
            {animalName && <span className="text-muted-foreground">- {animalName}</span>}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Score Display */}
            <div className="text-center space-y-2">
              <div className={cn('text-5xl font-bold', getScoreColor(score))}>
                {score.toFixed(1)}
              </div>
              <div className="space-y-1">
                <p className="font-medium">{currentLevel.label}</p>
                <p className="text-sm text-muted-foreground">{currentLevel.labelTagalog}</p>
              </div>
            </div>

            {/* Visual Reference Guide */}
            <Collapsible open={showGuide} onOpenChange={setShowGuide}>
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Visual Reference Guide
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowGuide(!showGuide)}
                  className="gap-1"
                >
                  {showGuide ? (
                    <>
                      Hide <ChevronUp className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Show <ChevronDown className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
              <CollapsibleContent className="mt-2">
                <BCSReferenceGuide
                  selectedScore={score}
                  onScoreSelect={setScore}
                  compact
                />
              </CollapsibleContent>
            </Collapsible>

            {/* Slider */}
            <div className="space-y-4">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Emaciated (1.0)</span>
                <span>Obese (5.0)</span>
              </div>
              <Slider
                value={[score]}
                onValueChange={([value]) => setScore(value)}
                min={1}
                max={5}
                step={0.5}
                className="w-full"
              />
            </div>

            {/* Description */}
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-sm">{currentLevel.description}</p>
              <p className="text-sm text-muted-foreground mt-1">{currentLevel.descriptionTagalog}</p>
              <ul className="mt-3 space-y-1">
                {currentLevel.indicators.map((indicator, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {indicator}
                  </li>
                ))}
              </ul>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Additional observations..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <VoiceInputButton
                  onTranscription={(text) => setNotes(prev => prev ? `${prev} ${text}` : text)}
                  disabled={!isOnline}
                  className="self-start"
                />
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={createBCS.isPending}
              className="w-full"
            >
              {createBCS.isPending ? 'Saving...' : 'Save BCS'}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
