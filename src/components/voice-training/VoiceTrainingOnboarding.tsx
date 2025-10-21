import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mic, CheckCircle, Zap } from "lucide-react";

interface VoiceTrainingOnboardingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartTraining: () => void;
  onSkip: () => void;
}

export function VoiceTrainingOnboarding({
  open,
  onOpenChange,
  onStartTraining,
  onSkip,
}: VoiceTrainingOnboardingProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mic className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-2xl">
            Improve Voice Recognition
          </DialogTitle>
          <DialogDescription className="text-center space-y-4">
            <p>
              Train the AI to better understand your voice, pronunciation, and accent in both English and Tagalog.
            </p>
            
            <div className="space-y-3 pt-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-left">
                  <strong>More Accurate:</strong> Better recognition of your speech patterns
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-left">
                  <strong>Quick Setup:</strong> Takes only 3-5 minutes to complete
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Mic className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-left">
                  <strong>Personalized:</strong> AI learns your unique voice and pronunciation
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground pt-2">
              You'll record 16 short phrases in English and Tagalog
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button onClick={onStartTraining} size="lg" className="w-full">
            Start Voice Training
          </Button>
          <Button onClick={onSkip} variant="ghost" size="sm" className="w-full">
            Skip for Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
