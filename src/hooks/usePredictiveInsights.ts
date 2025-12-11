import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MilkPrediction {
  forecast7Days: number;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
  explanation: string;
}

export interface HeatPrediction {
  animalId: string;
  predictedDate: string;
  confidence: number;
}

export interface DeliveryAlert {
  animalId: string;
  dueDate: string;
  daysUntil: number;
}

export interface BreedingPrediction {
  nextHeatPredictions: HeatPrediction[];
  deliveryAlerts: DeliveryAlert[];
  successRateForecast: number;
  explanation: string;
}

export interface HealthPrediction {
  riskLevel: 'low' | 'medium' | 'high';
  potentialIssues: string[];
  overdueCount: number;
  recommendation: string;
}

export interface PredictiveInsights {
  milk: MilkPrediction;
  breeding: BreedingPrediction;
  health: HealthPrediction;
}

interface CachedInsights {
  predictions: PredictiveInsights;
  generatedAt: string;
  dataSource: 'ai' | 'fallback';
}

const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

function getCacheKey(farmId: string): string {
  return `predictive_insights_${farmId}`;
}

function getFromCache(farmId: string): CachedInsights | null {
  try {
    const cached = localStorage.getItem(getCacheKey(farmId));
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    const generatedAt = new Date(parsed.generatedAt).getTime();
    const now = Date.now();
    
    if (now - generatedAt > CACHE_DURATION_MS) {
      localStorage.removeItem(getCacheKey(farmId));
      return null;
    }
    
    return parsed;
  } catch {
    return null;
  }
}

function saveToCache(farmId: string, data: CachedInsights): void {
  try {
    localStorage.setItem(getCacheKey(farmId), JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

export function usePredictiveInsights(farmId: string) {
  const [insights, setInsights] = useState<PredictiveInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dataSource, setDataSource] = useState<'ai' | 'fallback' | null>(null);

  const fetchInsights = useCallback(async (forceRefresh = false) => {
    if (!farmId) return;

    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cached = getFromCache(farmId);
      if (cached) {
        setInsights(cached.predictions);
        setLastUpdated(new Date(cached.generatedAt));
        setDataSource(cached.dataSource);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-predictive-insights', {
        body: { farmId }
      });

      if (fnError) throw fnError;

      if (data?.predictions) {
        setInsights(data.predictions);
        setLastUpdated(new Date(data.generatedAt));
        setDataSource(data.dataSource);
        
        // Cache the results
        saveToCache(farmId, {
          predictions: data.predictions,
          generatedAt: data.generatedAt,
          dataSource: data.dataSource
        });
      }
    } catch (err) {
      console.error('Error fetching predictive insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to load predictions');
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  // Load on mount
  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const refresh = useCallback(() => {
    fetchInsights(true);
  }, [fetchInsights]);

  return {
    insights,
    loading,
    error,
    lastUpdated,
    dataSource,
    refresh
  };
}
