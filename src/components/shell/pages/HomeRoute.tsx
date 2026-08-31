/**
 * /home — role-variant Home (UX redesign Phase 2).
 *
 * One URL, two compositions: the farmer home keeps the FarmDashboard widgets,
 * the farmhand home keeps the voice-first recording surface. Both get the
 * shared 1-tap record row and shell chrome.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Check, X, Stethoscope, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import FarmDashboard from "@/components/FarmDashboard";
import { CooperativeMembershipCard } from "@/components/farmer/CooperativeMembershipCard";
import { RouteSeo } from "@/components/seo/RouteSeo";
import VoiceRecordButton from "@/components/farmhand/VoiceRecordButton";
import DocAgaConsultation from "@/components/farmhand/DocAgaConsultation";
import { useFarmShellContext } from "../FarmShell";
import { QuickRecordActions } from "../QuickRecordActions";
import { VoiceTrainingCard } from "../VoiceTrainingCard";

function VoiceTrainingCompleteBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <Card className="bg-accent border-border">
      <CardContent className="flex items-center gap-3 py-3 px-4">
        <div className="rounded-full bg-primary flex items-center justify-center shrink-0 h-8 w-8">
          <Check className="text-primary-foreground h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Voice Training Complete! 🎉</h3>
          <p className="text-xs text-muted-foreground">
            Your AI assistant is now optimized for your voice.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDismissed(true)}
          className="h-11 w-11 shrink-0 text-muted-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function FarmerHome() {
  const { farmId, voiceTrainingCompleted } = useFarmShellContext();
  const navigate = useNavigate();

  return (
    <div className="space-y-4 sm:space-y-6">
      <RouteSeo
        title="Dashboard — Doc Aga Farm Management"
        description="Manage your livestock, milk production, feed inventory, and farm finances from one offline-first dashboard built for Filipino farmers."
        path="/home"
      />
      {voiceTrainingCompleted && <VoiceTrainingCompleteBanner />}
      <CooperativeMembershipCard />
      <QuickRecordActions farmId={farmId} />
      <VoiceTrainingCard />
      <FarmDashboard
        farmId={farmId}
        onNavigateToAnimals={() => navigate("/animals")}
        onNavigateToAnimalDetails={(animalId) => navigate(`/animals?animalId=${animalId}`)}
      />
    </div>
  );
}

function FarmhandHome() {
  const { farmId } = useFarmShellContext();
  const [showDocAga, setShowDocAga] = useState(false);

  if (showDocAga) {
    return (
      <DocAgaConsultation initialQuery="" onClose={() => setShowDocAga(false)} farmId={farmId} />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <RouteSeo
        title="Home — Doc Aga Farm Management"
        description="Record milk, feed, and health activities with your voice."
        path="/home"
      />
      <VoiceRecordButton farmId={farmId} animalId={null} />
      <QuickRecordActions farmId={farmId} />
      <VoiceTrainingCard />
      <Card className={cn("cursor-pointer transition-colors hover:bg-accent/50")}
        onClick={() => setShowDocAga(true)}
      >
        <CardContent className="flex items-center gap-3 py-3 px-4">
          <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center shrink-0">
            <Stethoscope className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Ask Doc Aga</p>
            <p className="text-xs text-muted-foreground">Magtanong tungkol sa hayop</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function HomeRoute() {
  const { isFarmhand } = useFarmShellContext();
  return isFarmhand ? <FarmhandHome /> : <FarmerHome />;
}
