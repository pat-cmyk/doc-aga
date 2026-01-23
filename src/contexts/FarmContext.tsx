import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FarmContextType {
  farmId: string | null;
  farmName: string;
  farmLogoUrl: string | null;
  canManageFarm: boolean;
  maxBackdateDays: number;
  isLoading: boolean;
  setFarmId: (farmId: string | null) => void;
  setFarmDetails: (details: { name?: string; logoUrl?: string | null; canManage?: boolean; maxBackdateDays?: number }) => void;
  clearFarm: () => void;
}

const FarmContext = createContext<FarmContextType | undefined>(undefined);

const STORAGE_KEY = 'currentFarmId';

export function FarmProvider({ children }: { children: ReactNode }) {
  const [farmId, setFarmIdState] = useState<string | null>(() => {
    // Initialize from localStorage for page refresh recovery
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY);
    }
    return null;
  });
  const [farmName, setFarmName] = useState<string>('My Farm');
  const [farmLogoUrl, setFarmLogoUrl] = useState<string | null>(null);
  const [canManageFarm, setCanManageFarm] = useState(false);
  const [maxBackdateDays, setMaxBackdateDays] = useState(7);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch farm details when farmId changes
  useEffect(() => {
    const fetchFarmDetails = async () => {
      if (!farmId) {
        setFarmName('My Farm');
        setFarmLogoUrl(null);
        setCanManageFarm(false);
        setMaxBackdateDays(7);
        return;
      }

      setIsLoading(true);
      try {
        const [farmResult, userResult] = await Promise.all([
          supabase
            .from('farms')
            .select('name, logo_url, owner_id, max_backdate_days')
            .eq('id', farmId)
            .single(),
          supabase.auth.getUser()
        ]);

        if (farmResult.data) {
          setFarmName(farmResult.data.name || 'My Farm');
          setFarmLogoUrl(farmResult.data.logo_url);
          setCanManageFarm(farmResult.data.owner_id === userResult.data.user?.id);
          setMaxBackdateDays(farmResult.data.max_backdate_days ?? 7);
        }
      } catch (error) {
        console.error('Error fetching farm details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFarmDetails();
  }, [farmId]);

  // Persist farmId to localStorage
  useEffect(() => {
    if (farmId) {
      localStorage.setItem(STORAGE_KEY, farmId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [farmId]);

  // Clear farm data on logout
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setFarmIdState(null);
        setFarmName('My Farm');
        setFarmLogoUrl(null);
        setCanManageFarm(false);
        localStorage.removeItem(STORAGE_KEY);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const setFarmId = useCallback((id: string | null) => {
    setFarmIdState(id);
  }, []);

  const setFarmDetails = useCallback((details: { name?: string; logoUrl?: string | null; canManage?: boolean; maxBackdateDays?: number }) => {
    if (details.name !== undefined) setFarmName(details.name);
    if (details.logoUrl !== undefined) setFarmLogoUrl(details.logoUrl);
    if (details.canManage !== undefined) setCanManageFarm(details.canManage);
    if (details.maxBackdateDays !== undefined) setMaxBackdateDays(details.maxBackdateDays);
  }, []);

  const clearFarm = useCallback(() => {
    setFarmIdState(null);
    setFarmName('My Farm');
    setFarmLogoUrl(null);
    setCanManageFarm(false);
    setMaxBackdateDays(7);
  }, []);

  return (
    <FarmContext.Provider value={{
      farmId,
      farmName,
      farmLogoUrl,
      canManageFarm,
      maxBackdateDays,
      isLoading,
      setFarmId,
      setFarmDetails,
      clearFarm
    }}>
      {children}
    </FarmContext.Provider>
  );
}

export function useFarm() {
  const context = useContext(FarmContext);
  if (context === undefined) {
    throw new Error('useFarm must be used within a FarmProvider');
  }
  return context;
}
