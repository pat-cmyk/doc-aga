/**
 * csv.test.ts — deterministic unit tests for the animal profile CSV renderer.
 *
 * Strategy: build a fixture AnimalProfileExportData by hand, run the
 * generator, and assert on key lines (section headers, identity fields,
 * record rows, escaping). Avoids full snapshot to stay resilient to
 * cosmetic changes while still catching structural regressions.
 */
import { describe, it, expect } from 'vitest';
import { generateAnimalProfileCSV, buildExportFilename } from '../csv';
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
      motherName: 'Lola',
      motherEarTag: 'ET-M1',
      fatherName: 'Bantay',
      fatherEarTag: 'ET-F1',
      offspringCount: 2,
    },
    ovr: {
      overall: 78,
      production: 82,
      health: 90,
      fertility: 65,
      growth: 75,
      bodyCondition: 80,
    },
    vitals: {
      currentWeightKg: 520,
      latestBCS: 3.5,
      daysInMilk: 95,
      lastHeatDate: '2026-03-20',
      nextVaccineDueDate: '2026-04-20',
      immunityCompliancePercent: 100,
      estimatedValuePhp: 156000,
      marketPricePerKg: 300,
      isPregnant: false,
      expectedDeliveryDate: null,
    },
    costs: {
      purchasePrice: 80000,
      manualExpenses: 4500,
      feedConsumptionCost: 12500,
      totalExpenses: 17000,
      totalInvested: 97000,
      categoryBreakdown: [
        { category: 'veterinary', amount: 3000 },
        { category: 'medicine', amount: 1500 },
      ],
    },
    records: {
      milking: [
        { record_date: '2026-04-01', liters: 22.5, session: 'AM', notes: 'normal' },
        { record_date: '2026-03-31', liters: 21.0, session: 'PM', notes: null },
      ],
      weight: [
        { measurement_date: '2026-03-15', weight_kg: 520, recorded_by: 'user1', notes: null },
      ],
      feeding: [
        {
          feed_date: '2026-04-01',
          feed_type: 'napier',
          kilograms: 25,
          cost_per_kg_at_time: 12,
          notes: 'morning',
        },
      ],
      health: [
        {
          visit_date: '2026-03-05',
          visit_type: 'vaccination',
          condition_noted: 'FMD booster',
          treatment_given: 'FMD vaccine 2ml',
          vet_name: 'Dr. Santos',
          cost: 500,
          notes: null,
        },
      ],
      bcs: [{ assessment_date: '2026-03-20', score: 3.5, assessor_id: 'u1', notes: null }],
      ai: [
        {
          scheduled_date: '2026-03-01',
          performed_date: '2026-03-02',
          semen_code: 'H-1234',
          technician: 'Ariel',
          pregnancy_confirmed: false,
          expected_delivery_date: null,
          notes: null,
        },
      ],
      heat: [
        {
          detected_at: '2026-02-28',
          detection_method: 'visual',
          intensity: 'strong',
          standing_heat: true,
          notes: 'clear signs',
        },
      ],
      breeding: [
        { event_date: '2026-03-02', event_type: 'ai_performed', notes: null },
      ],
    },
    sparklines: { weight: [], bcs: [], milk: [] },
    ...overrides,
  };
}

describe('generateAnimalProfileCSV', () => {
  it('emits banner with animal name, ear tag, farm, and farmer', () => {
    const csv = generateAnimalProfileCSV(buildFixture());
    expect(csv).toContain('# ANIMAL PROFILE EXPORT');
    expect(csv).toContain('# Animal: Bessie (ET-001)');
    expect(csv).toContain('# Farm: Bukid ni Mang Juan');
    expect(csv).toContain('# Farmer: Juan Dela Cruz');
  });

  it('includes every major section header', () => {
    const csv = generateAnimalProfileCSV(buildFixture());
    const required = [
      '[IDENTITY]',
      '[GENEALOGY]',
      '[OVR_SCORES]',
      '[VITALS]',
      '[COSTS_SUMMARY]',
      '[COSTS_BY_CATEGORY]',
      '[MILKING_RECORDS]',
      '[WEIGHT_RECORDS]',
      '[FEEDING_RECORDS]',
      '[HEALTH_RECORDS]',
      '[BODY_CONDITION_SCORES]',
      '[AI_RECORDS]',
      '[HEAT_RECORDS]',
      '[BREEDING_EVENTS]',
    ];
    for (const header of required) {
      expect(csv).toContain(header);
    }
  });

  it('writes identity and cost values correctly', () => {
    const csv = generateAnimalProfileCSV(buildFixture());
    expect(csv).toMatch(/name,Bessie/);
    expect(csv).toMatch(/ear_tag,ET-001/);
    expect(csv).toMatch(/breed,Holstein/);
    expect(csv).toMatch(/purchase_price,80000/);
    expect(csv).toMatch(/total_invested,97000/);
  });

  it('computes feeding total cost (kg * cost_per_kg)', () => {
    const csv = generateAnimalProfileCSV(buildFixture());
    // 25 * 12 = 300.00
    expect(csv).toMatch(/2026-04-01,napier,25,12,300\.00,morning/);
  });

  it('formats booleans as yes/no in AI and heat rows', () => {
    const csv = generateAnimalProfileCSV(buildFixture());
    expect(csv).toMatch(/H-1234,Ariel,no/);
    expect(csv).toMatch(/visual,strong,yes/);
  });

  it('emits offline snapshot banner when meta.sourceIsOffline', () => {
    const fixture = buildFixture({
      meta: {
        generatedAt: '2026-04-05T08:30:00.000Z',
        sourceIsOffline: true,
        cacheLastUpdated: 1_712_000_000_000,
        farmName: null,
        farmerName: null,
      },
    });
    const csv = generateAnimalProfileCSV(fixture);
    expect(csv).toContain('# Source: Offline snapshot');
  });

  it('escapes cells containing commas, quotes, and newlines (RFC 4180)', () => {
    const fixture = buildFixture({
      records: {
        ...buildFixture().records,
        health: [
          {
            visit_date: '2026-03-05',
            visit_type: 'checkup',
            condition_noted: 'cough, mild',
            treatment_given: 'rest "observe"',
            vet_name: 'Dr.\nSantos',
            cost: 0,
            notes: null,
          },
        ],
      },
    });
    const csv = generateAnimalProfileCSV(fixture);
    expect(csv).toContain('"cough, mild"');
    expect(csv).toContain('"rest ""observe"""');
    expect(csv).toContain('"Dr.\nSantos"');
  });

  it('handles empty record arrays without crashing and keeps section headers', () => {
    const fixture = buildFixture({
      records: {
        milking: [],
        weight: [],
        feeding: [],
        health: [],
        bcs: [],
        ai: [],
        heat: [],
        breeding: [],
      },
    });
    const csv = generateAnimalProfileCSV(fixture);
    expect(csv).toContain('[MILKING_RECORDS]');
    expect(csv).toContain('[HEAT_RECORDS]');
    // Only the header row should appear inside an empty section
    const milkingSection = csv.slice(
      csv.indexOf('[MILKING_RECORDS]'),
      csv.indexOf('[WEIGHT_RECORDS]'),
    );
    expect(milkingSection).toContain('date,liters,session,notes');
    expect(milkingSection.trim().split('\n').length).toBe(2); // header line + column headings
  });
});

describe('buildExportFilename', () => {
  it('uses the animal name when available', () => {
    const name = buildExportFilename({ name: 'Bessie', ear_tag: 'ET-001' }, 'pdf');
    expect(name).toMatch(/^doc-aga-animal-bessie-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('falls back to ear tag when name is missing', () => {
    const name = buildExportFilename({ name: null, ear_tag: 'ET-XYZ' }, 'csv');
    expect(name).toMatch(/^doc-aga-animal-et-xyz-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('slugifies names with spaces and punctuation', () => {
    const name = buildExportFilename(
      { name: "Mang Juan's Cow!!", ear_tag: null },
      'pdf',
    );
    expect(name).toMatch(/^doc-aga-animal-mang-juan-s-cow-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('falls back to generic "animal" when both name and ear tag are missing', () => {
    const name = buildExportFilename({ name: null, ear_tag: null }, 'csv');
    expect(name).toMatch(/^doc-aga-animal-animal-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
