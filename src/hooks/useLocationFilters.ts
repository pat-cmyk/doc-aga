import { PHILIPPINE_LOCATIONS } from "@/lib/philippineLocations";

export const useLocationFilters = () => {
  const getRegions = (): string[] => {
    return Object.keys(PHILIPPINE_LOCATIONS).sort();
  };

  const getProvinces = (region: string | undefined): string[] => {
    if (!region || region === "all") return [];
    const provinces = PHILIPPINE_LOCATIONS[region];
    if (!provinces) return [];
    return Object.keys(provinces).sort();
  };

  const getMunicipalities = (region: string | undefined, province: string | undefined): string[] => {
    if (!region || region === "all" || !province || province === "all") return [];
    const provinces = PHILIPPINE_LOCATIONS[region];
    if (!provinces) return [];
    const municipalities = provinces[province];
    if (!municipalities) return [];
    return municipalities.sort();
  };

  return {
    getRegions,
    getProvinces,
    getMunicipalities,
  };
};
