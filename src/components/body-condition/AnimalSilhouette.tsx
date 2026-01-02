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

export const AnimalSilhouette: React.FC<AnimalSilhouetteProps> = ({
  score,
  className,
  showAnnotations = false,
}) => {
  // Calculate visual parameters based on score
  const ribCount = score <= 1.5 ? 5 : score <= 2.0 ? 4 : score <= 2.5 ? 2 : 0;
  const ribOpacity = score <= 1.0 ? 0.8 : score <= 2.0 ? 0.5 : score <= 2.5 ? 0.3 : 0;
  const spineOpacity = score <= 1.5 ? 0.8 : score <= 2.5 ? 0.4 : 0;
  const hipOpacity = score <= 2.0 ? 0.8 : score <= 2.5 ? 0.4 : 0;
  const bodyWidth = 0.85 + (score - 1) * 0.075; // Scale from 0.85 to 1.15
  const bellyDrop = score >= 4.0 ? 8 : score >= 3.5 ? 4 : 0;
  const tailheadDepth = score <= 2.0 ? 6 : score <= 2.5 ? 3 : 0;

  const color = getScoreColor(score);

  return (
    <div className={cn('relative', getBgColor(score), 'rounded-lg p-2', className)}>
      <svg
        viewBox="0 0 200 120"
        className={cn('w-full h-auto', color)}
        style={{ transform: `scaleY(${bodyWidth})` }}
        aria-label={`Carabao silhouette showing Body Condition Score ${score}`}
      >
        {/* Main body outline */}
        <path
          d={`
            M 30 55
            C 30 40, 45 30, 70 28
            L 130 28
            C 155 28, 170 38, 175 50
            L 180 55
            C 185 60, 188 65, 185 70
            L 180 72
            C 178 75, 170 78, 165 80
            L 160 ${85 + bellyDrop}
            C 140 ${90 + bellyDrop}, 100 ${92 + bellyDrop}, 60 ${88 + bellyDrop}
            L 45 ${82 + bellyDrop}
            C 35 78, 28 70, 28 60
            Z
          `}
          fill="currentColor"
          opacity={0.15}
          stroke="currentColor"
          strokeWidth="2"
        />

        {/* Head */}
        <ellipse cx="25" cy="58" rx="12" ry="10" fill="currentColor" opacity={0.2} stroke="currentColor" strokeWidth="1.5" />
        <circle cx="20" cy="56" r="2" fill="currentColor" opacity={0.6} /> {/* Eye */}
        
        {/* Horns */}
        <path d="M 18 50 Q 10 42, 8 48" stroke="currentColor" strokeWidth="2" fill="none" opacity={0.6} />
        <path d="M 32 50 Q 40 42, 42 48" stroke="currentColor" strokeWidth="2" fill="none" opacity={0.6} />

        {/* Ears */}
        <ellipse cx="22" cy="48" rx="4" ry="3" fill="currentColor" opacity={0.3} />
        <ellipse cx="30" cy="48" rx="4" ry="3" fill="currentColor" opacity={0.3} />

        {/* Legs */}
        <rect x="55" y="85" width="8" height="25" rx="3" fill="currentColor" opacity={0.3} />
        <rect x="75" y="88" width="7" height="22" rx="3" fill="currentColor" opacity={0.25} />
        <rect x="140" y="82" width="8" height="28" rx="3" fill="currentColor" opacity={0.3} />
        <rect x="158" y="78" width="7" height="26" rx="3" fill="currentColor" opacity={0.25} />

        {/* Tail */}
        <path d="M 175 55 Q 190 50, 195 60 Q 192 65, 188 62" stroke="currentColor" strokeWidth="2" fill="none" opacity={0.5} />

        {/* Ribs - visible based on score */}
        {ribCount >= 1 && (
          <line x1="65" y1="45" x2="65" y2="70" stroke="currentColor" strokeWidth="1.5" opacity={ribOpacity} />
        )}
        {ribCount >= 2 && (
          <line x1="80" y1="42" x2="80" y2="72" stroke="currentColor" strokeWidth="1.5" opacity={ribOpacity} />
        )}
        {ribCount >= 3 && (
          <line x1="95" y1="40" x2="95" y2="74" stroke="currentColor" strokeWidth="1.5" opacity={ribOpacity} />
        )}
        {ribCount >= 4 && (
          <line x1="110" y1="40" x2="110" y2="74" stroke="currentColor" strokeWidth="1.5" opacity={ribOpacity} />
        )}
        {ribCount >= 5 && (
          <line x1="125" y1="42" x2="125" y2="72" stroke="currentColor" strokeWidth="1.5" opacity={ribOpacity} />
        )}

        {/* Spine ridge - visible for thin animals */}
        {spineOpacity > 0 && (
          <path
            d="M 45 32 Q 90 26, 140 30 Q 160 32, 170 40"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="4 2"
            fill="none"
            opacity={spineOpacity}
          />
        )}

        {/* Hip bones - prominent for thin animals */}
        {hipOpacity > 0 && (
          <>
            <circle cx="155" cy="45" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" opacity={hipOpacity} />
            <circle cx="165" cy="52" r="4" stroke="currentColor" strokeWidth="1.5" fill="none" opacity={hipOpacity} />
          </>
        )}

        {/* Tailhead depression - for thin animals */}
        {tailheadDepth > 0 && (
          <path
            d={`M 168 50 Q 172 ${50 + tailheadDepth}, 176 52`}
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            opacity={0.5}
          />
        )}

        {/* Fat deposits - for overweight animals */}
        {score >= 4.0 && (
          <>
            <ellipse cx="100" cy="85" rx="30" ry="8" fill="currentColor" opacity={0.1} />
            <path d="M 60 75 Q 70 82, 80 78" stroke="currentColor" strokeWidth="1" opacity={0.3} fill="none" />
            <path d="M 120 75 Q 130 82, 140 78" stroke="currentColor" strokeWidth="1" opacity={0.3} fill="none" />
          </>
        )}

        {/* Annotations */}
        {showAnnotations && (
          <>
            {/* Rib annotation */}
            <circle cx="95" cy="55" r="8" fill="hsl(var(--background))" stroke="currentColor" strokeWidth="1" />
            <text x="95" y="59" textAnchor="middle" fontSize="10" fill="currentColor" fontWeight="bold">1</text>
            <line x1="103" y1="55" x2="130" y2="55" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity={0.6} />

            {/* Spine annotation */}
            <circle cx="90" cy="28" r="8" fill="hsl(var(--background))" stroke="currentColor" strokeWidth="1" />
            <text x="90" y="32" textAnchor="middle" fontSize="10" fill="currentColor" fontWeight="bold">2</text>

            {/* Hip annotation */}
            <circle cx="160" cy="38" r="8" fill="hsl(var(--background))" stroke="currentColor" strokeWidth="1" />
            <text x="160" y="42" textAnchor="middle" fontSize="10" fill="currentColor" fontWeight="bold">3</text>

            {/* Tailhead annotation */}
            <circle cx="178" cy="45" r="8" fill="hsl(var(--background))" stroke="currentColor" strokeWidth="1" />
            <text x="178" y="49" textAnchor="middle" fontSize="10" fill="currentColor" fontWeight="bold">4</text>
          </>
        )}
      </svg>
    </div>
  );
};

export default AnimalSilhouette;
