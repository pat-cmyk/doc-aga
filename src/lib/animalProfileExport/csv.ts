/**
 * Animal Profile Export — CSV renderer
 *
 * Produces a single multi-section CSV file that is Excel/Sheets-friendly.
 * Pure function: takes an `AnimalProfileExportData` payload and returns a string.
 *
 * Pattern mirrors `src/lib/exportUtils.ts` (government dashboard CSV) — no new deps.
 */

import type { AnimalProfileExportData } from './types';

/** Escape a CSV cell per RFC 4180. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(cells: unknown[]): string {
  return cells.map(csvCell).join(',');
}

function section(title: string): string {
  return `\n[${title}]`;
}

function formatDateOnly(value: unknown): string {
  if (!value) return '';
  try {
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toISOString().slice(0, 10);
  } catch {
    return String(value);
  }
}

export function generateAnimalProfileCSV(data: AnimalProfileExportData): string {
  const lines: string[] = [];
  const { meta, identity, genealogy, ovr, vitals, costs, records } = data;

  // Header banner
  lines.push('# ANIMAL PROFILE EXPORT');
  lines.push(`# Generated: ${meta.generatedAt}`);
  lines.push(`# Animal: ${identity.name ?? 'Unnamed'} (${identity.ear_tag ?? 'no-tag'})`);
  if (meta.farmName) lines.push(`# Farm: ${meta.farmName}`);
  if (meta.farmerName) lines.push(`# Farmer: ${meta.farmerName}`);
  if (meta.sourceIsOffline) {
    lines.push(`# Source: Offline snapshot (cache last updated ${
      meta.cacheLastUpdated ? new Date(meta.cacheLastUpdated).toISOString() : 'unknown'
    })`);
  }

  // Identity section
  lines.push(section('IDENTITY'));
  lines.push(row(['field', 'value']));
  lines.push(row(['name', identity.name]));
  lines.push(row(['ear_tag', identity.ear_tag]));
  lines.push(row(['gender', identity.gender]));
  lines.push(row(['livestock_type', identity.livestock_type]));
  lines.push(row(['breed', identity.breed]));
  lines.push(row(['birth_date', formatDateOnly(identity.birth_date)]));
  lines.push(row(['life_stage', identity.life_stage]));
  lines.push(row(['milking_stage', identity.milking_stage]));
  lines.push(row(['fertility_status', identity.fertility_status]));
  lines.push(row(['current_weight_kg', identity.current_weight_kg]));
  lines.push(row(['entry_weight_kg', identity.entry_weight_kg]));
  lines.push(row(['farm_entry_date', formatDateOnly(identity.farm_entry_date)]));
  lines.push(row(['acquisition_type', identity.acquisition_type]));
  lines.push(row(['purchase_price_php', identity.purchase_price]));
  lines.push(row(['parity', identity.parity]));

  // Genealogy
  lines.push(section('GENEALOGY'));
  lines.push(row(['field', 'value']));
  lines.push(row(['mother_name', genealogy.motherName]));
  lines.push(row(['mother_ear_tag', genealogy.motherEarTag]));
  lines.push(row(['father_name', genealogy.fatherName]));
  lines.push(row(['father_ear_tag', genealogy.fatherEarTag]));
  lines.push(row(['offspring_count', genealogy.offspringCount]));

  // OVR scores
  lines.push(section('OVR_SCORES'));
  lines.push(row(['axis', 'score_0_100']));
  lines.push(row(['overall', ovr.overall]));
  lines.push(row(['production', ovr.production]));
  lines.push(row(['health', ovr.health]));
  lines.push(row(['fertility', ovr.fertility]));
  lines.push(row(['growth', ovr.growth]));
  lines.push(row(['body_condition', ovr.bodyCondition]));

  // Vitals snapshot
  lines.push(section('VITALS'));
  lines.push(row(['field', 'value']));
  lines.push(row(['current_weight_kg', vitals.currentWeightKg]));
  lines.push(row(['latest_bcs', vitals.latestBCS]));
  lines.push(row(['days_in_milk', vitals.daysInMilk]));
  lines.push(row(['last_heat_date', formatDateOnly(vitals.lastHeatDate)]));
  lines.push(row(['next_vaccine_due', formatDateOnly(vitals.nextVaccineDueDate)]));
  lines.push(row(['immunity_compliance_percent', vitals.immunityCompliancePercent]));
  lines.push(row(['is_pregnant', vitals.isPregnant]));
  lines.push(row(['expected_delivery_date', formatDateOnly(vitals.expectedDeliveryDate)]));
  lines.push(row(['estimated_value_php', vitals.estimatedValuePhp]));
  lines.push(row(['market_price_per_kg', vitals.marketPricePerKg]));

  // Costs summary
  lines.push(section('COSTS_SUMMARY'));
  lines.push(row(['field', 'amount_php']));
  lines.push(row(['purchase_price', costs.purchasePrice]));
  lines.push(row(['manual_expenses', costs.manualExpenses]));
  lines.push(row(['feed_consumption_cost', costs.feedConsumptionCost]));
  lines.push(row(['total_expenses', costs.totalExpenses]));
  lines.push(row(['total_invested', costs.totalInvested]));

  // Cost category breakdown
  lines.push(section('COSTS_BY_CATEGORY'));
  lines.push(row(['category', 'amount_php']));
  for (const cat of costs.categoryBreakdown) {
    lines.push(row([cat.category, cat.amount]));
  }

  // Milking records
  lines.push(section('MILKING_RECORDS'));
  lines.push(row(['date', 'liters', 'session', 'notes']));
  for (const r of records.milking) {
    lines.push(row([
      formatDateOnly(r.record_date),
      r.liters,
      r.session ?? '',
      r.notes ?? '',
    ]));
  }

  // Weight records
  lines.push(section('WEIGHT_RECORDS'));
  lines.push(row(['date', 'weight_kg', 'recorded_by', 'notes']));
  for (const r of records.weight) {
    lines.push(row([
      formatDateOnly(r.measurement_date),
      r.weight_kg,
      r.recorded_by ?? '',
      r.notes ?? '',
    ]));
  }

  // Feeding records
  lines.push(section('FEEDING_RECORDS'));
  lines.push(row(['date', 'feed_type', 'kilograms', 'cost_per_kg_php', 'total_cost_php', 'notes']));
  for (const r of records.feeding) {
    const kg = Number(r.kilograms ?? 0);
    const cpk = Number(r.cost_per_kg_at_time ?? 0);
    lines.push(row([
      formatDateOnly(r.feed_date ?? r.fed_at),
      r.feed_type ?? '',
      kg,
      cpk,
      (kg * cpk).toFixed(2),
      r.notes ?? '',
    ]));
  }

  // Health records
  lines.push(section('HEALTH_RECORDS'));
  lines.push(row(['date', 'visit_type', 'condition', 'treatment', 'vet_name', 'cost_php', 'notes']));
  for (const r of records.health) {
    lines.push(row([
      formatDateOnly(r.visit_date),
      r.visit_type ?? '',
      r.condition_noted ?? '',
      r.treatment_given ?? '',
      r.vet_name ?? '',
      r.cost ?? '',
      r.notes ?? '',
    ]));
  }

  // BCS history
  lines.push(section('BODY_CONDITION_SCORES'));
  lines.push(row(['date', 'score', 'assessor', 'notes']));
  for (const r of records.bcs) {
    lines.push(row([
      formatDateOnly(r.assessment_date),
      r.score,
      r.assessor_id ?? '',
      r.notes ?? '',
    ]));
  }

  // AI records
  lines.push(section('AI_RECORDS'));
  lines.push(row(['scheduled_date', 'performed_date', 'semen_code', 'technician', 'pregnancy_confirmed', 'expected_delivery', 'notes']));
  for (const r of records.ai) {
    lines.push(row([
      formatDateOnly(r.scheduled_date),
      formatDateOnly(r.performed_date),
      r.semen_code ?? '',
      r.technician ?? '',
      r.pregnancy_confirmed ? 'yes' : 'no',
      formatDateOnly(r.expected_delivery_date),
      r.notes ?? '',
    ]));
  }

  // Heat records
  lines.push(section('HEAT_RECORDS'));
  lines.push(row(['detected_at', 'detection_method', 'intensity', 'standing_heat', 'notes']));
  for (const r of records.heat) {
    lines.push(row([
      formatDateOnly(r.detected_at),
      r.detection_method ?? '',
      r.intensity ?? '',
      r.standing_heat ? 'yes' : 'no',
      r.notes ?? '',
    ]));
  }

  // Breeding events
  lines.push(section('BREEDING_EVENTS'));
  lines.push(row(['event_date', 'event_type', 'notes']));
  for (const r of records.breeding) {
    lines.push(row([
      formatDateOnly(r.event_date),
      r.event_type ?? '',
      r.notes ?? '',
    ]));
  }

  return lines.join('\n') + '\n';
}

/**
 * Suggest a filename given the animal identity and format.
 */
export function buildExportFilename(
  identity: { name: string | null; ear_tag: string | null },
  format: 'csv' | 'pdf',
): string {
  const slug = (identity.name ?? identity.ear_tag ?? 'animal')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'animal';
  const stamp = new Date().toISOString().slice(0, 10);
  return `doc-aga-animal-${slug}-${stamp}.${format}`;
}
