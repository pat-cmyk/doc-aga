import { useState, useEffect, useMemo } from "react";
import { format, subDays } from "date-fns";
import { Scale, CalendarIcon, WifiOff, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useFarmAnimals, getAnimalDropdownOptions, getSelectedAnimals, FarmAnimal } from "@/hooks/useFarmAnimals";
import { AnimalCombobox } from "@/components/milk-recording/AnimalCombobox";
import { BCS_LEVELS } from "@/lib/bcsDefinitions";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { hapticSelection, hapticNotification } from "@/lib/haptics";
import { BCSReferenceGuide } from "./BCSReferenceGuide";
import { ResponsiveBCSContainer } from "./ResponsiveBCSContainer";

interface RecordBulkBCSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string | null;
}

// Quick score buttons for common BCS values
const QUICK_SCORES = [
  { score: 2.0, label: "2.0" },
  { score: 2.5, label: "2.5" },
  { score: 3.0, label: "3.0" },
  { score: 3.5, label: "3.5" },
  { score: 4.0, label: "4.0" },
];

// Get BCS status color
function getBCSStatusColor(score: number): string {
  if (score < 2.0) return "text-destructive";
  if (score < 2.5) return "text-yellow-600";
  if (score <= 3.5) return "text-green-600";
  if (score <= 4.0) return "text-yellow-600";
  return "text-destructive";
}

function getBCSBgColor(score: number): string {
  if (score < 2.0) return "bg-destructive/10";
  if (score < 2.5) return "bg-yellow-100";
  if (score <= 3.5) return "bg-green-100";
  if (score <= 4.0) return "bg-yellow-100";
  return "bg-destructive/10";
}

export function RecordBulkBCSDialog({
  open,
  onOpenChange,
  farmId,
}: RecordBulkBCSDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  // Form state
  const [selectedOption, setSelectedOption] = useState("");
  const [score, setScore] = useState(3.0);
  const [recordDate, setRecordDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cachedAnimals, setCachedAnimals] = useState<FarmAnimal[]>([]);
  const [showGuide, setShowGuide] = useState(true);

  // Fetch animals
  const { data: animals = [], isLoading: animalsLoading } = useFarmAnimals(farmId);

  // Local storage key for cached animals
  const cacheKey = `bcs-animals-${farmId}`;

  // Cache animals for offline use
  useEffect(() => {
    if (animals.length > 0 && farmId) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(animals));
      } catch (e) {
        console.warn("Failed to cache animals:", e);
      }
    }
  }, [animals, farmId, cacheKey]);

  // Load cached animals when offline
  useEffect(() => {
    if (!isOnline && farmId) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setCachedAnimals(JSON.parse(cached));
        }
      } catch (e) {
        console.warn("Failed to load cached animals:", e);
      }
    }
  }, [isOnline, farmId, cacheKey]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedOption("");
      setScore(3.0);
      setRecordDate(new Date());
      setNotes("");
    } else {
      hapticNotification("warning");
    }
  }, [open]);

  // Use online animals or cached
  const displayAnimals = isOnline ? animals : cachedAnimals;
  const dropdownOptions = useMemo(
    () => getAnimalDropdownOptions(displayAnimals),
    [displayAnimals]
  );
  const selectedAnimals = useMemo(
    () => getSelectedAnimals(displayAnimals, selectedOption),
    [displayAnimals, selectedOption]
  );

  // Get current BCS level info
  const currentLevel = useMemo(() => {
    return BCS_LEVELS.find((l) => l.score === score) || 
           BCS_LEVELS.reduce((prev, curr) => 
             Math.abs(curr.score - score) < Math.abs(prev.score - score) ? curr : prev
           );
  }, [score]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      hapticSelection();
      setRecordDate(date);
    }
  };

  const handleScoreChange = (values: number[]) => {
    setScore(values[0]);
  };

  const handleQuickScore = (newScore: number) => {
    hapticSelection();
    setScore(newScore);
  };

  const handleAnimalChange = (value: string) => {
    setSelectedOption(value);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!farmId || selectedAnimals.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one animal.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const assessmentDate = format(recordDate, "yyyy-MM-dd");

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const bcsRecords = selectedAnimals.map((animal) => ({
        animal_id: animal.id,
        farm_id: farmId,
        score,
        assessment_date: assessmentDate,
        assessor_id: userId,
        notes: notes || null,
      }));

      if (!isOnline) {
        // Store offline records in local storage for later sync
        const offlineKey = `offline-bcs-${Date.now()}`;
        localStorage.setItem(offlineKey, JSON.stringify({
          records: bcsRecords,
          createdAt: new Date().toISOString(),
        }));

        hapticNotification("success");
        toast({
          title: "Saved Offline",
          description: `${selectedAnimals.length} BCS record(s) saved. Will sync when online.`,
        });
        handleClose();
        return;
      }

      // Online submission
      const { error } = await supabase.from("body_condition_scores").insert(bcsRecords);

      if (error) throw error;

      hapticNotification("success");
      
      // Invalidate relevant queries
      await queryClient.invalidateQueries({ queryKey: ["bcs-records"] });
      selectedAnimals.forEach((animal) => {
        queryClient.invalidateQueries({ queryKey: ["bcs-records", animal.id] });
      });

      toast({
        title: "BCS Recorded",
        description: `Saved ${selectedAnimals.length} body condition score(s).`,
      });

      handleClose();
    } catch (error) {
      hapticNotification("error");
      console.error("Failed to record BCS:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to record BCS.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const minDate = subDays(new Date(), 7);
  const maxDate = new Date();

  const dialogTitle = (
    <span className="flex items-center gap-2">
      <Scale className="h-5 w-5 text-primary" />
      Record Body Condition
      {!isOnline && (
        <Badge variant="secondary" className="ml-2">
          <WifiOff className="h-3 w-3 mr-1" />
          Offline
        </Badge>
      )}
    </span>
  );

  const dialogFooter = (
    <div className="flex gap-3 w-full">
      <Button
        variant="outline"
        onClick={handleClose}
        disabled={isSubmitting}
        className="flex-1 min-h-[48px]"
      >
        Cancel
      </Button>
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || selectedAnimals.length === 0}
        className="flex-1 min-h-[48px]"
      >
        {isSubmitting
          ? "Saving..."
          : isOnline
          ? "Record BCS"
          : "Queue for Sync"}
      </Button>
    </div>
  );

  return (
    <ResponsiveBCSContainer
      open={open}
      onOpenChange={onOpenChange}
      title={dialogTitle}
      description="Score animals and track their body condition over time."
      footer={dialogFooter}
    >
      <div className="space-y-5 pb-4">
        {/* Date Selection */}
        <div className="space-y-2">
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal min-h-[48px]",
                  !recordDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {recordDate ? format(recordDate, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={recordDate}
                onSelect={handleDateSelect}
                disabled={(date) => date < minDate || date > maxDate}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Animal Selection */}
        <div className="space-y-2">
          <Label>Select Animals</Label>
          <AnimalCombobox
            options={dropdownOptions}
            value={selectedOption}
            onChange={handleAnimalChange}
            placeholder="Search or select animals..."
            disabled={animalsLoading && isOnline}
          />
        </div>

        <Separator />

        {/* Score Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Body Condition Score</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                hapticSelection();
                setShowGuide(!showGuide);
              }}
              className="gap-1.5 text-xs h-8 px-2"
            >
              <BookOpen className="h-4 w-4" />
              {showGuide ? "Hide Guide" : "Show Guide"}
              {showGuide ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>

          {/* Visual BCS Reference Guide */}
          <Collapsible open={showGuide} onOpenChange={setShowGuide}>
            <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
              <BCSReferenceGuide
                selectedScore={score}
                onScoreSelect={handleQuickScore}
                compact
              />
              <div className="h-3" />
            </CollapsibleContent>
          </Collapsible>

          {/* Quick Score Buttons */}
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Quick Select:</span>
            <div className="grid grid-cols-5 gap-2">
              {QUICK_SCORES.map(({ score: s, label }) => (
                <Button
                  key={s}
                  variant={score === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleQuickScore(s)}
                  className="h-10"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Slider */}
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Fine Tune:</span>
            <div className="px-1">
              <Slider
                value={[score]}
                onValueChange={handleScoreChange}
                min={1}
                max={5}
                step={0.5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1.0</span>
                <span>3.0</span>
                <span>5.0</span>
              </div>
            </div>
          </div>

          {/* Score Display Card */}
          <div
            className={cn(
              "rounded-lg p-3 text-center transition-colors",
              getBCSBgColor(score)
            )}
          >
            <div className="flex items-center justify-center gap-3">
              <div className={cn("text-3xl font-bold", getBCSStatusColor(score))}>
                {score.toFixed(1)}
              </div>
              <div className="text-left">
                <div className={cn("text-base font-medium", getBCSStatusColor(score))}>
                  {currentLevel.label}
                </div>
                <div className="text-xs text-muted-foreground">
                  {currentLevel.labelTagalog}
                </div>
              </div>
            </div>
          </div>

          {/* Indicators */}
          <div className="bg-muted/50 rounded-lg p-2.5 space-y-0.5">
            {currentLevel.indicators.slice(0, 3).map((indicator, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <span className="text-muted-foreground">•</span>
                <span>{indicator}</span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Animals Preview */}
        {selectedAnimals.length > 0 && (
          <div className="space-y-2">
            <Label className="flex items-center justify-between">
              <span>Animals to Score</span>
              <Badge variant="secondary">{selectedAnimals.length}</Badge>
            </Label>
            <div className="bg-muted/30 rounded-lg max-h-32 overflow-y-auto">
              {selectedAnimals.slice(0, 10).map((animal) => (
                <div
                  key={animal.id}
                  className="flex items-center justify-between px-3 py-2 text-sm border-b last:border-0"
                >
                  <span className="font-medium">
                    {animal.name || animal.ear_tag || "Unnamed"}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", getBCSStatusColor(score))}
                  >
                    → {score.toFixed(1)}
                  </Badge>
                </div>
              ))}
              {selectedAnimals.length > 10 && (
                <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                  +{selectedAnimals.length - 10} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <Label>Notes (Optional)</Label>
          <Textarea
            placeholder="Additional observations..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="resize-none"
          />
        </div>
      </div>
    </ResponsiveBCSContainer>
  );
}
