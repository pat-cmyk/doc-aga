/**
 * Lazy loader for Philippine admin region GeoJSON boundaries.
 * Fetched once on first use, then cached in memory.
 * The static file at /data/ph-regions.geojson is also cached
 * by the service worker for offline access.
 */

let cached: GeoJSON.FeatureCollection | null = null;

export async function loadPhilippineRegionGeoJson(): Promise<GeoJSON.FeatureCollection> {
  if (cached) return cached;
  const res = await fetch('/data/ph-regions.geojson');
  if (!res.ok) throw new Error(`Failed to load region GeoJSON: ${res.status}`);
  cached = await res.json();
  return cached!;
}

/**
 * Map GADM/PSA region names to the project's naming convention
 * (matching REGIONAL_COORDINATES keys and PHILIPPINE_LOCATIONS keys).
 */
export const GADM_TO_PROJECT_REGION: Record<string, string> = {
  "National Capital Region": "NCR",
  "Cordillera Administrative Region": "CAR",
  "Ilocos Region": "Region I",
  "Cagayan Valley": "Region II",
  "Central Luzon": "Region III",
  "Calabarzon": "Region IV-A",
  "Mimaropa": "Region IV-B",
  "MIMAROPA": "Region IV-B",
  "Bicol Region": "Region V",
  "Western Visayas": "Region VI",
  "Central Visayas": "Region VII",
  "Eastern Visayas": "Region VIII",
  "Zamboanga Peninsula": "Region IX",
  "Northern Mindanao": "Region X",
  "Davao Region": "Region XI",
  "Soccsksargen": "Region XII",
  "Caraga": "Region XIII",
  "Bangsamoro Autonomous Region in Muslim Mindanao": "BARMM",
  "Autonomous Region in Muslim Mindanao": "BARMM",
};

/**
 * Normalize a GeoJSON feature's region name to the project convention.
 */
export function normalizeRegionName(gadmName: string): string {
  return GADM_TO_PROJECT_REGION[gadmName] || gadmName;
}
