/**
 * productionCsv.ts — focused production CSV (milk + feed only).
 *
 * A narrower variant of the full animal profile CSV for farmers/vets who
 * only want the raw numbers behind the production trend chart. Contains:
 *
 *   - Banner + animal identity (short)
 *   - [PRODUCTION_SUMMARY] aggregated stats (totals, averages, efficiency)
 *   - [MILKING_RECORDS] every row
 *   - [FEEDING_RECORDS] every row (with computed total cost per row)
 *   - [DAILY_TOTALS] joined table: date | milk_liters | feed_kg | feed_cost
 *     so the reader can spot trends without importing the whole profile.
 */

import type { AnimalProfileExportData } from './types';

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

export function generateAnimalProductionCSV(data: AnimalProfileExportData): string {
  const lines: string[] = [];
  const { meta, identity, records } = data;

  // ---------- BANNER ----------
  lines.push('# ANIMAL PRODUCTION REPORT');
  lines.push(`# Generated: ${meta.generatedAt}`);
  lines.push(`# Animal: ${identity.name ?? 'Unnamed'} (${identity.ear_tag ?? 'no-tag'})`);
  if (identity.breed) lines.push(`# Breed: ${identity.breed}`);
  if (identity.livestock_type) lines.push(`# Species: ${identity.livestock_type}`);
  if (meta.farmName) lines.push(`# Farm: ${meta.farmName}`);
  if (meta.farmerName) lines.push(`# Farmer: ${meta.farmerName}`);
  if (meta.sourceIsOffline) {
    lines.push(
      `# Source: Offline snapshot (cache last updated ${
        meta.cacheLastUpdated ? new Date(meta.cacheLastUpdated).toISOString() : 'unknown'
      })`,
    );
  }

  // ---------- AGGREGATE ----------
  // Aggregate daily — feeding can have multiple rows per day, milking usually 1-3.
  const milkByDate = new Map<string, number>();
  for (const r of records.milking) {
    const iso = formatDateOnly((r as { record_date?: string }).record_date);
    if (!iso) continue;
    const liters = Number((r as { liters?: number }).liters ?? 0);
    milkByDate.set(iso, (milkByDate.get(iso) ?? 0) + liters);
  }

  const feedKgByDate = new Map<string, number>();
  const feedCostByDate = new Map<string, number>();
  for (const r of records.feeding) {
    const iso = formatDateOnly(
      (r as { feed_date?: string }).feed_date ??
        (r as { fed_at?: string }).fed_at,
    );
    if (!iso) continue;
    const kg = Number((r as { kilograms?: number }).kilograms ?? 0);
    const cpk = Number((r as { cost_per_kg_at_time?: number }).cost_per_kg_at_time ?? 0);
    feedKgByDate.set(iso, (feedKgByDate.get(iso) ?? 0) + kg);
    feedCostByDate.set(iso, (feedCostByDate.get(iso) ?? 0) + kg * cpk);
  }

  const milkTotal = Array.from(milkByDate.values()).reduce((s, v) => s + v, 0);
  const feedTotalKg = Array.from(feedKgByDate.values()).reduce((s, v) => s + v, 0);
  const feedTotalCost = Array.from(feedCostByDate.values()).reduce((s, v) => s + v, 0);
  const milkDays = milkByDate.size;
  const feedDays = feedKgByDate.size;
  const milkAvg = milkDays > 0 ? milkTotal / milkDays : 0;
  const feedAvg = feedDays > 0 ? feedTotalKg / feedDays : 0;
  const feedEfficiency = feedTotalKg > 0 ? milkTotal / feedTotalKg : 0;

  lines.push(section('PRODUCTION_SUMMARY'));
  lines.push(row(['metric', 'value', 'unit']));
  lines.push(row(['milk_days', milkDays, 'days']));
  lines.push(row(['milk_total', milkTotal.toFixed(2), 'liters']));
  lines.push(row(['milk_avg_per_day', milkAvg.toFixed(2), 'liters']));
  lines.push(row(['feed_days', feedDays, 'days']));
  lines.push(row(['feed_total', feedTotalKg.toFixed(2), 'kg']));
  lines.push(row(['feed_avg_per_day', feedAvg.toFixed(2), 'kg']));
  lines.push(row(['feed_total_cost', feedTotalCost.toFixed(2), 'php']));
  lines.push(row(['feed_efficiency', feedEfficiency.toFixed(3), 'liters_milk_per_kg_feed']));

  // ---------- MILKING ROWS ----------
  lines.push(section('MILKING_RECORDS'));
  lines.push(row(['date', 'liters', 'session', 'notes']));
  for (const r of records.milking) {
    lines.push(
      row([
        formatDateOnly((r as { record_date?: string }).record_date),
        Number((r as { liters?: number }).liters ?? 0),
        (r as { session?: string }).session ?? '',
        (r as { notes?: string }).notes ?? '',
      ]),
    );
  }

  // ---------- FEEDING ROWS ----------
  lines.push(section('FEEDING_RECORDS'));
  lines.push(
    row(['date', 'feed_type', 'kilograms', 'cost_per_kg_php', 'total_cost_php', 'notes']),
  );
  for (const r of records.feeding) {
    const kg = Number((r as { kilograms?: number }).kilograms ?? 0);
    const cpk = Number((r as { cost_per_kg_at_time?: number }).cost_per_kg_at_time ?? 0);
    lines.push(
      row([
        formatDateOnly(
          (r as { feed_date?: string }).feed_date ??
            (r as { fed_at?: string }).fed_at,
        ),
        (r as { feed_type?: string }).feed_type ?? '',
        kg,
        cpk,
        (kg * cpk).toFixed(2),
        (r as { notes?: string }).notes ?? '',
      ]),
    );
  }

  // ---------- DAILY JOINED TOTALS ----------
  // Union of milk + feed dates so the reader can see production and input
  // on the same day side-by-side. Gaps are blank, not 0, so they don't
  // distort averages computed in Excel.
  const allDates = new Set<string>();
  for (const k of milkByDate.keys()) allDates.add(k);
  for (const k of feedKgByDate.keys()) allDates.add(k);
  const sortedDates = Array.from(allDates).sort();

  lines.push(section('DAILY_TOTALS'));
  lines.push(row(['date', 'milk_liters', 'feed_kg', 'feed_cost_php']));
  for (const d of sortedDates) {
    const milk = milkByDate.get(d);
    const kg = feedKgByDate.get(d);
    const cost = feedCostByDate.get(d);
    lines.push(
      row([
        d,
        milk != null ? milk.toFixed(2) : '',
        kg != null ? kg.toFixed(2) : '',
        cost != null ? cost.toFixed(2) : '',
      ]),
    );
  }

  return lines.join('\n') + '\n';
}
