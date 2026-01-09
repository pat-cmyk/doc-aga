import { describe, it, expect } from 'vitest';
import {
  calculateADG,
  calculateOverallADG,
  getExpectedADG,
  getADGStatus,
  formatADG,
} from './growthMetrics';

describe('calculateADG', () => {
  it('calculates ADG between two measurements', () => {
    const result = calculateADG(
      { weight_kg: 150, measurement_date: '2024-02-14' },
      { weight_kg: 100, measurement_date: '2024-01-15' },
      'cattle',
      'female',
      'Calf'
    );

    expect(result).not.toBeNull();
    expect(result!.totalGainKg).toBe(50);
    expect(result!.daysBetween).toBe(30);
    expect(result!.adgGrams).toBeCloseTo(1667, -1); // ~1667g/day
    expect(result!.adgKg).toBeCloseTo(1.67, 1);
  });

  it('returns null for same-day measurements', () => {
    const result = calculateADG(
      { weight_kg: 150, measurement_date: '2024-02-14' },
      { weight_kg: 100, measurement_date: '2024-02-14' }
    );

    expect(result).toBeNull();
  });

  it('handles weight loss (negative ADG)', () => {
    const result = calculateADG(
      { weight_kg: 90, measurement_date: '2024-02-14' },
      { weight_kg: 100, measurement_date: '2024-01-14' },
      'cattle',
      'female',
      'Calf'
    );

    expect(result).not.toBeNull();
    expect(result!.adgGrams).toBeLessThan(0);
    expect(result!.totalGainKg).toBe(-10);
  });
});

describe('calculateOverallADG', () => {
  it('calculates overall ADG from multiple records', () => {
    const records = [
      { weight_kg: 100, measurement_date: '2024-01-01' },
      { weight_kg: 120, measurement_date: '2024-01-15' },
      { weight_kg: 150, measurement_date: '2024-02-01' },
    ];

    const result = calculateOverallADG(records, 'cattle', 'female', 'Calf');

    expect(result).not.toBeNull();
    expect(result!.totalGainKg).toBe(50);
    expect(result!.daysBetween).toBe(31);
  });

  it('returns null for single record', () => {
    const result = calculateOverallADG([{ weight_kg: 100, measurement_date: '2024-01-01' }]);
    expect(result).toBeNull();
  });

  it('returns null for empty array', () => {
    const result = calculateOverallADG([]);
    expect(result).toBeNull();
  });
});

describe('getExpectedADG', () => {
  it('returns expected ADG for cattle calf', () => {
    const result = getExpectedADG('cattle', 'female', 'Calf');

    expect(result).not.toBeNull();
    expect(result!.min).toBe(700);
    expect(result!.max).toBe(1000);
    expect(result!.optimal).toBe(850);
  });

  it('returns expected ADG for goat kid', () => {
    const result = getExpectedADG('goat', 'male', 'Kid');

    expect(result).not.toBeNull();
    expect(result!.min).toBe(80);
    expect(result!.max).toBe(120);
    expect(result!.optimal).toBe(100);
  });

  it('returns null for unknown life stage', () => {
    const result = getExpectedADG('cattle', 'female', 'Unknown Stage');
    expect(result).toBeNull();
  });

  it('returns null for null life stage', () => {
    const result = getExpectedADG('cattle', 'female', null);
    expect(result).toBeNull();
  });
});

describe('getADGStatus', () => {
  it('returns excellent for >= 100%', () => {
    expect(getADGStatus(100)).toBe('excellent');
    expect(getADGStatus(150)).toBe('excellent');
  });

  it('returns good for 80-99%', () => {
    expect(getADGStatus(80)).toBe('good');
    expect(getADGStatus(99)).toBe('good');
  });

  it('returns fair for 60-79%', () => {
    expect(getADGStatus(60)).toBe('fair');
    expect(getADGStatus(79)).toBe('fair');
  });

  it('returns poor for < 60%', () => {
    expect(getADGStatus(59)).toBe('poor');
    expect(getADGStatus(0)).toBe('poor');
    expect(getADGStatus(-50)).toBe('poor');
  });
});

describe('formatADG', () => {
  it('formats small ADG in grams', () => {
    expect(formatADG(850)).toBe('850 g/day');
    expect(formatADG(100)).toBe('100 g/day');
  });

  it('formats large ADG in kilograms', () => {
    expect(formatADG(1500)).toBe('1.50 kg/day');
    expect(formatADG(2000)).toBe('2.00 kg/day');
  });

  it('handles negative values', () => {
    expect(formatADG(-500)).toBe('-500 g/day');
  });
});
