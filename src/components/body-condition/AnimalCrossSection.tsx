import React from 'react';
import { cn } from '@/lib/utils';

interface AnimalCrossSectionProps {
  score: number;
  className?: string;
}

const getScoreColor = (score: number): string => {
  if (score <= 1.5) return 'text-destructive';
  if (score <= 2.0) return 'text-amber-500';
  if (score >= 4.5) return 'text-destructive';
  if (score >= 4.0) return 'text-amber-500';
  return 'text-emerald-500';
};

// Get rear cross-section body outline based on score
const getCrossSectionPath = (score: number): string => {
  if (score <= 1.0) {
    // Emaciated: Sharp angular shape, prominent spine and hip bones
    return `
      M 80 20
      L 70 22
      Q 55 28, 45 40
      Q 35 52, 32 68
      Q 30 80, 35 90
      L 45 95
      L 55 100
      L 75 95
      L 85 90
      L 95 95
      L 115 100
      L 125 95
      L 135 90
      Q 138 80, 136 68
      Q 133 52, 123 40
      Q 113 28, 98 22
      L 88 20
      Q 84 18, 80 20
      Z
    `;
  }
  if (score <= 2.0) {
    // Thin: Less angular but still visible structure
    return `
      M 80 22
      L 68 24
      Q 52 30, 42 44
      Q 32 58, 30 72
      Q 28 84, 34 94
      L 48 100
      L 65 98
      L 80 95
      L 95 98
      L 112 100
      L 126 94
      Q 132 84, 130 72
      Q 128 58, 118 44
      Q 108 30, 92 24
      L 80 22
      Z
    `;
  }
  if (score <= 2.5) {
    // Moderately thin: Starting to fill out
    return `
      M 80 24
      L 66 26
      Q 48 34, 38 48
      Q 28 62, 26 78
      Q 24 92, 32 102
      L 50 108
      L 70 104
      L 80 100
      L 90 104
      L 110 108
      L 128 102
      Q 136 92, 134 78
      Q 132 62, 122 48
      Q 112 34, 94 26
      L 80 24
      Z
    `;
  }
  if (score <= 3.0) {
    // Ideal: Smooth rounded shape
    return `
      M 80 26
      Q 64 28, 52 36
      Q 38 46, 30 62
      Q 22 78, 22 94
      Q 24 108, 36 116
      L 58 120
      L 75 116
      L 80 112
      L 85 116
      L 102 120
      L 124 116
      Q 136 108, 138 94
      Q 138 78, 130 62
      Q 122 46, 108 36
      Q 96 28, 80 26
      Z
    `;
  }
  if (score <= 3.5) {
    // Good: Fuller rounded shape
    return `
      M 80 28
      Q 62 30, 48 40
      Q 32 52, 24 70
      Q 16 88, 18 106
      Q 22 122, 38 130
      L 62 134
      L 76 128
      L 80 124
      L 84 128
      L 98 134
      L 122 130
      Q 138 122, 142 106
      Q 144 88, 136 70
      Q 128 52, 112 40
      Q 98 30, 80 28
      Z
    `;
  }
  if (score <= 4.0) {
    // Overweight: Rounded with fat deposits
    return `
      M 80 30
      Q 58 32, 42 44
      Q 24 58, 16 78
      Q 8 100, 12 120
      Q 18 138, 38 148
      L 65 152
      L 78 144
      L 80 140
      L 82 144
      L 95 152
      L 122 148
      Q 142 138, 148 120
      Q 152 100, 144 78
      Q 136 58, 118 44
      Q 102 32, 80 30
      Z
    `;
  }
  // Obese: Very rounded, barrel-shaped
  return `
    M 80 32
    Q 54 34, 36 48
    Q 16 64, 8 88
    Q 0 112, 6 136
    Q 14 158, 38 168
    L 68 172
    L 78 162
    L 80 156
    L 82 162
    L 92 172
    L 122 168
    Q 146 158, 154 136
    Q 160 112, 152 88
    Q 144 64, 124 48
    Q 106 34, 80 32
    Z
  `;
};

// Get spine prominence based on score
const getSpineDetails = (score: number): { path: string; opacity: number } | null => {
  if (score <= 1.0) {
    return {
      path: "M 80 18 L 80 6 M 76 20 L 72 12 M 84 20 L 88 12",
      opacity: 0.8
    };
  }
  if (score <= 2.0) {
    return {
      path: "M 80 20 L 80 10 M 77 22 L 74 14 M 83 22 L 86 14",
      opacity: 0.5
    };
  }
  if (score <= 2.5) {
    return {
      path: "M 80 22 L 80 14",
      opacity: 0.3
    };
  }
  return null;
};

// Get loin muscle indication
const getLoinMuscle = (score: number): { left: string; right: string; opacity: number } => {
  if (score <= 1.0) {
    return {
      left: "M 65 40 Q 55 50, 50 65 Q 48 75, 52 85",
      right: "M 95 40 Q 105 50, 110 65 Q 112 75, 108 85",
      opacity: 0.5
    };
  }
  if (score <= 2.0) {
    return {
      left: "M 62 45 Q 50 58, 45 75 Q 42 88, 48 98",
      right: "M 98 45 Q 110 58, 115 75 Q 118 88, 112 98",
      opacity: 0.35
    };
  }
  if (score >= 4.0) {
    return {
      left: "M 55 55 Q 35 75, 28 100 Q 22 125, 35 145",
      right: "M 105 55 Q 125 75, 132 100 Q 138 125, 125 145",
      opacity: 0.25
    };
  }
  return {
    left: "M 58 50 Q 42 68, 35 90 Q 30 110, 42 125",
    right: "M 102 50 Q 118 68, 125 90 Q 130 110, 118 125",
    opacity: 0.15
  };
};

export const AnimalCrossSection: React.FC<AnimalCrossSectionProps> = ({
  score,
  className,
}) => {
  const color = getScoreColor(score);
  const bodyPath = getCrossSectionPath(score);
  const spineDetails = getSpineDetails(score);
  const loinMuscle = getLoinMuscle(score);

  const viewBoxHeight = score >= 4.5 ? 180 : score >= 4.0 ? 160 : 140;

  return (
    <div className={cn('relative', className)}>
      <svg
        viewBox={`0 0 160 ${viewBoxHeight}`}
        className={cn('w-full h-auto', color)}
        aria-label={`Rear cross-section view showing Body Condition Score ${score}`}
      >
        {/* Main body cross-section */}
        <path
          d={bodyPath}
          fill="currentColor"
          opacity={0.12}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Spine prominence */}
        {spineDetails && (
          <path
            d={spineDetails.path}
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            opacity={spineDetails.opacity}
            strokeLinecap="round"
          />
        )}

        {/* Loin muscle outlines */}
        <path
          d={loinMuscle.left}
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          opacity={loinMuscle.opacity}
          strokeLinecap="round"
        />
        <path
          d={loinMuscle.right}
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          opacity={loinMuscle.opacity}
          strokeLinecap="round"
        />

        {/* Center line (spine area from above) */}
        <line
          x1="80"
          y1={score <= 2.0 ? 25 : 30}
          x2="80"
          y2={score >= 4.0 ? viewBoxHeight - 20 : viewBoxHeight - 30}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity={0.3}
        />

        {/* Hip bone indicators for thin animals */}
        {score <= 2.0 && (
          <>
            <circle cx="45" cy={score <= 1.0 ? 42 : 48} r="5" stroke="currentColor" strokeWidth="1.5" fill="none" opacity={score <= 1.0 ? 0.7 : 0.4} />
            <circle cx="115" cy={score <= 1.0 ? 42 : 48} r="5" stroke="currentColor" strokeWidth="1.5" fill="none" opacity={score <= 1.0 ? 0.7 : 0.4} />
          </>
        )}

        {/* Fat fold indicators for overweight */}
        {score >= 4.0 && (
          <>
            <path
              d={`M 30 ${score >= 4.5 ? 110 : 95} Q 40 ${score >= 4.5 ? 120 : 102}, 55 ${score >= 4.5 ? 115 : 98}`}
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              opacity={0.35}
            />
            <path
              d={`M 130 ${score >= 4.5 ? 110 : 95} Q 120 ${score >= 4.5 ? 120 : 102}, 105 ${score >= 4.5 ? 115 : 98}`}
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              opacity={0.35}
            />
          </>
        )}

        {/* Labels */}
        <text
          x="80"
          y={viewBoxHeight - 5}
          textAnchor="middle"
          fontSize="10"
          fill="currentColor"
          opacity={0.6}
          fontWeight="500"
        >
          Rear View
        </text>
      </svg>
    </div>
  );
};

export default AnimalCrossSection;
