import { describe, it, expect } from 'vitest';
import {
  estimateWeightByAge,
  getWeightRange,
  estimateFutureWeight,
} from './weightEstimates';

describe('weightEstimates', () => {
  describe('estimateWeightByAge', () => {
    it('should estimate weight for female calf', () => {
      const birthDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 3 months ago
      const weight = estimateWeightByAge({
        birthDate,
        gender: 'female',
        lifeStage: 'Calf',
      });
      expect(weight).toBeGreaterThan(0);
      expect(weight).toBeLessThan(300);
    });

    it('should estimate weight for mature cow', () => {
      const birthDate = new Date(Date.now() - 1460 * 24 * 60 * 60 * 1000); // 4 years ago
      const weight = estimateWeightByAge({
        birthDate,
        gender: 'female',
        lifeStage: 'Mature Cow',
      });
      expect(weight).toBeGreaterThan(400);
      expect(weight).toBeLessThan(700);
    });

    it('should estimate weight for male bull', () => {
      const birthDate = new Date(Date.now() - 1095 * 24 * 60 * 60 * 1000); // 3 years ago
      const weight = estimateWeightByAge({
        birthDate,
        gender: 'male',
        lifeStage: 'Mature Bull',
      });
      expect(weight).toBeGreaterThan(600);
      expect(weight).toBeLessThan(1200);
    });

    it('should handle animals without life stage', () => {
      const birthDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
      const weight = estimateWeightByAge({
        birthDate,
        gender: 'female',
      });
      expect(weight).toBeGreaterThan(0);
    });
  });

  describe('getWeightRange', () => {
    it('should return weight range for female Calf', () => {
      const range = getWeightRange('Calf', 'female');
      expect(range).not.toBe(null);
      expect(range?.min).toBeGreaterThan(0);
      expect(range?.max).toBeGreaterThan(range?.min);
      expect(range?.avgMonthlyGrowth).toBeGreaterThan(0);
    });

    it('should return weight range for male Mature Bull', () => {
      const range = getWeightRange('Mature Bull', 'male');
      expect(range).not.toBe(null);
      expect(range?.min).toBeGreaterThan(0);
      expect(range?.max).toBeGreaterThan(range?.min);
    });

    it('should return null for unknown life stage', () => {
      const range = getWeightRange('Unknown Stage', 'female');
      expect(range).toBe(null);
    });

    it('should handle null life stage', () => {
      const range = getWeightRange(null, 'female');
      expect(range).toBe(null);
    });
  });

  describe('estimateFutureWeight', () => {
    it('should project weight growth for young animal', () => {
      const currentWeight = 200;
      const futureWeight = estimateFutureWeight(
        currentWeight,
        'Heifer Calf',
        'female',
        6
      );
      expect(futureWeight).toBeGreaterThan(currentWeight);
    });

    it('should not exceed max weight for life stage', () => {
      const currentWeight = 500;
      const range = getWeightRange('Mature Cow', 'female');
      const futureWeight = estimateFutureWeight(
        currentWeight,
        'Mature Cow',
        'female',
        12
      );
      expect(futureWeight).toBeLessThanOrEqual(range?.max || 700);
    });

    it('should return current weight for unknown stage', () => {
      const currentWeight = 400;
      const futureWeight = estimateFutureWeight(
        currentWeight,
        'Unknown',
        'female',
        3
      );
      expect(futureWeight).toBe(currentWeight);
    });

    it('should handle zero months ahead', () => {
      const currentWeight = 300;
      const futureWeight = estimateFutureWeight(
        currentWeight,
        'Heifer Calf',
        'female',
        0
      );
      expect(futureWeight).toBe(currentWeight);
    });
  });
});
