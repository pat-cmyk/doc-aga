import { useLocationFilters } from "@/hooks/useLocationFilters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, MapPin, ChevronRight } from "lucide-react";

interface GeographySelectorProps {
  region: string | undefined;
  province: string | undefined;
  municipality: string | undefined;
  onRegionChange: (value: string | undefined) => void;
  onProvinceChange: (value: string | undefined) => void;
  onMunicipalityChange: (value: string | undefined) => void;
}

export const GeographySelector = ({
  region,
  province,
  municipality,
  onRegionChange,
  onProvinceChange,
  onMunicipalityChange,
}: GeographySelectorProps) => {
  const { getRegions, getProvinces, getMunicipalities } = useLocationFilters();
  const regions = getRegions();
  const provinces = region ? getProvinces(region) : [];
  const municipalities = region && province ? getMunicipalities(region, province) : [];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />

      {/* Breadcrumb trail */}
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

      {/* Active filter badge */}
      {region && (
        <Badge variant="secondary" className="ml-auto h-6 text-xs shrink-0">
          {region}{province ? ` / ${province}` : ""}{municipality ? ` / ${municipality}` : ""}
        </Badge>
      )}
    </div>
  );
};
