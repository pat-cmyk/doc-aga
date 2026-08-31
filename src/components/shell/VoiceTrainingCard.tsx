/**
 * Voice-training prompt as a dismissible Home card (UX redesign Phase 2).
 *
 * Replaces voice-training/FloatingVoiceTrainingButton — a pulsing left-side
 * FAB competing for the thumb zone. Same eligibility check (training neither
 * completed nor skipped); dismissal is device-local so the card returns on a
 * new device, matching the old button's behavior.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const DISMISS_KEY = "voice_training_card_dismissed";

export function VoiceTrainingCard() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;

    let cancelled = false;
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("voice_training_completed, voice_training_skipped")
          .eq("id", user.id)
          .single();
        if (cancelled) return;
        setVisible(!!profile && !profile.voice_training_completed && !profile.voice_training_skipped);
      } catch {
        setVisible(false);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  return (
    <Card className="bg-accent border-border">
      <CardContent className="flex items-center gap-3 py-3 px-4">
        <div className="h-10 w-10 rounded-full bg-card flex items-center justify-center shrink-0">
          <Mic className="h-5 w-5 text-primary" />
        </div>
        <button
          type="button"
          className="flex-1 min-w-0 text-left"
          onClick={() => navigate("/voice-training")}
        >
          <p className="text-sm font-semibold">Train your voice</p>
          <p className="text-xs text-muted-foreground">
            Sanayin ang boses mo — mas tumpak na voice recording
          </p>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 text-muted-foreground"
          aria-label="Dismiss voice training reminder"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setVisible(false);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
