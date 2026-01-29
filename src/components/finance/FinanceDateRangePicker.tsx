import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DateRange {
  start: Date;
  end: Date;
}

export type DateRangePreset = 
  | "this_month" 
  | "last_month" 
  | "last_3_months" 
  | "last_6_months" 
  | "this_year" 
  | "custom";

interface FinanceDateRangePickerProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

const presets: { value: DateRangePreset; label: string; shortLabel: string }[] = [
  { value: "this_month", label: "This Month", shortLabel: "This Mo" },
  { value: "last_month", label: "Last Month", shortLabel: "Last Mo" },
  { value: "last_3_months", label: "Last 3 Months", shortLabel: "3M" },
  { value: "last_6_months", label: "Last 6 Months", shortLabel: "6M" },
  { value: "this_year", label: "Year to Date", shortLabel: "YTD" },
];

function getPresetRange(preset: DateRangePreset): DateRange {
  const now = new Date();
  
  switch (preset) {
    case "this_month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last_month":
      return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
    case "last_3_months":
      return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    case "last_6_months":
      return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
    case "this_year":
      return { start: startOfYear(now), end: endOfMonth(now) };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

function detectPreset(range: DateRange): DateRangePreset {
  const now = new Date();
  
  for (const preset of presets) {
    const presetRange = getPresetRange(preset.value);
    if (
      format(range.start, "yyyy-MM-dd") === format(presetRange.start, "yyyy-MM-dd") &&
      format(range.end, "yyyy-MM-dd") === format(presetRange.end, "yyyy-MM-dd")
    ) {
      return preset.value;
    }
  }
  
  return "custom";
}

export function FinanceDateRangePicker({ 
  dateRange, 
  onDateRangeChange 
}: FinanceDateRangePickerProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const activePreset = detectPreset(dateRange);

  const handlePresetClick = (preset: DateRangePreset) => {
    const newRange = getPresetRange(preset);
    onDateRangeChange(newRange);
  };

  const formatRangeLabel = () => {
    const startStr = format(dateRange.start, "MMM d");
    const endStr = format(dateRange.end, "MMM d, yyyy");
    return `${startStr} - ${endStr}`;
  };

  return (
    <div className="space-y-2">
      {/* Preset buttons - scrollable on mobile */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {presets.map((preset) => (
          <Button
            key={preset.value}
            variant={activePreset === preset.value ? "default" : "outline"}
            size="sm"
            className={cn(
              "shrink-0 text-xs h-8 px-2.5",
              activePreset === preset.value && "shadow-sm"
            )}
            onClick={() => handlePresetClick(preset.value)}
          >
            <span className="hidden sm:inline">{preset.label}</span>
            <span className="sm:hidden">{preset.shortLabel}</span>
          </Button>
        ))}
        
        {/* Custom date picker */}
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={activePreset === "custom" ? "default" : "outline"}
              size="sm"
              className={cn(
                "shrink-0 text-xs h-8 px-2.5 gap-1.5",
                activePreset === "custom" && "shadow-sm"
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Custom</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="p-3 border-b">
              <p className="text-sm font-medium">Select date range</p>
              <p className="text-xs text-muted-foreground">{formatRangeLabel()}</p>
            </div>
            <div className="flex flex-col sm:flex-row">
              <div className="p-2 border-b sm:border-b-0 sm:border-r">
                <p className="text-xs font-medium text-muted-foreground px-2 pb-1">Start</p>
                <Calendar
                  mode="single"
                  selected={dateRange.start}
                  onSelect={(date) => {
                    if (date) {
                      onDateRangeChange({
                        start: date,
                        end: date > dateRange.end ? date : dateRange.end,
                      });
                    }
                  }}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className="p-2 pointer-events-auto"
                />
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-muted-foreground px-2 pb-1">End</p>
                <Calendar
                  mode="single"
                  selected={dateRange.end}
                  onSelect={(date) => {
                    if (date) {
                      onDateRangeChange({
                        start: date < dateRange.start ? date : dateRange.start,
                        end: date,
                      });
                      setCustomOpen(false);
                    }
                  }}
                  disabled={(date) => date > new Date() || date < dateRange.start}
                  className="p-2 pointer-events-auto"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      {/* Current range display on mobile */}
      <div className="flex items-center justify-between text-xs text-muted-foreground sm:hidden">
        <span>Showing:</span>
        <span className="font-medium text-foreground">{formatRangeLabel()}</span>
      </div>
    </div>
  );
}

export { getPresetRange };
