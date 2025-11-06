// Default GPS coordinates for Philippine regions (approximate center points)
export const REGIONAL_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "NCR": { lat: 14.6091, lng: 121.0223 },
  "CAR": { lat: 16.4023, lng: 120.5960 },
  "Region I": { lat: 16.0754, lng: 120.6200 },
  "Region II": { lat: 16.9754, lng: 121.8107 },
  "Region III": { lat: 15.4833, lng: 120.7117 },
  "Region IV-A": { lat: 14.1008, lng: 121.0794 },
  "MIMAROPA": { lat: 12.5083, lng: 121.0470 },
  "Region V": { lat: 13.4209, lng: 123.4136 },
  "Region VI": { lat: 10.7202, lng: 122.5621 },
  "Region VII": { lat: 10.3157, lng: 123.8854 },
  "Region VIII": { lat: 11.2458, lng: 125.0039 },
  "Region IX": { lat: 8.2280, lng: 123.2542 },
  "Region X": { lat: 8.4542, lng: 124.6319 },
  "Region XI": { lat: 7.0731, lng: 125.6128 },
  "Region XII": { lat: 6.1164, lng: 125.1716 },
  "Region XIII": { lat: 8.9475, lng: 125.5406 },
  "BARMM": { lat: 6.9497, lng: 124.2422 },
};

export const getRegionalCoordinates = (region: string): { lat: number; lng: number } | null => {
  return REGIONAL_COORDINATES[region] || null;
};
