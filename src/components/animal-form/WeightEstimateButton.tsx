import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Calculator, Gauge } from "lucide-react";
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
  0: "Newborn",
  6: "6 months",
  12: "1 year",
  24: "2 years",
  36: "3 years",
  48: "4 years",
  60: "5 years",
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
      title: "Weight Estimated",
      description: `~${estimated} kg for ${ageInMonths}-month ${gender?.toLowerCase() || ""} ${livestockType}`,
    });
  };

  // Handle estimation from age slider
  const handleSliderEstimate = () => {
    const estimated = getEstimatedWeight(ageMonths);
    onEstimate(estimated);
    setOpen(false);
    
    toast({
      title: "Weight Estimated",
      description: `~${estimated} kg based on ${ageMonths} months age`,
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
      title: "Weight Estimated",
      description: `Typical birth weight: ~${estimated} kg for ${livestockType}`,
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
        className="gap-1.5 text-xs h-8 min-h-[32px]"
      >
        <Calculator className="h-3.5 w-3.5" />
        <div className="flex flex-col items-start leading-tight">
          <span className="font-medium">Estimate</span>
          <span className="text-[10px] text-muted-foreground">Tantiya</span>
        </div>
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
        className="gap-1.5 text-xs h-8 min-h-[32px]"
      >
        <Calculator className="h-3.5 w-3.5" />
        <div className="flex flex-col items-start leading-tight">
          <span className="font-medium">Estimate</span>
          <span className="text-[10px] text-muted-foreground">Tantiya</span>
        </div>
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
          className="gap-1.5 text-xs h-8 min-h-[32px]"
        >
          <Calculator className="h-3.5 w-3.5" />
          <div className="flex flex-col items-start leading-tight">
            <span className="font-medium">Estimate</span>
            <span className="text-[10px] text-muted-foreground">Tantiya</span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="text-center pb-3 border-b">
            <div className="flex items-center justify-center gap-2">
              <Gauge className="h-5 w-5 text-primary" />
              <div className="flex flex-col">
                <h4 className="font-bold text-base text-primary">Weight Estimator</h4>
                <span className="text-xs text-muted-foreground">Tantiya-Meter</span>
              </div>
              <Gauge className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col gap-0.5 mt-2">
              <p className="text-sm text-foreground">How old is the animal?</p>
              <p className="text-xs text-muted-foreground">Ilang buwan ang hayop?</p>
            </div>
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
                {ageMonths} months ({Math.floor(ageMonths / 12)} yrs {ageMonths % 12} mo)
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
                  className="text-xs h-8 px-2 min-h-[32px]"
                >
                  {age === 0 ? "New" : age < 12 ? `${age}m` : `${age / 12}y`}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  Estimate: ~{getEstimatedWeight(ageMonths)} kg
                </p>
                <p className="text-xs text-muted-foreground">
                  {gender || "Female"} {livestockType}, {ageMonths} months
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleSliderEstimate}
                className="h-10 min-h-[40px]"
              >
                <div className="flex flex-col items-center leading-tight">
                  <span>Use</span>
                  <span className="text-xs opacity-80">Gamitin</span>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
