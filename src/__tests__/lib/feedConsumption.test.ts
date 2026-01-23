import { describe, it, expect } from 'vitest';
import {
  calculateDryMatterIntake,
  calculateFreshForageIntake,
  calculateAnimalConsumption,
  calculateFarmDailyConsumption,
  calculateDaysOfStock,
  calculateCategoryDaysOfStock,
  calculateConsumptionFromCounts,
  getEffectiveWeight,
  getDryMatterPercentage,
  DRY_MATTER_PERCENTAGES,
  DRY_MATTER_CONTENT,
  DIET_RATIOS,
  DEFAULT_WEIGHTS,
  type AnimalForConsumption
} from '@/lib/feedConsumption';

describe('Unified Feed Consumption Service', () => {
  
  describe('getEffectiveWeight', () => {
    it('returns current_weight_kg when available', () => {
      const animal: AnimalForConsumption = {
        current_weight_kg: 450,
        entry_weight_kg: 400,
        birth_weight_kg: 35
      };
      expect(getEffectiveWeight(animal)).toBe(450);
    });

    it('falls back to entry_weight_kg when current is null', () => {
      const animal: AnimalForConsumption = {
        current_weight_kg: null,
        entry_weight_kg: 400,
        birth_weight_kg: 35
      };
      expect(getEffectiveWeight(animal)).toBe(400);
    });

    it('falls back to birth_weight_kg when others are null', () => {
      const animal: AnimalForConsumption = {
        current_weight_kg: null,
        entry_weight_kg: null,
        birth_weight_kg: 35
      };
      expect(getEffectiveWeight(animal)).toBe(35);
    });

    it('uses default weight by livestock type when all weights are null', () => {
      expect(getEffectiveWeight({ livestock_type: 'cattle' })).toBe(400);
      expect(getEffectiveWeight({ livestock_type: 'carabao' })).toBe(350);
      expect(getEffectiveWeight({ livestock_type: 'goat' })).toBe(40);
      expect(getEffectiveWeight({ livestock_type: 'sheep' })).toBe(50);
    });

    it('defaults to cattle weight for unknown livestock type', () => {
      expect(getEffectiveWeight({})).toBe(400);
      expect(getEffectiveWeight({ livestock_type: 'unknown' })).toBe(400);
    });
  });

  describe('getDryMatterPercentage', () => {
    it('returns 3.5% for lactating animals', () => {
      expect(getDryMatterPercentage(null, 'Early Lactation')).toBe(0.035);
      expect(getDryMatterPercentage(null, 'Peak Lactation')).toBe(0.035);
      expect(getDryMatterPercentage('Mature Cow', 'Mid Lactation')).toBe(0.035);
    });

    it('returns 2.0% for dry period', () => {
      expect(getDryMatterPercentage(null, 'Dry Period')).toBe(0.02);
    });

    it('returns 3.0% for calves', () => {
      expect(getDryMatterPercentage('Calf', null)).toBe(0.03);
      expect(getDryMatterPercentage('Bull Calf', null)).toBe(0.03);
    });

    it('returns 2.5% for growing animals', () => {
      expect(getDryMatterPercentage('Heifer Calf', null)).toBe(0.025);
      expect(getDryMatterPercentage('Breeding Heifer', null)).toBe(0.025);
      expect(getDryMatterPercentage('Young Bull', null)).toBe(0.025);
    });

    it('returns 2.0% for maintenance animals', () => {
      expect(getDryMatterPercentage('Pregnant Heifer', null)).toBe(0.02);
      expect(getDryMatterPercentage('Mature Cow', null)).toBe(0.02);
    });

    it('returns 2.5% for mature bulls', () => {
      expect(getDryMatterPercentage('Mature Bull', null)).toBe(0.025);
    });

    it('returns default 2.2% for unknown stages', () => {
      expect(getDryMatterPercentage(null, null)).toBe(0.022);
      expect(getDryMatterPercentage('Unknown', null)).toBe(0.022);
    });
  });

  describe('calculateDryMatterIntake', () => {
    it('calculates correctly for a lactating cow', () => {
      const animal: AnimalForConsumption = {
        current_weight_kg: 500,
        milking_stage: 'Peak Lactation'
      };
      // 500 * 0.035 = 17.5 kg DM
      expect(calculateDryMatterIntake(animal)).toBe(17.5);
    });

    it('calculates correctly for a calf', () => {
      const animal: AnimalForConsumption = {
        current_weight_kg: 100,
        life_stage: 'Calf'
      };
      // 100 * 0.03 = 3 kg DM
      expect(calculateDryMatterIntake(animal)).toBe(3);
    });

    it('uses default weight when weight is missing', () => {
      const animal: AnimalForConsumption = {
        livestock_type: 'cattle',
        life_stage: 'Mature Cow'
      };
      // 400 (default) * 0.02 = 8 kg DM
      expect(calculateDryMatterIntake(animal)).toBe(8);
    });
  });

  describe('calculateFreshForageIntake', () => {
    it('converts dry matter to fresh weight correctly', () => {
      const animal: AnimalForConsumption = {
        current_weight_kg: 450,
        milking_stage: 'Peak Lactation'
      };
      // 450 * 0.035 = 15.75 kg DM
      // 15.75 / 0.30 = 52.5 kg fresh forage
      expect(calculateFreshForageIntake(animal)).toBe(52.5);
    });
  });

  describe('calculateAnimalConsumption', () => {
    it('returns complete breakdown with correct ratios', () => {
      const animal: AnimalForConsumption = {
        current_weight_kg: 400,
        life_stage: 'Mature Cow'
      };
      
      const result = calculateAnimalConsumption(animal);
      
      // 400 * 0.02 = 8 kg DM
      expect(result.dryMatterKgPerDay).toBe(8);
      
      // 8 / 0.30 = 26.67 kg fresh forage
      expect(result.freshForageKgPerDay).toBeCloseTo(26.67, 1);
      
      // 70% roughage, 30% concentrate
      expect(result.roughageKgPerDay).toBeCloseTo(result.freshForageKgPerDay * 0.7, 1);
      expect(result.concentrateKgPerDay).toBeCloseTo(result.freshForageKgPerDay * 0.3, 1);
    });
  });

  describe('calculateFarmDailyConsumption', () => {
    it('sums consumption across all animals', () => {
      const animals: AnimalForConsumption[] = [
        { current_weight_kg: 500, milking_stage: 'Peak Lactation' }, // 17.5 DM / 58.33 fresh
        { current_weight_kg: 100, life_stage: 'Calf' }, // 3 DM / 10 fresh
        { current_weight_kg: 400, life_stage: 'Mature Cow' } // 8 DM / 26.67 fresh
      ];
      
      const result = calculateFarmDailyConsumption(animals);
      
      expect(result.animalCount).toBe(3);
      expect(result.totalDryMatterKgPerDay).toBeCloseTo(28.5, 1);
      expect(result.totalFreshForageKgPerDay).toBeCloseTo(95, 0);
    });

    it('groups by life stage correctly', () => {
      const animals: AnimalForConsumption[] = [
        { current_weight_kg: 100, life_stage: 'Calf' },
        { current_weight_kg: 120, life_stage: 'Calf' },
        { current_weight_kg: 400, life_stage: 'Mature Cow' }
      ];
      
      const result = calculateFarmDailyConsumption(animals);
      
      expect(result.breakdownByStage['Calf'].count).toBe(2);
      expect(result.breakdownByStage['Mature Cow'].count).toBe(1);
    });

    it('handles empty array', () => {
      const result = calculateFarmDailyConsumption([]);
      
      expect(result.animalCount).toBe(0);
      expect(result.totalDryMatterKgPerDay).toBe(0);
      expect(result.totalFreshForageKgPerDay).toBe(0);
    });
  });

  describe('calculateDaysOfStock', () => {
    it('calculates days correctly', () => {
      expect(calculateDaysOfStock(1000, 50)).toBe(20);
      expect(calculateDaysOfStock(500, 25)).toBe(20);
    });

    it('returns null when consumption is zero', () => {
      expect(calculateDaysOfStock(1000, 0)).toBeNull();
    });

    it('returns null for negative consumption', () => {
      expect(calculateDaysOfStock(1000, -10)).toBeNull();
    });
  });

  describe('calculateCategoryDaysOfStock', () => {
    it('calculates roughage and concentrate days separately', () => {
      // 100kg total daily, 70kg roughage, 30kg concentrate
      const result = calculateCategoryDaysOfStock(700, 300, 100);
      
      expect(result.roughageDays).toBe(10); // 700 / 70
      expect(result.concentrateDays).toBe(10); // 300 / 30
      expect(result.feedStockDays).toBe(10); // Same as roughage
    });

    it('returns nulls when daily consumption is zero', () => {
      const result = calculateCategoryDaysOfStock(700, 300, 0);
      
      expect(result.roughageDays).toBeNull();
      expect(result.concentrateDays).toBeNull();
      expect(result.feedStockDays).toBeNull();
    });
  });

  describe('calculateConsumptionFromCounts (legacy)', () => {
    it('calculates using default weights and maintenance percentage', () => {
      const result = calculateConsumptionFromCounts([
        { livestockType: 'cattle', count: 10 }
      ]);
      
      // 10 cattle * 400kg * 0.022 DM% / 0.30 = 293.33 kg fresh
      expect(result).toBeCloseTo(293.3, 0);
    });

    it('handles multiple livestock types', () => {
      const result = calculateConsumptionFromCounts([
        { livestockType: 'cattle', count: 5 },
        { livestockType: 'goat', count: 10 }
      ]);
      
      // Cattle: 5 * 400 * 0.022 / 0.30 = 146.67
      // Goats: 10 * 40 * 0.022 / 0.30 = 29.33
      // Total: ~176
      expect(result).toBeCloseTo(176, 0);
    });

    it('returns 0 for empty array', () => {
      expect(calculateConsumptionFromCounts([])).toBe(0);
    });
  });

  describe('Constants', () => {
    it('has correct dry matter percentages', () => {
      expect(DRY_MATTER_PERCENTAGES.lactating).toBe(0.035);
      expect(DRY_MATTER_PERCENTAGES.calf).toBe(0.03);
      expect(DRY_MATTER_PERCENTAGES.default).toBe(0.022);
    });

    it('has correct dry matter content', () => {
      expect(DRY_MATTER_CONTENT).toBe(0.30);
    });

    it('has correct diet ratios summing to 1', () => {
      expect(DIET_RATIOS.roughage + DIET_RATIOS.concentrate).toBe(1);
      expect(DIET_RATIOS.roughage).toBe(0.70);
      expect(DIET_RATIOS.concentrate).toBe(0.30);
    });

    it('has correct default weights', () => {
      expect(DEFAULT_WEIGHTS.cattle).toBe(400);
      expect(DEFAULT_WEIGHTS.carabao).toBe(350);
      expect(DEFAULT_WEIGHTS.goat).toBe(40);
      expect(DEFAULT_WEIGHTS.sheep).toBe(50);
    });
  });
});
