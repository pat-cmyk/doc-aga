import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Milk, Syringe, Scale, Camera, Plus, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLivestockEmoji } from "@/lib/filipinoLabels";

interface AddAnimalSuccessScreenProps {
  open: boolean;
  onClose: () => void;
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

export const AddAnimalSuccessScreen = ({
  open,
  onClose,
  animalData,
  onAction,
}: AddAnimalSuccessScreenProps) => {
  const { name, earTag, gender, livestockType, isLactating, animalType } = animalData;
  
  // Determine contextual next steps based on animal type and status
  const getNextSteps = () => {
    const steps: Array<{
      action: string;
      label: string;
      sublabel: string;
      icon: React.ReactNode;
      primary?: boolean;
    }> = [];
    
    if (animalType === "offspring") {
      // Offspring: Photo first, then add another
      steps.push({
        action: "add_photo",
        label: "Magdagdag ng Larawan",
        sublabel: "Add Photo",
        icon: <Camera className="h-5 w-5" />,
        primary: true,
      });
    } else if (gender === "Female") {
      if (isLactating) {
        // Lactating female: Record milk
        steps.push({
          action: "record_milk",
          label: "Itala ang Gatas",
          sublabel: "Record First Milk",
          icon: <Milk className="h-5 w-5" />,
          primary: true,
        });
      } else {
        // Non-lactating female: Schedule AI
        steps.push({
          action: "schedule_ai",
          label: "Mag-iskedyul ng AI",
          sublabel: "Schedule AI",
          icon: <Syringe className="h-5 w-5" />,
          primary: true,
        });
      }
    } else {
      // Male: Record weight
      steps.push({
        action: "record_weight",
        label: "Itala ang Timbang",
        sublabel: "Record Weight",
        icon: <Scale className="h-5 w-5" />,
        primary: true,
      });
    }
    
    // Always add "Add Another" as secondary option
    steps.push({
      action: "add_another",
      label: "Magdagdag Pa",
      sublabel: "Add Another Animal",
      icon: <Plus className="h-5 w-5" />,
    });
    
    return steps;
  };
  
  const nextSteps = getNextSteps();
  const emoji = getLivestockEmoji(livestockType);
  const genderLabel = gender === "Female" ? "Babae / Female" : "Lalaki / Male";
  const displayName = name || earTag;
  
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-xl">
        <SheetHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-in zoom-in duration-300">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>
              <span className="absolute -bottom-1 -right-1 text-3xl">{emoji}</span>
            </div>
          </div>
          
          <SheetTitle className="text-xl">
            <span className="text-primary">Matagumpay!</span>
            <span className="text-muted-foreground text-sm ml-2">/ Success!</span>
          </SheetTitle>
          
          <p className="text-muted-foreground text-sm mt-1">
            Naidagdag ang hayop / Animal added successfully
          </p>
        </SheetHeader>
        
        {/* Animal Summary Card */}
        <div className="bg-muted/50 rounded-lg p-4 mb-6 border">
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
                    <Milk className="h-3 w-3" /> Nagpapasuso
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
        
        {/* Next Steps */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-center text-muted-foreground">
            Ano ang susunod? / What's next?
          </p>
          
          <div className="flex flex-col gap-2">
            {nextSteps.map((step) => (
              <Button
                key={step.action}
                variant={step.primary ? "default" : "outline"}
                size="lg"
                className={cn(
                  "w-full justify-start gap-3 h-14",
                  step.primary && "bg-primary hover:bg-primary/90"
                )}
                onClick={() => onAction(step.action)}
              >
                {step.icon}
                <div className="flex flex-col items-start">
                  <span className="font-medium">{step.label}</span>
                  <span className={cn(
                    "text-xs",
                    step.primary ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}>
                    {step.sublabel}
                  </span>
                </div>
              </Button>
            ))}
          </div>
          
          <Button
            variant="ghost"
            className="w-full text-muted-foreground mt-2"
            onClick={() => onAction("back_to_herd")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Bumalik sa Kawan / Back to Herd
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
