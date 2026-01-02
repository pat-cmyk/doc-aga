import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Calculator } from "lucide-react";
import { estimateWeightByAge } from "@/lib/weightEstimates";
import { useToast } from "@/hooks/use-toast";

interface WeightEstimateButtonProps {
  livestockType: string;
  gender: string;
  birthDate?: string | null;
  onEstimate: (estimatedWeight: number) => void;
  disabled?: boolean;
  weightType?: "entry" | "birth";
}

// Age labels for the slider
const AGE_LABELS: { [key: number]: string } = {
  0: "Bagong silang",
  6: "6 buwan",
  12: "1 taon",
  24: "2 taon",
  36: "3 taon",
  48: "4 taon",
  60: "5 taon",
};

export function WeightEstimateButton({
  livestockType,
  gender,
  birthDate,
  onEstimate,
  disabled = false,
  weightType = "entry",
}: WeightEstimateButtonProps) {
  const [open, setOpen] = useState(false);
  const [ageMonths, setAgeMonths] = useState(24);
  const { toast } = useToast();

  // Calculate weight based on age slider value
  const getEstimatedWeight = (months: number): number => {
    const estimatedDate = new Date();
    estimatedDate.setMonth(estimatedDate.getMonth() - months);
    
    return estimateWeightByAge({
      birthDate: estimatedDate,
      gender: gender || "Female",
      livestockType,
    });
  };

  // Handle direct estimation when birth date is known
  const handleDirectEstimate = () => {
    if (!birthDate) return;
    
    const estimated = estimateWeightByAge({
      birthDate: new Date(birthDate),
      gender: gender || "Female",
      livestockType,
    });
    
    onEstimate(estimated);
    
    const ageInMonths = Math.floor(
      (new Date().getTime() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    
    toast({
      title: "Tantiya ng Timbang / Weight Estimated",
      description: `~${estimated} kg para sa ${ageInMonths}-buwan na ${gender?.toLowerCase() || ""} ${livestockType}`,
    });
  };

  // Handle estimation from age slider
  const handleSliderEstimate = () => {
    const estimated = getEstimatedWeight(ageMonths);
    onEstimate(estimated);
    setOpen(false);
    
    toast({
      title: "Tantiya ng Timbang / Weight Estimated",
      description: `~${estimated} kg batay sa ${ageMonths} buwan na edad`,
    });
  };

  // For birth weight, we just need a simple estimate based on livestock type
  const handleBirthWeightEstimate = () => {
    const birthWeights: { [key: string]: number } = {
      cattle: 35,
      goat: 3,
      sheep: 4,
      carabao: 30,
    };
    
    const estimated = birthWeights[livestockType] || 35;
    onEstimate(estimated);
    
    toast({
      title: "Tantiya ng Timbang / Weight Estimated",
      description: `Karaniwang birth weight: ~${estimated} kg para sa ${livestockType}`,
    });
  };

  // Birth weight estimation is simple - just click
  if (weightType === "birth") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleBirthWeightEstimate}
        disabled={disabled}
        className="gap-1.5 text-xs h-7"
      >
        <Calculator className="h-3.5 w-3.5" />
        <span>Tantiya / Estimate</span>
      </Button>
    );
  }

  // If birth date is known, direct estimation
  if (birthDate) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleDirectEstimate}
        disabled={disabled || !gender}
        className="gap-1.5 text-xs h-7"
      >
        <Calculator className="h-3.5 w-3.5" />
        <span>Tantiya / Estimate</span>
      </Button>
    );
  }

  // No birth date - show popover with age slider
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !gender}
          className="gap-1.5 text-xs h-7"
        >
          <Calculator className="h-3.5 w-3.5" />
          <span>Tantiya / Estimate</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm">Ilang buwan ang hayop?</h4>
            <p className="text-xs text-muted-foreground">How old is the animal?</p>
          </div>
          
          <div className="space-y-3">
            <Slider
              value={[ageMonths]}
              onValueChange={(value) => setAgeMonths(value[0])}
              min={0}
              max={60}
              step={1}
              className="w-full"
            />
            
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span className="font-medium text-foreground">
                {ageMonths} {ageMonths === 1 ? "buwan" : "buwan"} ({Math.floor(ageMonths / 12)} taon {ageMonths % 12} buwan)
              </span>
              <span>60</span>
            </div>
            
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[0, 6, 12, 18, 24, 36, 48].map((age) => (
                <Button
                  key={age}
                  type="button"
                  variant={ageMonths === age ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAgeMonths(age)}
                  className="text-xs h-6 px-2"
                >
                  {age === 0 ? "Bago" : age < 12 ? `${age}b` : `${age / 12}t`}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  Tantiya: ~{getEstimatedWeight(ageMonths)} kg
                </p>
                <p className="text-xs text-muted-foreground">
                  {gender || "Female"} {livestockType}, {ageMonths} buwan
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleSliderEstimate}
              >
                Gamitin
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
