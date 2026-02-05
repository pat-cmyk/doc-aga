 /**
  * usePreCalvingRiskScore Hook
  * 
  * Calculates Pre-Calving Risk Score (PCRS) for pregnant animals
  * Uses the SSOT definitions from urgencyGlossary.ts
  */
 
 import { useMemo } from 'react';
 import { differenceInDays, parseISO } from 'date-fns';
 import {
   calculatePCRS,
   getPCRSTier,
   type PCRSResult,
   type PCRSTier,
 } from '@/lib/urgencyGlossary';
 
 export interface PregnantAnimalData {
   animalId: string;
   animalName?: string;
   earTag?: string;
   livestockType?: string;
   farmName?: string;
   region?: string;
   expectedDeliveryDate: string;
   parity?: number | null;
   latestBCS?: number | null;
   latestBCSDate?: string | null;
   healthIssueCount?: number;
 }
 
 export interface AnimalWithPCRS extends PregnantAnimalData {
   pcrs: PCRSResult;
   daysUntilDelivery: number;
 }
 
 export interface PCRSSummary {
   total: number;
   byTier: {
     critical: number;
     high: number;
     moderate: number;
     low: number;
   };
   criticalAnimals: AnimalWithPCRS[];
   highRiskAnimals: AnimalWithPCRS[];
 }
 
 /**
  * Calculate PCRS for a single pregnant animal
  */
 export function calculateAnimalPCRS(
   animal: PregnantAnimalData,
   referenceDate: Date = new Date()
 ): AnimalWithPCRS {
   const deliveryDate = parseISO(animal.expectedDeliveryDate);
   const daysUntilDelivery = differenceInDays(deliveryDate, referenceDate);
 
   // Calculate days since last BCS
   let daysSinceLastBCS: number | null = null;
   if (animal.latestBCSDate) {
     daysSinceLastBCS = differenceInDays(referenceDate, parseISO(animal.latestBCSDate));
   }
 
   const pcrs = calculatePCRS({
     daysUntilDelivery,
     latestBCS: animal.latestBCS ?? null,
     parity: animal.parity ?? null,
     healthIssueCount: animal.healthIssueCount ?? 0,
     daysSinceLastBCS,
   });
 
   return {
     ...animal,
     pcrs,
     daysUntilDelivery,
   };
 }
 
 /**
  * Hook to calculate PCRS for a list of pregnant animals
  */
 export function usePreCalvingRiskScore(
   animals: PregnantAnimalData[],
   referenceDate: Date = new Date()
 ) {
   const animalsWithPCRS = useMemo(() => {
     return animals
       .map((animal) => calculateAnimalPCRS(animal, referenceDate))
       .sort((a, b) => b.pcrs.totalScore - a.pcrs.totalScore); // Sort by risk score desc
   }, [animals, referenceDate]);
 
   const summary: PCRSSummary = useMemo(() => {
     const byTier = {
       critical: 0,
       high: 0,
       moderate: 0,
       low: 0,
     };
 
     animalsWithPCRS.forEach((animal) => {
       byTier[animal.pcrs.tier.tier]++;
     });
 
     return {
       total: animalsWithPCRS.length,
       byTier,
       criticalAnimals: animalsWithPCRS.filter((a) => a.pcrs.tier.tier === 'critical'),
       highRiskAnimals: animalsWithPCRS.filter((a) => a.pcrs.tier.tier === 'high'),
     };
   }, [animalsWithPCRS]);
 
   return {
     animalsWithPCRS,
     summary,
   };
 }
 
 /**
  * Get PCRS tier for a month based on aggregate risk
  * Used for month-level badges in the timeline
  */
 export function getMonthRiskTier(animalsInMonth: AnimalWithPCRS[]): PCRSTier {
   if (animalsInMonth.length === 0) {
     return getPCRSTier(0);
   }
 
   // If any animal is critical, month is critical
   const hasCritical = animalsInMonth.some((a) => a.pcrs.tier.tier === 'critical');
   if (hasCritical) return getPCRSTier(75);
 
   // If >30% are high risk, month is high
   const highRiskCount = animalsInMonth.filter(
     (a) => a.pcrs.tier.tier === 'critical' || a.pcrs.tier.tier === 'high'
   ).length;
   if (highRiskCount / animalsInMonth.length > 0.3) return getPCRSTier(50);
 
   // If any are high risk, month is moderate
   if (highRiskCount > 0) return getPCRSTier(25);
 
   // Otherwise low risk
   return getPCRSTier(0);
 }