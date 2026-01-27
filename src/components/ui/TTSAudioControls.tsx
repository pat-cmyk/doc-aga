import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipForward, Square, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface TTSAudioControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  queueLength: number;
  volume: number;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onStop: () => void;
  onVolumeChange: (v: number) => void;
  showVolumeSlider?: boolean;
  className?: string;
}

export function TTSAudioControls({
  isPlaying,
  isPaused,
  queueLength,
  volume,
  onPause,
  onResume,
  onSkip,
  onStop,
  onVolumeChange,
  showVolumeSlider = true,
  className,
}: TTSAudioControlsProps) {
  const pendingCount = Math.max(0, queueLength - 1);
  
  return (
    <div 
      className={cn(
        "flex items-center gap-1.5 p-2 rounded-lg bg-muted/50 border",
        isPlaying && "ring-2 ring-primary/20",
        className
      )}
    >
      {/* Play/Pause Button */}
      <Button
        size="sm"
        variant={isPaused ? "default" : "secondary"}
        className="h-8 w-8 p-0"
        onClick={isPaused ? onResume : onPause}
        aria-label={isPaused ? "Resume audio" : "Pause audio"}
      >
        {isPaused ? (
          <Play className="h-4 w-4" />
        ) : (
          <Pause className="h-4 w-4" />
        )}
      </Button>

      {/* Skip Button */}
      <Button
        size="sm"
        variant="secondary"
        className="h-8 w-8 p-0"
        onClick={onSkip}
        disabled={queueLength <= 1 && !isPlaying && !isPaused}
        aria-label="Skip to next audio"
      >
        <SkipForward className="h-4 w-4" />
      </Button>

      {/* Stop Button */}
      <Button
        size="sm"
        variant="destructive"
        className="h-8 w-8 p-0"
        onClick={onStop}
        aria-label="Stop all audio"
      >
        <Square className="h-3.5 w-3.5" />
      </Button>

      {/* Volume Control */}
      {showVolumeSlider && (
        <div className="flex items-center gap-1.5 ml-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => onVolumeChange(volume > 0 ? 0 : 1)}
            aria-label={volume > 0 ? "Mute" : "Unmute"}
          >
            {volume > 0 ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </Button>
          <Slider
            value={[volume]}
            min={0}
            max={1}
            step={0.1}
            onValueChange={([v]) => onVolumeChange(v)}
            className="w-16"
            aria-label="Volume"
          />
        </div>
      )}

      {/* Queue Count Badge */}
      {pendingCount > 0 && (
        <div 
          className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium"
          aria-label={`${pendingCount} audio${pendingCount > 1 ? 's' : ''} in queue`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          +{pendingCount}
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for mobile or limited space
 */
export function TTSAudioControlsCompact({
  isPlaying,
  isPaused,
  queueLength,
  onPause,
  onResume,
  onSkip,
  onStop,
  className,
}: Omit<TTSAudioControlsProps, 'volume' | 'onVolumeChange' | 'showVolumeSlider'>) {
  const pendingCount = Math.max(0, queueLength - 1);
  
  return (
    <div 
      className={cn(
        "flex items-center gap-1 p-1.5 rounded-md bg-muted/50 border",
        className
      )}
    >
      <Button
        size="sm"
        variant={isPaused ? "default" : "secondary"}
        className="h-7 w-7 p-0"
        onClick={isPaused ? onResume : onPause}
        aria-label={isPaused ? "Resume" : "Pause"}
      >
        {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
      </Button>

      <Button
        size="sm"
        variant="secondary"
        className="h-7 w-7 p-0"
        onClick={onSkip}
        aria-label="Skip"
      >
        <SkipForward className="h-3.5 w-3.5" />
      </Button>

      <Button
        size="sm"
        variant="destructive"
        className="h-7 w-7 p-0"
        onClick={onStop}
        aria-label="Stop"
      >
        <Square className="h-3 w-3" />
      </Button>

      {pendingCount > 0 && (
        <span className="ml-1 text-xs text-muted-foreground">
          +{pendingCount}
        </span>
      )}
    </div>
  );
}
