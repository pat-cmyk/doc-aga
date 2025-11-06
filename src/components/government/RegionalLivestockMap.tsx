import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRegionalStats } from "@/hooks/useRegionalStats";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

const RegionalLivestockMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const { data: regionalStats, isLoading } = useRegionalStats();
  const [mapLoaded, setMapLoaded] = useState(false);

  const [mapToken, setMapToken] = useState<string | null>(null);

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

  // Add markers when data is loaded
  useEffect(() => {
    if (!map.current || !mapLoaded || !regionalStats) return;

    // Remove existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add new markers for each region
    regionalStats.forEach((region) => {
      if (!region.avg_gps_lat || !region.avg_gps_lng) return;

      // Create popup content
      const popupContent = `
        <div class="p-3 min-w-[200px]">
          <h3 class="font-semibold text-base mb-2">${region.region}</h3>
          <div class="space-y-1 text-sm">
            <p class="flex justify-between">
              <span class="text-muted-foreground">Farms:</span>
              <span class="font-medium">${region.farm_count}</span>
            </p>
            <p class="flex justify-between">
              <span class="text-muted-foreground">Animals:</span>
              <span class="font-medium">${region.active_animal_count.toLocaleString()}</span>
            </p>
            <p class="flex justify-between">
              <span class="text-muted-foreground">Health Events (7d):</span>
              <span class="font-medium">${region.health_events_7d}</span>
            </p>
          </div>
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
      el.textContent = region.farm_count.toString();

      const marker = new mapboxgl.Marker(el)
        .setLngLat([region.avg_gps_lng, region.avg_gps_lat])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.push(marker);

      // Show popup on hover
      el.addEventListener("mouseenter", () => {
        marker.togglePopup();
      });
      el.addEventListener("mouseleave", () => {
        marker.togglePopup();
      });
    });
  }, [regionalStats, mapLoaded]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Regional Livestock Distribution</CardTitle>
          <CardDescription>Interactive map showing livestock statistics across Philippine regions</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full h-[500px] rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Regional Livestock Distribution</CardTitle>
        <CardDescription>
          Interactive map showing livestock statistics across Philippine regions. Hover over markers for details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={mapContainer} className="w-full h-[500px] rounded-lg shadow-sm" />
        {regionalStats && regionalStats.length > 0 && (
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
  );
};

export default RegionalLivestockMap;
