import { useLocationFilters } from "@/hooks/useLocationFilters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Globe, MapPin, ChevronRight, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type DatePreset = "last7Days" | "last30Days" | "last90Days" | "custom";

interface GeographySelectorProps {
  region: string | undefined;
  province: string | undefined;
  municipality: string | undefined;
  onRegionChange: (value: string | undefined) => void;
  onProvinceChange: (value: string | undefined) => void;
  onMunicipalityChange: (value: string | undefined) => void;
  datePreset?: DatePreset;
  onDatePresetChange?: (preset: DatePreset) => void;
  dateRange?: { start: Date; end: Date };
  onDateRangeChange?: (range: { start: Date; end: Date }) => void;
}

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "last7Days", label: "7d" },
  { value: "last30Days", label: "30d" },
  { value: "last90Days", label: "90d" },
];

export const GeographySelector = ({
  region,
  province,
  municipality,
  onRegionChange,
  onProvinceChange,
  onMunicipalityChange,
  datePreset,
  onDatePresetChange,
  dateRange,
  onDateRangeChange,
}: GeographySelectorProps) => {
  const { getRegions, getProvinces, getMunicipalities } = useLocationFilters();
  const regions = getRegions();
  const provinces = region ? getProvinces(region) : [];
  const municipalities = region && province ? getMunicipalities(region, province) : [];

  const showDateControls = datePreset !== undefined && onDatePresetChange;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />

      {/* Geography breadcrumb trail */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* National button */}
        <Button
          variant={!region ? "default" : "ghost"}
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => onRegionChange(undefined)}
        >
          <Globe className="h-3.5 w-3.5" />
          National
        </Button>

        {/* Region dropdown */}
        {region && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <Select
          value={region || "__none__"}
          onValueChange={(v) => onRegionChange(v === "__none__" ? undefined : v)}
        >
          <SelectTrigger className="h-7 w-auto min-w-[140px] text-xs gap-1 border-dashed">
            <SelectValue placeholder="Select Region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">All Regions</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Province dropdown (cascades from region) */}
        {region && provinces.length > 0 && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Select
              value={province || "__none__"}
              onValueChange={(v) => onProvinceChange(v === "__none__" ? undefined : v)}
            >
              <SelectTrigger className="h-7 w-auto min-w-[130px] text-xs gap-1 border-dashed">
                <SelectValue placeholder="All Provinces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">All Provinces</SelectItem>
                {provinces.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        {/* Municipality dropdown (cascades from province) */}
        {province && municipalities.length > 0 && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Select
              value={municipality || "__none__"}
              onValueChange={(v) => onMunicipalityChange(v === "__none__" ? undefined : v)}
            >
              <SelectTrigger className="h-7 w-auto min-w-[130px] text-xs gap-1 border-dashed">
                <SelectValue placeholder="All Municipalities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">All Municipalities</SelectItem>
                {municipalities.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {/* Date controls — shown when date props are provided */}
      {showDateControls && (
        <>
          {/* Vertical separator */}
          <div className="h-5 w-px bg-border shrink-0 hidden sm:block" />

          <div className="flex flex-wrap items-center gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

            {/* Preset buttons */}
            <div className="flex items-center rounded-md border bg-muted/50 p-0.5">
              {PRESETS.map((p) => (
                <Button
                  key={p.value}
                  variant={datePreset === p.value ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-6 px-2.5 text-xs rounded-sm",
                    datePreset === p.value && "shadow-sm"
                  )}
                  onClick={() => onDatePresetChange(p.value)}
                >
                  {p.label}
                </Button>
              ))}
              <Button
                variant={datePreset === "custom" ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-6 px-2.5 text-xs rounded-sm",
                  datePreset === "custom" && "shadow-sm"
                )}
                onClick={() => onDatePresetChange("custom")}
              >
                Custom
              </Button>
            </div>

            {/* Custom date pickers */}
            {datePreset === "custom" && dateRange && onDateRangeChange && (
              <div className="flex items-center gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs font-normal"
                    >
                      {format(dateRange.start, "MMM d")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.start}
                      onSelect={(date) =>
                        date && onDateRangeChange({ ...dateRange, start: date })
                      }
                      disabled={(date) => date > dateRange.end}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-[10px] text-muted-foreground">–</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs font-normal"
                    >
                      {format(dateRange.end, "MMM d")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.end}
                      onSelect={(date) =>
                        date && onDateRangeChange({ ...dateRange, end: date })
                      }
                      disabled={(date) => date < dateRange.start}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Date range summary for non-custom presets */}
            {datePreset !== "custom" && dateRange && (
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                {format(dateRange.start, "MMM d")} – {format(dateRange.end, "MMM d")}
              </span>
            )}
          </div>
        </>
      )}

      {/* Active filter badge */}
      {region && (
        <Badge variant="secondary" className="ml-auto h-6 text-xs shrink-0">
          {region}{province ? ` / ${province}` : ""}{municipality ? ` / ${municipality}` : ""}
        </Badge>
      )}
    </div>
  );
};
