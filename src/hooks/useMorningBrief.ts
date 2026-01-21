import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MorningBrief {
  greeting: string;
  summary: string;
  highlights: string[];
  alerts: string[];
  tip: string;
}

export interface MorningBriefMetrics {
  farmName: string;
  totalAnimals: number;
  lactatingAnimals: number;
  todayMilk: number;
  avgDailyMilk: string;
  pregnantCount: number;
  upcomingDeliveries: number;
  overdueVaccines: number;
  overdueDeworming: number;
  // NEW: Activity compliance
  feedingDone: boolean;
  feedingRecordsCount: number;
  animalsWithFeedingToday: number;
  milkingCompliancePercent: number;
  completedMilkingSessions: number;
  expectedMilkingSessions: number;
  amSessionsDone: number;
  pmSessionsDone: number;
  // NEW: 30-day milk trend
  milkTrend: 'up' | 'down' | 'stable';
  milkTrendPercent: number;
  // NEW: Financial health
  financialStatus: 'profitable' | 'breakeven' | 'loss';
  monthlyRevenue: number;
  monthlyExpenses: number;
  netProfit: number;
}

interface MorningBriefResponse {
  brief: MorningBrief;
  metrics: MorningBriefMetrics;
  generatedAt: string;
}

const CACHE_KEY_PREFIX = 'morning_brief_';
const CACHE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

export function useMorningBrief(farmId: string | null) {
  const [brief, setBrief] = useState<MorningBrief | null>(null);
  const [metrics, setMetrics] = useState<MorningBriefMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const getCacheKey = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return `${CACHE_KEY_PREFIX}${farmId}_${today}`;
  }, [farmId]);

  const getDismissKey = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return `${CACHE_KEY_PREFIX}dismissed_${farmId}_${today}`;
  }, [farmId]);

  const loadFromCache = useCallback(() => {
    try {
      const cacheKey = getCacheKey();
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const cacheAge = Date.now() - new Date(parsed.generatedAt).getTime();
        if (cacheAge < CACHE_DURATION_MS) {
          return parsed as MorningBriefResponse;
        }
      }
    } catch (e) {
      console.error('Error loading morning brief cache:', e);
    }
    return null;
  }, [getCacheKey]);

  const saveToCache = useCallback((data: MorningBriefResponse) => {
    try {
      const cacheKey = getCacheKey();
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (e) {
      console.error('Error saving morning brief cache:', e);
    }
  }, [getCacheKey]);

  const fetchBrief = useCallback(async (force = false) => {
    if (!farmId) return;

    // Check dismissed state for today
    const dismissedToday = localStorage.getItem(getDismissKey());
    if (dismissedToday && !force) {
      setIsDismissed(true);
      return;
    }

    // Check cache first (unless force refresh)
    if (!force) {
      const cached = loadFromCache();
      if (cached) {
        setBrief(cached.brief);
        setMetrics(cached.metrics);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-morning-brief', {
        body: { farmId }
      });

      if (fnError) throw fnError;

      setBrief(data.brief);
      setMetrics(data.metrics);
      saveToCache(data);
    } catch (e) {
      console.error('Error fetching morning brief:', e);
      setError(e instanceof Error ? e.message : 'Failed to generate brief');
    } finally {
      setIsLoading(false);
    }
  }, [farmId, loadFromCache, saveToCache, getDismissKey]);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem(getDismissKey(), 'true');
  }, [getDismissKey]);

  const refresh = useCallback(() => {
    setIsDismissed(false);
    localStorage.removeItem(getDismissKey());
    fetchBrief(true);
  }, [fetchBrief, getDismissKey]);

  useEffect(() => {
    if (farmId) {
      fetchBrief();
    }
  }, [farmId, fetchBrief]);

  return {
    brief,
    metrics,
    isLoading,
    error,
    isDismissed,
    dismiss,
    refresh
  };
}
