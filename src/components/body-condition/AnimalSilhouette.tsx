import React from 'react';
import { cn } from '@/lib/utils';

interface AnimalSilhouetteProps {
  score: number;
  className?: string;
  showAnnotations?: boolean;
}

const getScoreColor = (score: number): string => {
  if (score <= 1.5) return 'text-destructive';
  if (score <= 2.0) return 'text-amber-500';
  if (score >= 4.5) return 'text-destructive';
  if (score >= 4.0) return 'text-amber-500';
  return 'text-emerald-500';
};

const getBgColor = (score: number): string => {
  if (score <= 1.5) return 'bg-destructive/10';
  if (score <= 2.0) return 'bg-amber-500/10';
  if (score >= 4.5) return 'bg-destructive/10';
  if (score >= 4.0) return 'bg-amber-500/10';
  return 'bg-emerald-500/10';
};

// Get the appropriate body path based on BCS score
const getBodyPath = (score: number): string => {
  if (score <= 1.0) {
    // BCS 1.0 - Emaciated: Very angular, sunken flanks, prominent bones
    return `
      M 32 52
      C 34 42, 48 30, 68 26
      Q 82 22, 98 22
      Q 118 21, 135 24
      Q 152 27, 162 34
      Q 170 42, 174 52
      L 178 56
      C 182 62, 180 66, 176 68
      Q 168 72, 160 74
      L 155 78
      Q 140 80, 120 78
      Q 95 76, 70 78
      Q 55 80, 45 76
      C 36 72, 30 62, 32 52
      Z
    `;
  }
  if (score <= 2.0) {
    // BCS 2.0 - Thin: Angular but less severe
    return `
      M 32 54
      C 35 44, 50 32, 70 28
      Q 85 25, 100 25
      Q 120 24, 138 27
      Q 155 30, 165 38
      Q 172 46, 176 54
      L 180 58
      C 184 64, 182 68, 178 70
      Q 170 74, 162 76
      L 158 82
      Q 140 86, 115 84
      Q 90 83, 68 84
      Q 52 85, 44 80
      C 36 76, 30 64, 32 54
      Z
    `;
  }
  if (score <= 2.5) {
    // BCS 2.5 - Moderately Thin: Slight angularity
    return `
      M 32 56
      C 36 46, 52 34, 72 30
      Q 88 27, 105 27
      Q 125 27, 142 30
      Q 158 34, 167 42
      Q 174 50, 178 58
      L 182 62
      C 186 68, 184 72, 180 74
      Q 172 78, 164 80
      L 160 86
      Q 142 90, 115 88
      Q 88 87, 65 88
      Q 50 89, 42 84
      C 35 80, 30 68, 32 56
      Z
    `;
  }
  if (score <= 3.0) {
    // BCS 3.0 - Ideal: Smooth, well-rounded
    return `
      M 32 58
      C 38 48, 54 36, 74 32
      Q 92 29, 110 29
      Q 130 29, 148 33
      Q 162 38, 170 46
      Q 178 55, 182 64
      L 184 68
      C 188 74, 186 78, 182 80
      Q 174 84, 166 86
      L 162 92
      Q 142 96, 112 94
      Q 82 93, 60 94
      Q 46 95, 40 90
      C 34 86, 30 72, 32 58
      Z
    `;
  }
  if (score <= 3.5) {
    // BCS 3.5 - Good: Fuller body
    return `
      M 32 60
      C 40 50, 56 38, 76 34
      Q 95 31, 115 31
      Q 136 31, 152 36
      Q 166 42, 174 52
      Q 182 62, 186 72
      L 188 76
      C 192 82, 190 86, 186 88
      Q 178 92, 168 94
      L 164 100
      Q 142 104, 108 102
      Q 76 101, 56 102
      Q 44 103, 38 98
      C 32 94, 28 78, 32 60
      Z
    `;
  }
  if (score <= 4.0) {
    // BCS 4.0 - Overweight: Rounded, fat deposits visible
    return `
      M 32 62
      C 42 52, 58 40, 78 36
      Q 98 33, 120 33
      Q 142 33, 158 40
      Q 172 48, 180 60
      Q 188 72, 192 82
      L 194 86
      C 196 92, 194 96, 190 98
      Q 180 102, 170 104
      L 166 110
      Q 140 116, 102 114
      Q 68 112, 50 114
      Q 40 115, 36 108
      C 30 102, 26 84, 32 62
      Z
    `;
  }
  // BCS 5.0 - Obese: Barrel-shaped, heavy fat deposits
  return `
    M 32 64
    C 44 54, 60 42, 80 38
    Q 102 35, 125 35
    Q 148 35, 165 44
    Q 180 56, 188 70
    Q 196 86, 198 96
    L 200 100
    C 202 106, 200 110, 196 112
    Q 184 118, 172 120
    L 168 126
    Q 138 134, 95 130
    Q 58 126, 44 128
    Q 36 130, 32 122
    C 26 114, 22 92, 32 64
    Z
  `;
};

// Get rib paths - curved anatomically accurate ribs
const getRibPaths = (score: number): { path: string; opacity: number }[] => {
  const ribs: { path: string; opacity: number }[] = [];
  
  if (score <= 1.0) {
    // 6 clearly visible curved ribs for emaciated
    ribs.push({ path: "M 58 38 Q 56 48, 54 58 Q 53 66, 55 74", opacity: 0.85 });
    ribs.push({ path: "M 72 34 Q 70 46, 68 56 Q 66 66, 68 76", opacity: 0.85 });
    ribs.push({ path: "M 86 32 Q 84 44, 82 54 Q 80 65, 82 76", opacity: 0.8 });
    ribs.push({ path: "M 100 31 Q 98 43, 96 54 Q 94 65, 96 76", opacity: 0.75 });
    ribs.push({ path: "M 114 31 Q 112 43, 110 54 Q 108 65, 110 75", opacity: 0.7 });
    ribs.push({ path: "M 128 33 Q 126 44, 124 54 Q 122 64, 124 73", opacity: 0.65 });
  } else if (score <= 2.0) {
    // 4-5 visible ribs for thin
    ribs.push({ path: "M 62 36 Q 60 48, 58 58 Q 56 68, 58 78", opacity: 0.7 });
    ribs.push({ path: "M 78 33 Q 76 45, 74 56 Q 72 67, 74 78", opacity: 0.65 });
    ribs.push({ path: "M 94 31 Q 92 44, 90 55 Q 88 66, 90 77", opacity: 0.55 });
    ribs.push({ path: "M 110 31 Q 108 44, 106 55 Q 104 66, 106 76", opacity: 0.45 });
    ribs.push({ path: "M 126 33 Q 124 44, 122 54 Q 120 64, 122 74", opacity: 0.35 });
  } else if (score <= 2.5) {
    // 2-3 faintly visible last ribs
    ribs.push({ path: "M 94 34 Q 92 46, 90 57 Q 88 68, 90 79", opacity: 0.35 });
    ribs.push({ path: "M 110 33 Q 108 46, 106 57 Q 104 68, 106 78", opacity: 0.3 });
    ribs.push({ path: "M 126 35 Q 124 46, 122 56 Q 120 66, 122 76", opacity: 0.25 });
  }
  // BCS 3.0+ = no visible ribs
  
  return ribs;
};

// Get spine/vertebrae detail
const getSpineDetail = (score: number): { path: string; opacity: number; strokeWidth: number; dashArray?: string } | null => {
  if (score <= 1.0) {
    // Very prominent vertebrae with bumps
    return {
      path: "M 50 30 Q 55 26, 62 24 Q 72 22, 85 21 Q 100 20, 115 21 Q 130 22, 145 26 Q 158 30, 168 38",
      opacity: 0.85,
      strokeWidth: 2.5
    };
  }
  if (score <= 2.0) {
    return {
      path: "M 52 32 Q 60 28, 70 26 Q 85 24, 100 24 Q 118 24, 135 27 Q 152 31, 165 40",
      opacity: 0.6,
      strokeWidth: 2,
      dashArray: "6 3"
    };
  }
  if (score <= 2.5) {
    return {
      path: "M 55 35 Q 65 31, 78 29 Q 95 27, 110 28 Q 128 29, 145 34 Q 160 40, 170 48",
      opacity: 0.35,
      strokeWidth: 1.5,
      dashArray: "4 4"
    };
  }
  return null;
};

// Get hip bone details (hook bones / tuber coxae and pin bones / tuber ischii)
const getHipBones = (score: number): { hookBone: string; pinBone: string; opacity: number } | null => {
  if (score <= 1.0) {
    return {
      hookBone: "M 154 28 Q 160 26, 164 30 Q 166 36, 162 40 Q 156 42, 152 38 Q 150 32, 154 28",
      pinBone: "M 170 44 Q 176 42, 180 48 Q 182 54, 178 58 Q 172 58, 168 54 Q 166 48, 170 44",
      opacity: 0.85
    };
  }
  if (score <= 2.0) {
    return {
      hookBone: "M 156 32 Q 162 30, 166 35 Q 168 42, 164 46 Q 158 47, 154 42 Q 152 36, 156 32",
      pinBone: "M 172 50 Q 178 48, 182 54 Q 183 60, 179 64 Q 174 64, 170 60 Q 168 54, 172 50",
      opacity: 0.65
    };
  }
  if (score <= 2.5) {
    return {
      hookBone: "M 158 36 Q 164 35, 167 40 Q 168 46, 165 49 Q 160 49, 157 45 Q 155 40, 158 36",
      pinBone: "M 174 56 Q 179 55, 182 60 Q 183 66, 180 69 Q 176 69, 173 65 Q 172 60, 174 56",
      opacity: 0.4
    };
  }
  return null;
};

// Get tailhead detail
const getTailheadDetail = (score: number): { path: string; opacity: number; fill?: boolean } | null => {
  if (score <= 1.0) {
    // Deep V-shaped cavity
    return {
      path: "M 172 52 Q 178 48, 182 54 L 184 58 Q 180 68, 174 64 Q 170 58, 172 52",
      opacity: 0.8,
      fill: false
    };
  }
  if (score <= 2.0) {
    // Moderate depression
    return {
      path: "M 174 56 Q 180 54, 184 60 Q 182 68, 176 66 Q 172 62, 174 56",
      opacity: 0.5,
      fill: false
    };
  }
  if (score >= 4.0) {
    // Fat padding around tailhead
    return {
      path: "M 180 70 Q 192 66, 196 80 Q 194 94, 184 96 Q 176 90, 180 70",
      opacity: 0.25,
      fill: true
    };
  }
  return null;
};

// Get fat deposits for overweight animals
const getFatDeposits = (score: number): { path: string; opacity: number }[] => {
  const deposits: { path: string; opacity: number }[] = [];
  
  if (score >= 4.0 && score < 4.5) {
    // Fat folds beginning
    deposits.push({ path: "M 58 85 Q 68 90, 78 87 Q 88 90, 98 86", opacity: 0.35 });
    deposits.push({ path: "M 105 88 Q 118 92, 132 88 Q 142 91, 152 87", opacity: 0.3 });
    // Brisket fat
    deposits.push({ path: "M 38 72 Q 42 82, 50 84 Q 58 82, 60 76", opacity: 0.25 });
  } else if (score >= 4.5) {
    // Heavy fat folds
    deposits.push({ path: "M 52 95 Q 68 102, 85 98 Q 102 104, 120 100 Q 138 106, 155 100", opacity: 0.45 });
    deposits.push({ path: "M 60 108 Q 78 114, 98 110 Q 118 116, 140 112", opacity: 0.35 });
    // Large brisket
    deposits.push({ path: "M 35 78 Q 42 92, 55 96 Q 68 92, 72 82", opacity: 0.4 });
    // Dewlap extension
    deposits.push({ path: "M 28 65 Q 32 78, 42 82 Q 48 78, 45 70", opacity: 0.3 });
  }
  
  return deposits;
};

// Get muscle wasting lines for thin animals
const getMuscleWasting = (score: number): { path: string; opacity: number }[] => {
  const lines: { path: string; opacity: number }[] = [];
  
  if (score <= 1.0) {
    // Shoulder blade outline
    lines.push({ path: "M 48 42 Q 55 38, 62 44 Q 58 52, 50 50 Q 46 46, 48 42", opacity: 0.5 });
    // Sunken flank
    lines.push({ path: "M 140 60 Q 145 68, 148 76", opacity: 0.4 });
    // Thigh muscle definition
    lines.push({ path: "M 158 72 Q 155 80, 160 88 Q 165 82, 162 74", opacity: 0.35 });
  } else if (score <= 2.0) {
    // Slight shoulder definition
    lines.push({ path: "M 52 45 Q 58 42, 64 47 Q 60 54, 54 52 Q 50 49, 52 45", opacity: 0.3 });
  }
  
  return lines;
};

export const AnimalSilhouette: React.FC<AnimalSilhouetteProps> = ({
  score,
  className,
  showAnnotations = false,
}) => {
  const color = getScoreColor(score);
  const bodyPath = getBodyPath(score);
  const ribs = getRibPaths(score);
  const spineDetail = getSpineDetail(score);
  const hipBones = getHipBones(score);
  const tailhead = getTailheadDetail(score);
  const fatDeposits = getFatDeposits(score);
  const muscleWasting = getMuscleWasting(score);

  // Adjust viewBox based on score (larger for obese animals)
  const viewBoxWidth = score >= 4.5 ? 220 : score >= 4.0 ? 210 : 200;
  const viewBoxHeight = score >= 4.5 ? 150 : score >= 4.0 ? 140 : 130;

  return (
    <div className={cn('relative', getBgColor(score), 'rounded-lg p-3', className)}>
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className={cn('w-full h-auto', color)}
        aria-label={`Carabao silhouette showing Body Condition Score ${score}`}
      >
        {/* Main body silhouette */}
        <path
          d={bodyPath}
          fill="currentColor"
          opacity={0.12}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Head - more detailed */}
        <path
          d="M 18 50 Q 22 42, 30 40 Q 38 42, 42 50 Q 40 58, 32 62 Q 24 60, 20 54 Q 16 50, 18 50"
          fill="currentColor"
          opacity={0.15}
          stroke="currentColor"
          strokeWidth="2"
        />
        
        {/* Muzzle */}
        <path
          d="M 14 52 Q 12 48, 14 44 Q 18 42, 22 44 Q 20 50, 18 54 Q 16 55, 14 52"
          fill="currentColor"
          opacity={0.2}
          stroke="currentColor"
          strokeWidth="1.5"
        />

        {/* Eye */}
        <ellipse cx="26" cy="48" rx="2.5" ry="2" fill="currentColor" opacity={0.7} />
        <circle cx="25.5" cy="47.5" r="0.8" fill="currentColor" opacity={1} />

        {/* Horns - curved carabao-style */}
        <path
          d="M 20 42 Q 12 34, 6 38 Q 4 42, 8 46"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          opacity={0.6}
          strokeLinecap="round"
        />
        <path
          d="M 38 42 Q 46 34, 52 38 Q 54 42, 50 46"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          opacity={0.6}
          strokeLinecap="round"
        />

        {/* Ears */}
        <ellipse cx="24" cy="38" rx="5" ry="3.5" fill="currentColor" opacity={0.25} transform="rotate(-20 24 38)" />
        <ellipse cx="38" cy="38" rx="5" ry="3.5" fill="currentColor" opacity={0.25} transform="rotate(20 38 38)" />

        {/* Legs - more realistic with joints */}
        {/* Front left leg */}
        <path
          d={`M 54 ${78 + (score >= 4.0 ? 8 : 0)} L 52 ${95 + (score >= 4.0 ? 12 : 0)} Q 50 ${100 + (score >= 4.0 ? 12 : 0)}, 48 ${105 + (score >= 4.0 ? 12 : 0)} L 50 ${115 + (score >= 4.0 ? 12 : 0)} Q 54 ${117 + (score >= 4.0 ? 12 : 0)}, 58 ${115 + (score >= 4.0 ? 12 : 0)} L 60 ${105 + (score >= 4.0 ? 12 : 0)} Q 62 ${100 + (score >= 4.0 ? 12 : 0)}, 60 ${95 + (score >= 4.0 ? 12 : 0)} L 62 ${82 + (score >= 4.0 ? 8 : 0)}`}
          fill="currentColor"
          opacity={0.3}
          stroke="currentColor"
          strokeWidth="1"
        />
        {/* Front right leg (behind) */}
        <path
          d={`M 68 ${80 + (score >= 4.0 ? 8 : 0)} L 66 ${95 + (score >= 4.0 ? 12 : 0)} Q 64 ${100 + (score >= 4.0 ? 12 : 0)}, 62 ${104 + (score >= 4.0 ? 12 : 0)} L 64 ${112 + (score >= 4.0 ? 12 : 0)} Q 68 ${114 + (score >= 4.0 ? 12 : 0)}, 72 ${112 + (score >= 4.0 ? 12 : 0)} L 74 ${104 + (score >= 4.0 ? 12 : 0)} Q 76 ${100 + (score >= 4.0 ? 12 : 0)}, 74 ${95 + (score >= 4.0 ? 12 : 0)} L 76 ${84 + (score >= 4.0 ? 8 : 0)}`}
          fill="currentColor"
          opacity={0.2}
        />
        {/* Back left leg */}
        <path
          d={`M 148 ${82 + (score >= 4.0 ? 10 : 0)} L 144 ${95 + (score >= 4.0 ? 12 : 0)} Q 142 ${102 + (score >= 4.0 ? 12 : 0)}, 140 ${108 + (score >= 4.0 ? 12 : 0)} L 142 ${118 + (score >= 4.0 ? 12 : 0)} Q 146 ${120 + (score >= 4.0 ? 12 : 0)}, 150 ${118 + (score >= 4.0 ? 12 : 0)} L 152 ${108 + (score >= 4.0 ? 12 : 0)} Q 154 ${102 + (score >= 4.0 ? 12 : 0)}, 152 ${95 + (score >= 4.0 ? 12 : 0)} L 156 ${86 + (score >= 4.0 ? 10 : 0)}`}
          fill="currentColor"
          opacity={0.3}
          stroke="currentColor"
          strokeWidth="1"
        />
        {/* Back right leg (behind) */}
        <path
          d={`M 160 ${78 + (score >= 4.0 ? 10 : 0)} L 158 ${92 + (score >= 4.0 ? 12 : 0)} Q 156 ${98 + (score >= 4.0 ? 12 : 0)}, 154 ${104 + (score >= 4.0 ? 12 : 0)} L 156 ${114 + (score >= 4.0 ? 12 : 0)} Q 160 ${116 + (score >= 4.0 ? 12 : 0)}, 164 ${114 + (score >= 4.0 ? 12 : 0)} L 166 ${104 + (score >= 4.0 ? 12 : 0)} Q 168 ${98 + (score >= 4.0 ? 12 : 0)}, 166 ${92 + (score >= 4.0 ? 12 : 0)} L 168 ${82 + (score >= 4.0 ? 10 : 0)}`}
          fill="currentColor"
          opacity={0.2}
        />

        {/* Tail */}
        <path
          d={`M ${score >= 4.0 ? 186 : 176} ${score >= 4.0 ? 75 : 58} Q ${score >= 4.0 ? 196 : 188} ${score >= 4.0 ? 68 : 52}, ${score >= 4.0 ? 200 : 194} ${score >= 4.0 ? 78 : 62} Q ${score >= 4.0 ? 198 : 192} ${score >= 4.0 ? 88 : 70}, ${score >= 4.0 ? 194 : 188} ${score >= 4.0 ? 84 : 66}`}
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          opacity={0.5}
          strokeLinecap="round"
        />

        {/* Ribs - curved anatomical ribs */}
        {ribs.map((rib, idx) => (
          <path
            key={`rib-${idx}`}
            d={rib.path}
            stroke="currentColor"
            strokeWidth="1.8"
            fill="none"
            opacity={rib.opacity}
            strokeLinecap="round"
          />
        ))}

        {/* Spine detail */}
        {spineDetail && (
          <path
            d={spineDetail.path}
            stroke="currentColor"
            strokeWidth={spineDetail.strokeWidth}
            strokeDasharray={spineDetail.dashArray}
            fill="none"
            opacity={spineDetail.opacity}
            strokeLinecap="round"
          />
        )}

        {/* Hip bones */}
        {hipBones && (
          <>
            <path
              d={hipBones.hookBone}
              stroke="currentColor"
              strokeWidth="1.5"
              fill="currentColor"
              fillOpacity={0.1}
              opacity={hipBones.opacity}
            />
            <path
              d={hipBones.pinBone}
              stroke="currentColor"
              strokeWidth="1.5"
              fill="currentColor"
              fillOpacity={0.1}
              opacity={hipBones.opacity}
            />
          </>
        )}

        {/* Tailhead depression or fat padding */}
        {tailhead && (
          <path
            d={tailhead.path}
            stroke="currentColor"
            strokeWidth="1.5"
            fill={tailhead.fill ? "currentColor" : "none"}
            fillOpacity={tailhead.fill ? 0.15 : 0}
            opacity={tailhead.opacity}
          />
        )}

        {/* Fat deposits for overweight animals */}
        {fatDeposits.map((deposit, idx) => (
          <path
            key={`fat-${idx}`}
            d={deposit.path}
            stroke="currentColor"
            strokeWidth="1.5"
            fill="currentColor"
            fillOpacity={0.1}
            opacity={deposit.opacity}
            strokeLinecap="round"
          />
        ))}

        {/* Muscle wasting lines for thin animals */}
        {muscleWasting.map((line, idx) => (
          <path
            key={`muscle-${idx}`}
            d={line.path}
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
            opacity={line.opacity}
          />
        ))}

        {/* Annotations */}
        {showAnnotations && (
          <>
            {/* Rib area annotation */}
            <circle cx="90" cy="55" r="10" fill="hsl(var(--background))" stroke="currentColor" strokeWidth="1.5" />
            <text x="90" y="59" textAnchor="middle" fontSize="11" fill="currentColor" fontWeight="bold">1</text>
            <line x1="100" y1="55" x2="125" y2="55" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" opacity={0.5} />

            {/* Spine annotation */}
            <circle cx="100" cy="24" r="10" fill="hsl(var(--background))" stroke="currentColor" strokeWidth="1.5" />
            <text x="100" y="28" textAnchor="middle" fontSize="11" fill="currentColor" fontWeight="bold">2</text>

            {/* Hip bone annotation */}
            <circle cx="160" cy="32" r="10" fill="hsl(var(--background))" stroke="currentColor" strokeWidth="1.5" />
            <text x="160" y="36" textAnchor="middle" fontSize="11" fill="currentColor" fontWeight="bold">3</text>

            {/* Tailhead annotation */}
            <circle cx="182" cy="52" r="10" fill="hsl(var(--background))" stroke="currentColor" strokeWidth="1.5" />
            <text x="182" y="56" textAnchor="middle" fontSize="11" fill="currentColor" fontWeight="bold">4</text>
          </>
        )}
      </svg>

      {/* Score indicator badge */}
      <div className={cn(
        'absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold',
        'bg-background/80 backdrop-blur-sm border',
        color
      )}>
        BCS {score.toFixed(1)}
      </div>
    </div>
  );
};

export default AnimalSilhouette;
