import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimalSilhouette } from './AnimalSilhouette';
import { BCS_LEVELS } from '@/lib/bcsDefinitions';

interface BCSReferenceGuideProps {
  selectedScore?: number;
  onScoreSelect?: (score: number) => void;
  compact?: boolean;
}

const SCORE_TABS = [1.0, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0];

const getIndicators = (score: number): string[] => {
  if (score <= 1.5) {
    return [
      'Ribs, spine, and hip bones very visible',
      'Severe muscle wasting',
      'Deep cavity around tailhead',
      'Animal appears weak'
    ];
  }
  if (score <= 2.0) {
    return [
      'Individual ribs easily seen',
      'Spine and hip bones prominent',
      'Slight depression at tailhead',
      'Little fat cover'
    ];
  }
  if (score <= 2.5) {
    return [
      'Last 2-3 ribs may be visible',
      'Spine slightly visible',
      'Hip bones still noticeable',
      'Minimal fat cover'
    ];
  }
  if (score <= 3.0) {
    return [
      'Ribs felt but not seen',
      'Smooth body appearance',
      'Hip bones rounded, not prominent',
      'Good fat cover over tailhead'
    ];
  }
  if (score <= 3.5) {
    return [
      'Ribs difficult to feel',
      'Body appears smooth and full',
      'Hip bones barely felt',
      'Fat deposits visible'
    ];
  }
  if (score <= 4.0) {
    return [
      'Ribs cannot be felt easily',
      'Fat folds beginning to appear',
      'Hip bones hidden under fat',
      'Obvious fat deposits'
    ];
  }
  return [
    'Bone structure completely hidden',
    'Large fat folds on body',
    'Mobility may be affected',
    'Excessive fat everywhere'
  ];
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

  const currentIndex = SCORE_TABS.indexOf(viewScore);
  const statusLabel = getStatusLabel(viewScore);
  const indicators = getIndicators(viewScore);

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
              'min-w-[40px] px-2 text-xs font-medium',
              viewScore === score && getStatusLabel(score).color.replace('text-', 'bg-').replace('600', '500').replace('500', '600')
            )}
          >
            {score.toFixed(1)}
          </Button>
        ))}
      </div>

      {/* Silhouette Display */}
      <div className="relative">
        <AnimalSilhouette
          score={viewScore}
          showAnnotations={!compact}
          className="w-full max-w-[280px] mx-auto"
        />

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
      <div className="text-center mt-3 mb-2">
        <div className={cn('text-lg font-bold', statusLabel.color)}>
          {viewScore.toFixed(1)} - {statusLabel.en}
        </div>
        <div className="text-sm text-muted-foreground italic">
          {statusLabel.tl}
        </div>
      </div>

      {/* Key Indicators */}
      <div className="space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Key Indicators:
        </div>
        <ul className="space-y-1">
          {indicators.map((indicator, idx) => (
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

      {/* Annotation Legend (when annotations shown) */}
      {!compact && (
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
