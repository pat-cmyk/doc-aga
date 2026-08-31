/**
 * In-page add-animal success state (UX redesign Phase 4).
 *
 * Rendered by AnimalForm in place of the form after a save — previously a
 * bottom Sheet stacked over the form. Contextual next steps by animal type.
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Milk, Syringe, Scale, Camera, Plus, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLivestockEmoji } from "@/lib/filipinoLabels";

interface AddAnimalSuccessScreenProps {
  animalData: {
    name?: string;
    earTag: string;
    gender: string;
    livestockType: string;
    isLactating?: boolean;
    animalId?: string;
    animalType?: string;
  };
  onAction: (action: string) => void;
}

export const AddAnimalSuccessScreen = ({ animalData, onAction }: AddAnimalSuccessScreenProps) => {
  const { name, earTag, gender, livestockType, isLactating, animalType } = animalData;

  // Contextual next steps based on animal type and status
  const getNextSteps = () => {
    const steps: Array<{
      action: string;
      label: string;
      sublabel: string;
      icon: React.ReactNode;
      primary?: boolean;
    }> = [];

    if (animalType === "offspring") {
      steps.push({
        action: "add_photo",
        label: "Add Photo",
        sublabel: "Magdagdag ng Larawan",
        icon: <Camera className="h-5 w-5" />,
        primary: true,
      });
    } else if (gender === "Female") {
      if (isLactating) {
        steps.push({
          action: "record_milk",
          label: "Record First Milk",
          sublabel: "Itala ang Gatas",
          icon: <Milk className="h-5 w-5" />,
          primary: true,
        });
      } else {
        steps.push({
          action: "schedule_ai",
          label: "Schedule AI",
          sublabel: "Mag-iskedyul ng AI",
          icon: <Syringe className="h-5 w-5" />,
          primary: true,
        });
      }
    } else {
      steps.push({
        action: "record_weight",
        label: "Record Weight",
        sublabel: "Itala ang Timbang",
        icon: <Scale className="h-5 w-5" />,
        primary: true,
      });
    }

    steps.push({
      action: "add_another",
      label: "Add Another Animal",
      sublabel: "Magdagdag Pa",
      icon: <Plus className="h-5 w-5" />,
    });

    return steps;
  };

  const nextSteps = getNextSteps();
  const emoji = getLivestockEmoji(livestockType);
  const genderLabel = gender === "Female" ? "Female / Babae" : "Male / Lalaki";
  const displayName = name || earTag;

  return (
    <div className="space-y-6 py-2">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-2">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-in zoom-in duration-300">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <span className="absolute -bottom-1 -right-1 text-3xl">{emoji}</span>
          </div>
        </div>
        <div>
          <p className="text-xl font-semibold text-primary">Success!</p>
          <p className="text-sm text-muted-foreground">Matagumpay!</p>
        </div>
        <p className="text-sm text-muted-foreground">Animal added successfully / Naidagdag ang hayop</p>
      </div>

      {/* Animal summary */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center text-2xl border">
              {emoji}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{displayName}</h3>
              <p className="text-sm text-muted-foreground">
                {earTag && name && <span className="mr-2">{earTag}</span>}
                <span>{genderLabel}</span>
                {isLactating && (
                  <span className="ml-2 inline-flex items-center gap-1 text-primary">
                    <Milk className="h-3 w-3" /> Lactating
                  </span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next steps */}
      <div className="space-y-3">
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">What's next?</p>
          <p className="text-xs text-muted-foreground">Ano ang susunod?</p>
        </div>

        <div className="flex flex-col gap-2">
          {nextSteps.map((step) => (
            <Button
              key={step.action}
              variant={step.primary ? "default" : "outline"}
              size="lg"
              className="w-full justify-start gap-3 h-16"
              onClick={() => onAction(step.action)}
            >
              {step.icon}
              <div className="flex flex-col items-start gap-0.5">
                <span className="font-medium text-base">{step.label}</span>
                <span
                  className={cn(
                    "text-xs",
                    step.primary ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {step.sublabel}
                </span>
              </div>
            </Button>
          ))}
        </div>

        <Button
          variant="ghost"
          className="w-full text-muted-foreground mt-2 h-12"
          onClick={() => onAction("back_to_herd")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Herd / Bumalik sa Kawan
        </Button>
      </div>
    </div>
  );
};
