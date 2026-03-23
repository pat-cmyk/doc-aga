import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRegionalStats } from "@/hooks/useRegionalStats";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";
import { DataCategory } from "@/types/government";
import { loadPhilippineRegionGeoJson } from "@/lib/philippineGeoJson";
import { REGIONAL_COORDINATES } from "@/lib/regionalCoordinates";

interface RegionalLivestockMapProps {
  dateRange?: { start: Date; end: Date };
  dataCategory?: DataCategory;
  region?: string;
  province?: string;
  onRegionSelect?: (region: string | undefined) => void;
}

const NATIONAL_CENTER: [number, number] = [122.5, 12.5];
const NATIONAL_ZOOM = 5.5;
const REGION_ZOOM = 7.5;

// Graduated color scale for choropleth (farm density)
const COLOR_STOPS = [
  [0, "#f0fdf4"],    // very light green — no farms
  [1, "#bbf7d0"],    // light green
  [3, "#86efac"],    // green
  [5, "#4ade80"],    // medium green
  [10, "#22c55e"],   // strong green
  [20, "#16a34a"],   // dark green
  [50, "#166534"],   // very dark green
];

const RegionalLivestockMap = ({
  dateRange,
  dataCategory = "live",
  region,
  province,
  onRegionSelect,
}: RegionalLivestockMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const { data: regionalStats, isLoading } = useRegionalStats(dataCategory);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [geoJsonLoaded, setGeoJsonLoaded] = useState(false);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  // Default date range
  const effectiveDateRange = dateRange || {
    start: subDays(new Date(), 90),
    end: new Date(),
  };

  // Resolve Mapbox token
  useEffect(() => {
    const envToken = (import.meta as any).env?.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;
    if (envToken) {
      setMapToken(envToken);
      return;
    }
    let cancelled = false;
    supabase.functions
      .invoke("mapbox-token")
      .then(({ data, error }) => {
        if (!cancelled) setMapToken(error ? null : (data?.token ?? null));
      })
      .catch(() => {
        if (!cancelled) setMapToken(null);
      });
    return () => { cancelled = true; };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current || !mapToken) return;
    mapboxgl.accessToken = mapToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: NATIONAL_CENTER,
      zoom: NATIONAL_ZOOM,
      pitch: 0,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      "top-right"
    );

    map.current.on("load", () => setMapLoaded(true));

    return () => {
      popupRef.current?.remove();
      map.current?.remove();
      map.current = null;
    };
  }, [mapToken]);

  // Load GeoJSON + add choropleth layers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    let cancelled = false;
    loadPhilippineRegionGeoJson()
      .then((geojson) => {
        if (cancelled || !map.current) return;
        // Add source if not already added
        if (!map.current.getSource("ph-regions")) {
          map.current.addSource("ph-regions", { type: "geojson", data: geojson });

          // Fill layer (choropleth)
          map.current.addLayer({
            id: "region-fill",
            type: "fill",
            source: "ph-regions",
            paint: {
              "fill-color": "#86efac",
              "fill-opacity": 0.3,
            },
          });

          // Border layer
          map.current.addLayer({
            id: "region-border",
            type: "line",
            source: "ph-regions",
            paint: {
              "line-color": "#166534",
              "line-width": 1.5,
              "line-opacity": 0.7,
            },
          });

          // Hover highlight layer
          map.current.addLayer({
            id: "region-hover",
            type: "fill",
            source: "ph-regions",
            paint: {
              "fill-color": "#22c55e",
              "fill-opacity": 0,
            },
          });

          // Click handler → update geography selector
          map.current.on("click", "region-fill", (e) => {
            if (e.features && e.features[0]) {
              const clickedRegion = e.features[0].properties?.name;
              if (clickedRegion && onRegionSelect) {
                // Toggle: click same region = deselect (back to national)
                onRegionSelect(clickedRegion === region ? undefined : clickedRegion);
              }
            }
          });

          // Hover effects
          map.current.on("mouseenter", "region-fill", (e) => {
            if (map.current) map.current.getCanvas().style.cursor = "pointer";
            if (e.features && e.features[0]) {
              const name = e.features[0].properties?.name;
              if (name) {
                map.current?.setPaintProperty("region-hover", "fill-opacity", [
                  "case", ["==", ["get", "name"], name], 0.15, 0
                ]);

                // Show popup
                const coords = e.lngLat;
                if (popupRef.current) popupRef.current.remove();
                popupRef.current = new mapboxgl.Popup({
                  closeButton: false,
                  closeOnClick: false,
                  className: "rounded-lg",
                  offset: 10,
                })
                  .setLngLat(coords)
                  .setHTML(`<div class="p-2 text-sm font-semibold">${name}</div>`)
                  .addTo(map.current!);
              }
            }
          });

          map.current.on("mouseleave", "region-fill", () => {
            if (map.current) {
              map.current.getCanvas().style.cursor = "";
              map.current.setPaintProperty("region-hover", "fill-opacity", 0);
            }
            popupRef.current?.remove();
          });
        }
        setGeoJsonLoaded(true);
      })
      .catch((err) => console.error("[RegionalLivestockMap] GeoJSON load error:", err));

    return () => { cancelled = true; };
  }, [mapLoaded]);

  // Update choropleth colors based on regional stats
  useEffect(() => {
    if (!map.current || !geoJsonLoaded || !regionalStats) return;

    // Build a match expression: region name → color
    const statsMap = new Map(regionalStats.map((r) => [r.region, r.farm_count]));
    const matchExpr: any[] = ["match", ["get", "name"]];

    for (const [regionName, farmCount] of statsMap) {
      // Find the right color stop
      let color = COLOR_STOPS[0][1];
      for (const [threshold, c] of COLOR_STOPS) {
        if (farmCount >= (threshold as number)) color = c;
      }
      matchExpr.push(regionName, color as string);
    }
    matchExpr.push("#f0fdf4"); // default

    map.current.setPaintProperty("region-fill", "fill-color", matchExpr);
  }, [regionalStats, geoJsonLoaded]);

  // Update selected region highlight
  useEffect(() => {
    if (!map.current || !geoJsonLoaded) return;

    if (region) {
      // Highlight selected region, dim others
      map.current.setPaintProperty("region-fill", "fill-opacity", [
        "case", ["==", ["get", "name"], region], 0.6, 0.15,
      ]);
      map.current.setPaintProperty("region-border", "line-width", [
        "case", ["==", ["get", "name"], region], 3, 1,
      ]);
      map.current.setPaintProperty("region-border", "line-opacity", [
        "case", ["==", ["get", "name"], region], 1, 0.4,
      ]);
    } else {
      // National view: all regions visible
      map.current.setPaintProperty("region-fill", "fill-opacity", 0.3);
      map.current.setPaintProperty("region-border", "line-width", 1.5);
      map.current.setPaintProperty("region-border", "line-opacity", 0.7);
    }
  }, [region, geoJsonLoaded]);

  // Fly to region on selection change
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    map.current.stop(); // cancel any in-flight animation

    if (region) {
      const coords = REGIONAL_COORDINATES[region];
      if (coords) {
        map.current.flyTo({
          center: [coords.lng, coords.lat],
          zoom: REGION_ZOOM,
          duration: 1200,
        });
      }
    } else {
      map.current.flyTo({
        center: NATIONAL_CENTER,
        zoom: NATIONAL_ZOOM,
        duration: 1200,
      });
    }
  }, [region, mapLoaded]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {region ? `${region} — Livestock Distribution` : "National Livestock Distribution"}
        </CardTitle>
        <CardDescription>
          {region
            ? "Click the highlighted region again to return to national view."
            : "Click a region to filter all dashboard data to that area."}
        </CardDescription>
      </CardHeader>
      <CardContent className="relative">
        <div ref={mapContainer} className="w-full h-[450px] rounded-lg shadow-sm" />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
            <Skeleton className="w-full h-full rounded-lg" />
          </div>
        )}

        {/* Legend */}
        {!isLoading && regionalStats && regionalStats.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="font-medium">Farm density:</span>
            {[
              { color: "#bbf7d0", label: "Low" },
              { color: "#4ade80", label: "Medium" },
              { color: "#166534", label: "High" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: color }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RegionalLivestockMap;
