import { describe, it, expect } from 'vitest';
import {
  calculateLifeStage,
  calculateMilkingStage,
  calculateMaleStage,
  getLifeStageBadgeColor,
  getMilkingStageBadgeColor,
  type AnimalStageData,
} from './animalStages';

const createBaseAnimalData = (overrides: Partial<AnimalStageData> = {}): AnimalStageData => ({
  birthDate: new Date(),
  gender: 'female',
  milkingStartDate: null,
  offspringCount: 0,
  lastCalvingDate: null,
  hasRecentMilking: false,
  hasActiveAI: false,
  ...overrides,
});

describe('animalStages', () => {
  describe('calculateLifeStage', () => {
    it('should return "Calf" for animals under 6 months', () => {
      const data = createBaseAnimalData({
        birthDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 3 months ago
        gender: 'female',
      });
      expect(calculateLifeStage(data)).toBe('Calf');
    });

    it('should return "Heifer Calf" for females 6-12 months', () => {
      const data = createBaseAnimalData({
        birthDate: new Date(Date.now() - 270 * 24 * 60 * 60 * 1000), // 9 months ago
        gender: 'female',
      });
      expect(calculateLifeStage(data)).toBe('Heifer Calf');
    });

    it('should return "Breeding Heifer" for females 12-24 months with no offspring', () => {
      const data = createBaseAnimalData({
        birthDate: new Date(Date.now() - 540 * 24 * 60 * 60 * 1000), // 18 months ago
        gender: 'female',
        offspringCount: 0,
      });
      expect(calculateLifeStage(data)).toBe('Breeding Heifer');
    });

    it('should return "Mature Cow" for females with 2+ offspring', () => {
      const data = createBaseAnimalData({
        birthDate: new Date(Date.now() - 1095 * 24 * 60 * 60 * 1000), // 3 years ago
        gender: 'female',
        offspringCount: 2,
      });
      expect(calculateLifeStage(data)).toBe('Mature Cow');
    });

    it('should return null for male animals', () => {
      const data = createBaseAnimalData({
        birthDate: new Date(Date.now() - 270 * 24 * 60 * 60 * 1000),
        gender: 'male',
      });
      expect(calculateLifeStage(data)).toBe(null);
    });
  });

  describe('calculateMilkingStage', () => {
    it('should return "Early Lactation" for 0-100 days since calving', () => {
      const lastCalvingDate = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000); // 50 days ago
      const data = createBaseAnimalData({
        birthDate: new Date(Date.now() - 1095 * 24 * 60 * 60 * 1000),
        gender: 'female',
        lastCalvingDate,
        hasRecentMilking: true,
      });
      expect(calculateMilkingStage(data)).toBe('Early Lactation');
    });

    it('should return "Mid-Lactation" for 101-200 days since calving', () => {
      const lastCalvingDate = new Date(Date.now() - 150 * 24 * 60 * 60 * 1000); // 150 days ago
      const data = createBaseAnimalData({
        birthDate: new Date(Date.now() - 1095 * 24 * 60 * 60 * 1000),
        gender: 'female',
        lastCalvingDate,
        hasRecentMilking: true,
      });
      expect(calculateMilkingStage(data)).toBe('Mid-Lactation');
    });

    it('should return "Late Lactation" for 201-305 days since calving', () => {
      const lastCalvingDate = new Date(Date.now() - 250 * 24 * 60 * 60 * 1000); // 250 days ago
      const data = createBaseAnimalData({
        birthDate: new Date(Date.now() - 1095 * 24 * 60 * 60 * 1000),
        gender: 'female',
        lastCalvingDate,
        hasRecentMilking: true,
      });
      expect(calculateMilkingStage(data)).toBe('Late Lactation');
    });

    it('should return "Dry Period" for animals without recent milking', () => {
      const lastCalvingDate = new Date(Date.now() - 150 * 24 * 60 * 60 * 1000);
      const data = createBaseAnimalData({
        birthDate: new Date(Date.now() - 1095 * 24 * 60 * 60 * 1000),
        gender: 'female',
        lastCalvingDate,
        hasRecentMilking: false,
      });
      expect(calculateMilkingStage(data)).toBe('Dry Period');
    });

    it('should return null for animals with no calving history', () => {
      const data = createBaseAnimalData({
        birthDate: new Date(Date.now() - 1095 * 24 * 60 * 60 * 1000),
        gender: 'female',
        lastCalvingDate: null,
      });
      expect(calculateMilkingStage(data)).toBe(null);
    });
  });

  describe('calculateMaleStage', () => {
    it('should return "Bull Calf" for males under 12 months', () => {
      const data = createBaseAnimalData({
        birthDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months ago
        gender: 'male',
      });
      expect(calculateMaleStage(data)).toBe('Bull Calf');
    });

    it('should return "Young Bull" for males 12-24 months', () => {
      const data = createBaseAnimalData({
        birthDate: new Date(Date.now() - 540 * 24 * 60 * 60 * 1000), // 18 months ago
        gender: 'male',
      });
      expect(calculateMaleStage(data)).toBe('Young Bull');
    });

    it('should return "Mature Bull" for males over 24 months', () => {
      const data = createBaseAnimalData({
        birthDate: new Date(Date.now() - 1095 * 24 * 60 * 60 * 1000), // 3 years ago
        gender: 'male',
      });
      expect(calculateMaleStage(data)).toBe('Mature Bull');
    });

    it('should return null for female animals', () => {
      const data = createBaseAnimalData({
        birthDate: new Date(Date.now() - 540 * 24 * 60 * 60 * 1000),
        gender: 'female',
      });
      expect(calculateMaleStage(data)).toBe(null);
    });
  });

  describe('badge color functions', () => {
    it('should return color classes for life stages', () => {
      expect(getLifeStageBadgeColor('Calf')).toContain('blue');
      expect(getLifeStageBadgeColor('Mature Cow')).toContain('green');
      expect(getLifeStageBadgeColor(null)).toContain('gray');
    });

    it('should return color classes for milking stages', () => {
      expect(getMilkingStageBadgeColor('Early Lactation')).toContain('green');
      expect(getMilkingStageBadgeColor('Dry Period')).toContain('gray');
      expect(getMilkingStageBadgeColor(null)).toContain('gray');
    });
  });
});
