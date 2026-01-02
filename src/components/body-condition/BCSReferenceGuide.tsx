import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Eye, Hand } from 'lucide-react';
import { AnimalSilhouette } from './AnimalSilhouette';
import { AnimalCrossSection } from './AnimalCrossSection';
import { BCS_LEVELS } from '@/lib/bcsDefinitions';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface BCSReferenceGuideProps {
  selectedScore?: number;
  onScoreSelect?: (score: number) => void;
  compact?: boolean;
}

const SCORE_TABS = [1.0, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0];

interface IndicatorSet {
  visual: string[];
  palpation: string[];
  comparison: string;
}

const getDetailedIndicators = (score: number): IndicatorSet => {
  if (score <= 1.0) {
    return {
      visual: [
        'All ribs clearly visible from a distance',
        'Spine vertebrae sharply defined',
        'Hip bones (hooks & pins) very prominent',
        'Deep V-shaped cavity around tailhead',
        'Shoulder blade outline visible',
        'Severe muscle wasting on hindquarters'
      ],
      palpation: [
        'Ribs feel like running fingers over knuckles',
        'No fat cover detected on ribs',
        'Hip bones feel sharp and angular',
        'Tailhead bones easily grasped'
      ],
      comparison: 'Feels like running hand over closed fist'
    };
  }
  if (score <= 2.0) {
    return {
      visual: [
        'Individual ribs easily seen',
        'Spine ridge prominently visible',
        'Hook and pin bones clearly visible',
        'Noticeable depression around tailhead',
        'Flank area appears sunken'
      ],
      palpation: [
        'Ribs easily felt with light pressure',
        'Very thin fat cover over ribs',
        'Hip bones feel prominent but less sharp',
        'Some muscle loss on hindquarters'
      ],
      comparison: 'Feels like running hand over open fingers'
    };
  }
  if (score <= 2.5) {
    return {
      visual: [
        'Last 2-3 ribs may be slightly visible',
        'Spine outline still somewhat visible',
        'Hip bones noticeable but less prominent',
        'Slight depression at tailhead',
        'Starting to show some body fill'
      ],
      palpation: [
        'Ribs felt with slight pressure',
        'Thin fat layer beginning to form',
        'Hip bones still easily felt',
        'Some muscle development'
      ],
      comparison: 'Feels like running hand over flat palm with fingers slightly apart'
    };
  }
  if (score <= 3.0) {
    return {
      visual: [
        'Ribs not visible - smooth body contour',
        'Spine not visible but may be slightly felt',
        'Hip bones rounded, covered smoothly',
        'Tailhead area filled and smooth',
        'Well-balanced, healthy appearance'
      ],
      palpation: [
        'Ribs felt with firm pressure only',
        'Thin fat layer covers ribs evenly',
        'Hip bones felt with pressure, not prominent',
        'Good muscle tone throughout'
      ],
      comparison: 'Feels like running hand over flat palm'
    };
  }
  if (score <= 3.5) {
    return {
      visual: [
        'Body appears smooth and full',
        'No bone structure visible',
        'Slight fat deposits at tailhead',
        'Well-rounded hindquarters',
        'Beginning to show fullness'
      ],
      palpation: [
        'Ribs difficult to feel, need firm pressure',
        'Noticeable fat layer over ribs',
        'Hip bones barely detectable',
        'Fat beginning to accumulate'
      ],
      comparison: 'Feels like running hand over palm with slight padding'
    };
  }
  if (score <= 4.0) {
    return {
      visual: [
        'Fat folds beginning to appear',
        'Bone structure completely hidden',
        'Tailhead buried in fat deposits',
        'Brisket becoming prominent',
        'Fat pads visible on body'
      ],
      palpation: [
        'Ribs very difficult to feel',
        'Thick fat layer covers bones',
        'Hip bones cannot be felt easily',
        'Soft, spongy fat deposits present'
      ],
      comparison: 'Feels like running hand over thick padded surface'
    };
  }
  return {
    visual: [
      'Very rounded, barrel-shaped body',
      'Large fat folds on neck and body',
      'Tailhead completely obscured',
      'Large brisket and dewlap',
      'Pendulous belly may be present',
      'Movement may appear labored'
    ],
    palpation: [
      'Cannot feel ribs at all',
      'Very thick fat everywhere',
      'All bone structure hidden',
      'Deep, soft fat deposits'
    ],
    comparison: 'Feels like pressing into a thick cushion'
  };
};

const getStatusLabel = (score: number): { en: string; tl: string; color: string } => {
  if (score <= 1.5) return { en: 'Emaciated', tl: 'Sobrang Payat', color: 'text-destructive' };
  if (score <= 2.0) return { en: 'Thin', tl: 'Payat', color: 'text-amber-600' };
  if (score <= 2.5) return { en: 'Slightly Thin', tl: 'Medyo Payat', color: 'text-amber-500' };
  if (score <= 3.5) return { en: 'Ideal', tl: 'Tamang-tama', color: 'text-emerald-600' };
  if (score <= 4.0) return { en: 'Overweight', tl: 'Medyo Mataba', color: 'text-amber-500' };
  return { en: 'Obese', tl: 'Sobrang Taba', color: 'text-destructive' };
};

export const BCSReferenceGuide: React.FC<BCSReferenceGuideProps> = ({
  selectedScore = 3.0,
  onScoreSelect,
  compact = false,
}) => {
  const [viewScore, setViewScore] = useState(selectedScore);
  const [viewMode, setViewMode] = useState<'side' | 'rear'>('side');

  const currentIndex = SCORE_TABS.indexOf(viewScore);
  const statusLabel = getStatusLabel(viewScore);
  const indicators = getDetailedIndicators(viewScore);

  const handlePrev = () => {
    if (currentIndex > 0) {
      const newScore = SCORE_TABS[currentIndex - 1];
      setViewScore(newScore);
      onScoreSelect?.(newScore);
    }
  };

  const handleNext = () => {
    if (currentIndex < SCORE_TABS.length - 1) {
      const newScore = SCORE_TABS[currentIndex + 1];
      setViewScore(newScore);
      onScoreSelect?.(newScore);
    }
  };

  const handleTabSelect = (score: number) => {
    setViewScore(score);
    onScoreSelect?.(score);
  };

  // Sync with external selectedScore changes
  React.useEffect(() => {
    const closestScore = SCORE_TABS.reduce((prev, curr) =>
      Math.abs(curr - selectedScore) < Math.abs(prev - selectedScore) ? curr : prev
    );
    setViewScore(closestScore);
  }, [selectedScore]);

  return (
    <div className={cn(
      'rounded-lg border bg-card',
      compact ? 'p-3' : 'p-4'
    )}>
      {/* Score Tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
        {SCORE_TABS.map((score) => (
          <Button
            key={score}
            variant={viewScore === score ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleTabSelect(score)}
            className={cn(
              'min-w-[44px] px-2 text-xs font-medium',
              viewScore === score && getStatusLabel(score).color.replace('text-', 'bg-').replace('600', '500').replace('500', '600')
            )}
          >
            {score.toFixed(1)}
          </Button>
        ))}
      </div>

      {/* View Toggle (Side vs Rear) */}
      {!compact && (
        <div className="flex justify-center gap-2 mb-3">
          <Button
            variant={viewMode === 'side' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('side')}
            className="text-xs"
          >
            Side View
          </Button>
          <Button
            variant={viewMode === 'rear' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('rear')}
            className="text-xs"
          >
            Rear View
          </Button>
        </div>
      )}

      {/* Silhouette Display */}
      <div className="relative">
        {viewMode === 'side' ? (
          <AnimalSilhouette
            score={viewScore}
            showAnnotations={!compact}
            className="w-full max-w-[320px] mx-auto"
          />
        ) : (
          <AnimalCrossSection
            score={viewScore}
            className="w-full max-w-[200px] mx-auto"
          />
        )}

        {/* Navigation Arrows */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNext}
          disabled={currentIndex === SCORE_TABS.length - 1}
          className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Score Label */}
      <div className="text-center mt-3 mb-3">
        <div className={cn('text-lg font-bold', statusLabel.color)}>
          {viewScore.toFixed(1)} - {statusLabel.en}
        </div>
        <div className="text-sm text-muted-foreground italic">
          {statusLabel.tl}
        </div>
      </div>

      {/* Detailed Indicators with Visual/Palpation tabs */}
      {!compact ? (
        <Tabs defaultValue="visual" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-2">
            <TabsTrigger value="visual" className="text-xs gap-1">
              <Eye className="h-3.5 w-3.5" />
              What to See
            </TabsTrigger>
            <TabsTrigger value="palpation" className="text-xs gap-1">
              <Hand className="h-3.5 w-3.5" />
              What to Feel
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="visual" className="space-y-1.5 mt-0">
            <ul className="space-y-1">
              {indicators.visual.map((indicator, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className={cn(
                    'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  )}>
                    {idx + 1}
                  </span>
                  <span className="text-foreground/80">{indicator}</span>
                </li>
              ))}
            </ul>
          </TabsContent>
          
          <TabsContent value="palpation" className="space-y-2 mt-0">
            <ul className="space-y-1">
              {indicators.palpation.map((indicator, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className={cn(
                    'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
                    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  )}>
                    {idx + 1}
                  </span>
                  <span className="text-foreground/80">{indicator}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 p-2 rounded-md bg-muted/50 border">
              <div className="text-xs font-medium text-muted-foreground mb-1">Touch Comparison:</div>
              <div className="text-sm italic text-foreground/70">{indicators.comparison}</div>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Key Indicators:
          </div>
          <ul className="space-y-1">
            {indicators.visual.slice(0, 4).map((indicator, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <span className={cn(
                  'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
                  'bg-muted text-muted-foreground'
                )}>
                  {idx + 1}
                </span>
                <span className="text-foreground/80">{indicator}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Annotation Legend (when annotations shown) */}
      {!compact && viewMode === 'side' && (
        <div className="mt-4 pt-3 border-t">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Diagram Legend:
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center font-bold">1</span>
              <span>Ribs (Tadyang)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center font-bold">2</span>
              <span>Spine (Gulugod)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center font-bold">3</span>
              <span>Hip Bones (Balakang)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center font-bold">4</span>
              <span>Tailhead (Buntot)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BCSReferenceGuide;
