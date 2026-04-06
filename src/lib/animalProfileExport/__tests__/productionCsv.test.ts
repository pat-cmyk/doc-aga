/**
 * productionCsv.test.ts — unit tests for the focused milk + feed CSV renderer.
 */
import { describe, it, expect } from 'vitest';
import { generateAnimalProductionCSV } from '../productionCsv';
import type { AnimalProfileExportData } from '../types';

function buildFixture(
  overrides: Partial<AnimalProfileExportData> = {},
): AnimalProfileExportData {
  return {
    meta: {
      generatedAt: '2026-04-05T08:30:00.000Z',
      sourceIsOffline: false,
      cacheLastUpdated: null,
      farmName: 'Bukid ni Mang Juan',
      farmerName: 'Juan Dela Cruz',
    },
    identity: {
      id: 'a1',
      name: 'Bessie',
      ear_tag: 'ET-001',
      gender: 'Female',
      livestock_type: 'cattle',
      breed: 'Holstein',
      birth_date: '2023-05-10',
      life_stage: 'Mature Cow',
      milking_stage: 'Peak Lactation',
      fertility_status: 'open',
      current_weight_kg: 520,
      entry_weight_kg: 480,
      farm_entry_date: '2024-01-15',
      acquisition_type: 'purchased',
      purchase_price: 80000,
      avatar_url: null,
      parity: 3,
    },
    genealogy: {
      motherName: null,
      motherEarTag: null,
      fatherName: null,
      fatherEarTag: null,
      offspringCount: 0,
    },
    ovr: {
      overall: 70,
      production: 70,
      health: 70,
      fertility: 70,
      growth: 70,
      bodyCondition: 70,
    },
    vitals: {
      currentWeightKg: 520,
      latestBCS: 3.5,
      daysInMilk: null,
      lastHeatDate: null,
      nextVaccineDueDate: null,
      immunityCompliancePercent: 100,
      estimatedValuePhp: null,
      marketPricePerKg: null,
      isPregnant: false,
      expectedDeliveryDate: null,
    },
    costs: {
      purchasePrice: 80000,
      manualExpenses: 0,
      feedConsumptionCost: 0,
      totalExpenses: 0,
      totalInvested: 80000,
      categoryBreakdown: [],
    },
    records: {
      milking: [
        { record_date: '2026-04-01', liters: 22, session: 'AM' },
        { record_date: '2026-04-01', liters: 20, session: 'PM' },
        { record_date: '2026-04-02', liters: 21, session: 'Full Day' },
      ],
      weight: [],
      feeding: [
        {
          feed_date: '2026-04-01',
          feed_type: 'napier',
          kilograms: 25,
          cost_per_kg_at_time: 12,
        },
        {
          feed_date: '2026-04-02',
          feed_type: 'concentrate',
          kilograms: 5,
          cost_per_kg_at_time: 30,
        },
      ],
      health: [],
      ai: [],
      heat: [],
      breeding: [],
      bcs: [],
    },
    sparklines: { weight: [], bcs: [], milk: [] },
    ...overrides,
  };
}

describe('generateAnimalProductionCSV', () => {
  it('emits banner with animal name, breed, and farm', () => {
    const csv = generateAnimalProductionCSV(buildFixture());
    expect(csv).toContain('# ANIMAL PRODUCTION REPORT');
    expect(csv).toContain('# Animal: Bessie (ET-001)');
    expect(csv).toContain('# Breed: Holstein');
    expect(csv).toContain('# Farm: Bukid ni Mang Juan');
  });

  it('includes the 4 production sections', () => {
    const csv = generateAnimalProductionCSV(buildFixture());
    expect(csv).toContain('[PRODUCTION_SUMMARY]');
    expect(csv).toContain('[MILKING_RECORDS]');
    expect(csv).toContain('[FEEDING_RECORDS]');
    expect(csv).toContain('[DAILY_TOTALS]');
  });

  it('aggregates milk across sessions and feed across entries per day', () => {
    const csv = generateAnimalProductionCSV(buildFixture());
    // 2 days with milk (Apr 1 = 42 L, Apr 2 = 21 L) → total 63
    expect(csv).toMatch(/milk_total,63\.00,liters/);
    expect(csv).toMatch(/milk_days,2,days/);
    // feed total = 25 + 5 = 30 kg, feed_days = 2
    expect(csv).toMatch(/feed_total,30\.00,kg/);
    expect(csv).toMatch(/feed_days,2,days/);
    // Cost = 25*12 + 5*30 = 300 + 150 = 450
    expect(csv).toMatch(/feed_total_cost,450\.00,php/);
    // Efficiency = 63 / 30 = 2.100
    expect(csv).toMatch(/feed_efficiency,2\.100/);
  });

  it('joins daily totals with blanks for missing days (no 0 distortion)', () => {
    const fixture = buildFixture();
    // Add a milking-only day with no feed
    fixture.records.milking.push({ record_date: '2026-04-03', liters: 19, session: 'AM' });
    const csv = generateAnimalProductionCSV(fixture);
    const dailySection = csv.slice(csv.indexOf('[DAILY_TOTALS]'));
    // Apr 3 row should have milk filled but feed_kg and feed_cost_php blank
    expect(dailySection).toMatch(/2026-04-03,19\.00,,/);
  });

  it('handles empty records without crashing', () => {
    const fixture = buildFixture({
      records: {
        milking: [],
        weight: [],
        feeding: [],
        health: [],
        ai: [],
        heat: [],
        breeding: [],
        bcs: [],
      },
    });
    const csv = generateAnimalProductionCSV(fixture);
    expect(csv).toContain('[MILKING_RECORDS]');
    expect(csv).toMatch(/milk_total,0\.00/);
    expect(csv).toMatch(/feed_efficiency,0\.000/);
  });
});
