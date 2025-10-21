import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Mic } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export function FloatingVoiceTrainingButton() {
  const [showButton, setShowButton] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkTrainingStatus();
  }, []);

  const checkTrainingStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setShowButton(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('voice_training_completed, voice_training_skipped')
        .eq('id', user.id)
        .single();

      // Show button if training is not completed AND not skipped
      const shouldShow = profile && 
        !profile.voice_training_completed && 
        !profile.voice_training_skipped;
      
      setShowButton(shouldShow);
    } catch (error) {
      console.error('Error checking training status:', error);
      setShowButton(false);
    }
  };

  const handleClick = () => {
    navigate('/voice-training');
  };

  if (!showButton) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleClick}
            size="lg"
            className="fixed bottom-4 left-4 h-14 w-14 rounded-full shadow-lg z-50 animate-pulse bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            <Mic className="h-6 w-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Complete voice training for better accuracy</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
