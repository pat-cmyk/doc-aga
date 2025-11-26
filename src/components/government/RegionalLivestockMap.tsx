import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRegionalStats } from "@/hooks/useRegionalStats";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import RegionalDetailPanel from "./RegionalDetailPanel";
import { subDays } from "date-fns";

interface RegionalLivestockMapProps {
  dateRange?: { start: Date; end: Date };
}

const RegionalLivestockMap = ({ dateRange }: RegionalLivestockMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const { data: regionalStats, isLoading } = useRegionalStats();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [mapToken, setMapToken] = useState<string | null>(null);

  // Default to last 90 days if no date range provided
  const effectiveDateRange = dateRange || {
    start: subDays(new Date(), 90),
    end: new Date(),
  };

  // Resolve Mapbox token from env or backend function
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
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapContainer.current || map.current || !mapToken) return;

    // Initialize map centered on Philippines
    mapboxgl.accessToken = mapToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [122.5, 12.5], // Center of Philippines
      zoom: 5.5,
      pitch: 0,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      "top-right"
    );

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    // Cleanup
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      map.current?.remove();
      map.current = null;
    };
  }, [mapToken]);

  const handleRegionClick = (regionName: string) => {
    setSelectedRegion(regionName);
    setIsPanelOpen(true);
  };

  const handlePanelClose = () => {
    setIsPanelOpen(false);
    setSelectedRegion(null);
  };

  // Add markers when data is loaded
  useEffect(() => {
    if (!map.current || !mapLoaded || !regionalStats) return;

    // Remove existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add new markers for each region
    regionalStats.forEach((region) => {
      if (!region.avg_gps_lat || !region.avg_gps_lng) return;

      // Create simplified popup content for hover
      const popupContent = `
        <div class="p-2 min-w-[180px]">
          <h3 class="font-semibold text-sm mb-1">${region.region}</h3>
          <p class="text-xs text-muted-foreground">Click for detailed statistics</p>
        </div>
      `;

      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        className: "rounded-lg",
      }).setHTML(popupContent);

      // Create custom marker element with size based on farm count
      const el = document.createElement("div");
      const size = Math.min(40, 20 + region.farm_count * 2);
      el.className = "custom-marker";
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.backgroundImage = `radial-gradient(circle, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.6) 100%)`;
      el.style.borderRadius = "50%";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
      el.style.cursor = "pointer";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.fontWeight = "600";
      el.style.fontSize = "11px";
      el.style.color = "white";
      el.style.transition = "transform 0.2s, box-shadow 0.2s";
      el.textContent = region.farm_count.toString();
      el.setAttribute("aria-label", `View detailed statistics for ${region.region}`);
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");

      // Add active state styling
      const updateActiveState = () => {
        if (selectedRegion === region.region) {
          el.style.border = "3px solid hsl(var(--primary))";
          el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)";
        } else {
          el.style.border = "2px solid white";
          el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
        }
      };
      updateActiveState();

      const marker = new mapboxgl.Marker(el)
        .setLngLat([region.avg_gps_lng, region.avg_gps_lat])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.push(marker);

      // Hover effects
      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.1)";
        marker.togglePopup();
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
        marker.togglePopup();
      });

      // Click handler
      el.addEventListener("click", () => {
        handleRegionClick(region.region);
      });

      // Keyboard accessibility
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleRegionClick(region.region);
        }
      });
    });
  }, [regionalStats, mapLoaded, selectedRegion]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Regional Livestock Distribution</CardTitle>
          <CardDescription>
            Interactive map showing livestock statistics across Philippine regions. Click markers for detailed analytics.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative">
          {/* Map container - always rendered */}
          <div ref={mapContainer} className="w-full h-[500px] rounded-lg shadow-sm" />
          
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
              <Skeleton className="w-full h-full rounded-lg" />
            </div>
          )}
          
          {/* Map legend */}
          {!isLoading && regionalStats && regionalStats.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-primary" />
                <span className="text-muted-foreground">
                  Marker size represents number of farms in region
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <RegionalDetailPanel
        region={selectedRegion}
        isOpen={isPanelOpen}
        onClose={handlePanelClose}
        dateRange={effectiveDateRange}
      />
    </>
  );
};

export default RegionalLivestockMap;
