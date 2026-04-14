/**
 * govReportCharts.ts — Government-specific chart and visual primitives for
 * PDF reports exported from the government dashboard.
 *
 * Independent module (does NOT import from animalProfileExport/) but follows
 * the same canvas-to-PNG pattern for complex charts and jsPDF drawing helpers
 * for simpler primitives (KPI cards, bars, gauges, sparklines).
 */

import jsPDF from "jspdf";
import { format } from "date-fns";
import type { FullExportData } from "./exportUtils";

// ---------------------------------------------------------------------------
// Color constants
// ---------------------------------------------------------------------------

export const GOV_COLORS = {
  primary:     [13, 122, 61]   as const,
  primarySoft: [220, 240, 228] as const,
  accent:      [204, 133, 0]   as const,
  text:        [33, 37, 41]    as const,
  muted:       [120, 120, 120] as const,
  danger:      [204, 51, 51]   as const,
  cardBg:      [245, 245, 245] as const,
  trackGray:   [229, 231, 235] as const,
  white:       [255, 255, 255] as const,

  // Species colors (matching Recharts in dashboard)
  cattle:  '#3b82f6',
  goat:    '#8b5cf6',
  carabao: '#f59e0b',
  sheep:   '#10b981',

  // Risk / status semantic
  critical: [220, 38, 38]  as const,
  high:     [249, 115, 22] as const,
  moderate: [234, 179, 8]  as const,
  low:      [34, 197, 94]  as const,
};

// Page layout constants
const PAGE_WIDTH = 210; // A4
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 182mm

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KpiCardOptions {
  value: string;
  label: string;
  accentColor?: readonly number[];
  trend?: { direction: 'up' | 'down' | 'flat'; value: string; positive?: boolean };
  width?: number;
  height?: number;
}

export interface HBarChartOptions {
  title?: string;
  items: Array<{ label: string; value: number; color?: readonly number[] }>;
  barHeight?: number;
  labelWidth?: number;
  valueWidth?: number;
}

export interface StackedBarOptions {
  title?: string;
  segments: Array<{ label: string; value: number; color: readonly number[] }>;
  barHeight?: number;
  showLegend?: boolean;
  showValues?: boolean;
}

export interface ProgressGaugeOptions {
  label: string;
  current: number;
  total: number;
  color?: readonly number[];
  height?: number;
}

export interface GovChartSeries {
  label: string;
  points: Array<{ date: string; value: number }>;
  color: string;
  fill?: string;
}

export interface GovChartOptions {
  title?: string;
  yLabel?: string;
  width?: number;
  height?: number;
}

export interface BarGroup {
  label: string;
  bars: Array<{ value: number; color: string; label?: string }>;
}

// ---------------------------------------------------------------------------
// 1. ensureSpace — page-break guard
// ---------------------------------------------------------------------------

export function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 15) {
    doc.addPage();
    return 18;
  }
  return y;
}

// ---------------------------------------------------------------------------
// 2. drawSectionHeader
// ---------------------------------------------------------------------------

export function drawSectionHeader(
  doc: jsPDF,
  y: number,
  title: string,
  subtitle?: string,
): number {
  doc.setFillColor(...GOV_COLORS.primary);
  doc.rect(0, y, PAGE_WIDTH, 10, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(title, MARGIN, y + 7);

  if (subtitle) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text(subtitle, PAGE_WIDTH - MARGIN, y + 7, { align: 'right' });
  }

  // Reset
  doc.setTextColor(...GOV_COLORS.text);
  doc.setFont('helvetica', 'normal');
  return y + 14;
}

// ---------------------------------------------------------------------------
// 3. drawKpiCard
// ---------------------------------------------------------------------------

export function drawKpiCard(
  doc: jsPDF,
  x: number,
  y: number,
  opts: KpiCardOptions,
): number {
  const w = opts.width ?? 56;
  const h = opts.height ?? 26;
  const accent = opts.accentColor ?? GOV_COLORS.primary;

  // Card background
  doc.setFillColor(...GOV_COLORS.cardBg);
  doc.roundedRect(x, y, w, h, 2, 2, 'F');

  // Left accent bar
  doc.setFillColor(...(accent as [number, number, number]));
  doc.rect(x, y + 1, 3, h - 2, 'F');

  // Big number — auto-size font to fit card width
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOV_COLORS.text);
  const maxTextWidth = w - 12; // 8mm left padding + 4mm right margin
  let fontSize = 20;
  doc.setFontSize(fontSize);
  while (fontSize > 10 && doc.getTextWidth(opts.value) > maxTextWidth) {
    fontSize -= 1;
    doc.setFontSize(fontSize);
  }
  doc.text(opts.value, x + 8, y + 12);

  // Label
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GOV_COLORS.muted);
  doc.text(opts.label, x + 8, y + 17);

  // Trend arrow
  if (opts.trend) {
    const arrow = opts.trend.direction === 'up' ? '\u25B2'
                : opts.trend.direction === 'down' ? '\u25BC'
                : '\u2013'; // flat = en-dash
    const trendColor = opts.trend.positive ? GOV_COLORS.low : GOV_COLORS.danger;
    doc.setFontSize(7);
    doc.setTextColor(...(trendColor as [number, number, number]));
    doc.text(`${arrow} ${opts.trend.value}`, x + 8, y + 22);
  }

  // Reset
  doc.setTextColor(...GOV_COLORS.text);
  doc.setFont('helvetica', 'normal');
  return h;
}

// ---------------------------------------------------------------------------
// 4. drawKpiRow
// ---------------------------------------------------------------------------

export function drawKpiRow(
  doc: jsPDF,
  y: number,
  cards: KpiCardOptions[],
  margin?: number,
): number {
  const m = margin ?? MARGIN;
  const gap = 4;
  const cardW = (CONTENT_WIDTH - (cards.length - 1) * gap) / cards.length;
  let maxH = 0;

  cards.forEach((card, i) => {
    const cx = m + i * (cardW + gap);
    const h = drawKpiCard(doc, cx, y, { ...card, width: cardW });
    if (h > maxH) maxH = h;
  });

  return y + maxH + 6;
}

// ---------------------------------------------------------------------------
// 5. drawHorizontalBarChart
// ---------------------------------------------------------------------------

export function drawHorizontalBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  opts: HBarChartOptions,
): number {
  const barH = opts.barHeight ?? 6;
  const labelW = opts.labelWidth ?? 35;
  const valueW = opts.valueWidth ?? 18;
  const barW = CONTENT_WIDTH - labelW - valueW;

  if (opts.title) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...GOV_COLORS.text);
    doc.text(opts.title, x, y + 3);
    y += 5;
  }

  if (!opts.items || opts.items.length === 0) {
    doc.setTextColor(...GOV_COLORS.text);
    return y + 4;
  }

  const maxVal = Math.max(...opts.items.map((it) => it.value), 1);

  for (const item of opts.items) {
    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GOV_COLORS.text);
    doc.text(item.label, x, y + barH * 0.7);

    // Track
    doc.setFillColor(...GOV_COLORS.trackGray);
    doc.roundedRect(x + labelW, y, barW, barH, 1.5, 1.5, 'F');

    // Data bar
    const fillW = Math.max(0, barW * (item.value / maxVal));
    if (fillW > 0) {
      const c = item.color ?? GOV_COLORS.primary;
      doc.setFillColor(...(c as [number, number, number]));
      doc.roundedRect(x + labelW, y, fillW, barH, 1.5, 1.5, 'F');
    }

    // Value text
    doc.setFontSize(8);
    doc.text(String(item.value), x + CONTENT_WIDTH - 2, y + barH * 0.7, { align: 'right' });

    y += barH + 2;
  }

  doc.setTextColor(...GOV_COLORS.text);
  return y + 4;
}

// ---------------------------------------------------------------------------
// 6. drawStackedBar
// ---------------------------------------------------------------------------

export function drawStackedBar(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  opts: StackedBarOptions,
): number {
  const barH = opts.barHeight ?? 8;
  const showLegend = opts.showLegend ?? true;
  const showValues = opts.showValues ?? true;

  if (opts.title) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...GOV_COLORS.text);
    doc.text(opts.title, x, y + 3);
    y += 5;
  }

  const total = opts.segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    doc.setTextColor(...GOV_COLORS.text);
    return y + 4;
  }

  let sx = x;
  for (const seg of opts.segments) {
    const segW = width * (seg.value / total);
    if (segW <= 0) continue;
    doc.setFillColor(...(seg.color as [number, number, number]));
    doc.rect(sx, y, segW, barH, 'F');

    if (showValues && segW > 10) {
      doc.setFontSize(6);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(String(seg.value), sx + segW / 2, y + barH / 2 + 1, { align: 'center' });
    }

    sx += segW;
  }

  y += barH + 2;

  // Legend
  if (showLegend) {
    let lx = x;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    for (const seg of opts.segments) {
      doc.setFillColor(...(seg.color as [number, number, number]));
      doc.rect(lx, y, 3, 3, 'F');
      doc.setTextColor(...GOV_COLORS.text);
      const legendText = showValues ? `${seg.label} (${seg.value})` : seg.label;
      doc.text(legendText, lx + 4.5, y + 2.5);
      lx += doc.getTextWidth(legendText) + 8;
    }
    y += 6;
  }

  doc.setTextColor(...GOV_COLORS.text);
  return y + 4;
}

// ---------------------------------------------------------------------------
// 7. drawProgressGauge
// ---------------------------------------------------------------------------

export function drawProgressGauge(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  opts: ProgressGaugeOptions,
): number {
  const h = opts.height ?? 5;
  const color = opts.color ?? GOV_COLORS.primary;
  const ratio = opts.total > 0 ? Math.min(opts.current / opts.total, 1) : 0;
  const trackX = x + 50;
  const trackW = width - 50 - 20;

  // Label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GOV_COLORS.text);
  doc.text(opts.label, x, y + 3);

  // Track
  doc.setFillColor(...GOV_COLORS.trackGray);
  doc.roundedRect(trackX, y, trackW, h, 2, 2, 'F');

  // Fill
  const fillW = trackW * ratio;
  if (fillW > 0) {
    doc.setFillColor(...(color as [number, number, number]));
    doc.roundedRect(trackX, y, fillW, h, 2, 2, 'F');
  }

  // Percentage
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOV_COLORS.text);
  doc.text(`${Math.round(ratio * 100)}%`, x + width - 2, y + 3.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GOV_COLORS.text);
  return y + h + 4;
}

// ---------------------------------------------------------------------------
// 8. drawMiniSparkline
// ---------------------------------------------------------------------------

export function drawMiniSparkline(
  doc: jsPDF,
  x: number,
  y: number,
  values: number[],
  opts?: { width?: number; height?: number; color?: readonly number[] },
): void {
  const w = opts?.width ?? 50;
  const h = opts?.height ?? 12;
  const color = opts?.color ?? GOV_COLORS.primary;

  if (!values || values.length < 2) return;

  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const coords = values.map((v, i) => ({
    px: x + (i / (values.length - 1)) * w,
    py: y + h - ((v - minV) / range) * h,
  }));

  doc.setDrawColor(...(color as [number, number, number]));
  doc.setLineWidth(0.4);

  for (let i = 1; i < coords.length; i++) {
    doc.line(coords[i - 1].px, coords[i - 1].py, coords[i].px, coords[i].py);
  }

  // End-cap dot
  const last = coords[coords.length - 1];
  doc.setFillColor(...(color as [number, number, number]));
  doc.circle(last.px, last.py, 1, 'F');

  // Reset draw color
  doc.setDrawColor(0, 0, 0);
  doc.setTextColor(...GOV_COLORS.text);
}

// ---------------------------------------------------------------------------
// 9a. govTrendChartToPng — multi-series line / area chart via offscreen canvas
// ---------------------------------------------------------------------------

export function govTrendChartToPng(
  series: GovChartSeries[],
  opts?: GovChartOptions,
): string | null {
  if (typeof document === 'undefined') return null;
  const nonEmpty = series.filter((s) => s.points && s.points.length > 0);
  if (nonEmpty.length === 0) return null;

  const W = opts?.width ?? 720;
  const H = opts?.height ?? 320;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Plot area
  const padL = 52;
  const padR = 16;
  const padT = opts?.title ? 28 : 12;
  const hasLegend = nonEmpty.length > 0;
  const padB = hasLegend ? 60 : 44;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Collect data bounds
  const allPts = nonEmpty.flatMap((s) => s.points);
  const allVals = allPts.map((p) => Number(p.value) || 0);
  const allDates = allPts.map((p) => p.date).sort();
  const minV = Math.min(0, ...allVals);
  const maxV = Math.max(...allVals, 1);
  const vRange = maxV - minV || 1;
  const firstT = new Date(allDates[0]).getTime();
  const lastT = new Date(allDates[allDates.length - 1]).getTime();
  const tRange = Math.max(1, lastT - firstT);

  const toX = (iso: string) => {
    const t = new Date(iso).getTime();
    return tRange === 0 ? padL + plotW / 2 : padL + ((t - firstT) / tRange) * plotW;
  };
  const toY = (v: number) => padT + plotH - ((v - minV) / vRange) * plotH;

  // Gridlines + y-axis ticks
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#6b7280';
  ctx.font = '10px -apple-system, Helvetica, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const v = minV + (vRange * i) / 4;
    const py = toY(v);
    ctx.beginPath();
    ctx.moveTo(padL, py);
    ctx.lineTo(padL + plotW, py);
    ctx.stroke();
    ctx.fillText(fmtTick(v), padL - 6, py);
  }

  // X-axis labels (up to 6)
  const uniq = Array.from(new Set(allDates)).sort();
  const xCount = Math.min(6, uniq.length);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#6b7280';
  for (let i = 0; i < xCount; i++) {
    const idx = Math.floor((i * (uniq.length - 1)) / Math.max(1, xCount - 1));
    const iso = uniq[idx];
    try {
      ctx.fillText(format(new Date(iso), 'MMM d'), toX(iso), padT + plotH + 6);
    } catch {
      ctx.fillText(iso.slice(5, 10), toX(iso), padT + plotH + 6);
    }
  }

  // Draw series (area fills first, then lines)
  for (const s of nonEmpty) {
    const sorted = [...s.points].sort((a, b) => a.date.localeCompare(b.date));
    if (s.fill) {
      ctx.beginPath();
      ctx.moveTo(toX(sorted[0].date), toY(0));
      for (const p of sorted) ctx.lineTo(toX(p.date), toY(Number(p.value) || 0));
      ctx.lineTo(toX(sorted[sorted.length - 1].date), toY(0));
      ctx.closePath();
      ctx.fillStyle = s.fill;
      ctx.fill();
    }
  }
  for (const s of nonEmpty) {
    const sorted = [...s.points].sort((a, b) => a.date.localeCompare(b.date));
    ctx.beginPath();
    sorted.forEach((p, i) => {
      const px = toX(p.date);
      const py = toY(Number(p.value) || 0);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // End-cap dot
    const last = sorted[sorted.length - 1];
    ctx.beginPath();
    ctx.arc(toX(last.date), toY(Number(last.value) || 0), 3, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
  }

  // Title
  if (opts?.title) {
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 14px -apple-system, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(opts.title, W / 2, 8);
  }

  // Y-axis label
  if (opts?.yLabel) {
    ctx.save();
    ctx.translate(14, padT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#374151';
    ctx.font = '11px -apple-system, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.yLabel, 0, 0);
    ctx.restore();
  }

  // Legend
  if (hasLegend) {
    const legendY = H - 14;
    let lx = padL;
    ctx.font = '11px -apple-system, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const s of nonEmpty) {
      ctx.fillStyle = s.color;
      ctx.fillRect(lx, legendY - 5, 12, 3);
      ctx.fillStyle = '#374151';
      ctx.fillText(s.label, lx + 16, legendY);
      lx += ctx.measureText(s.label).width + 32;
    }
  }

  try {
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('[govReportCharts] toDataURL failed', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 9b. govGroupedBarChartToPng — grouped vertical bar chart via offscreen canvas
// ---------------------------------------------------------------------------

export function govGroupedBarChartToPng(
  groups: BarGroup[],
  opts?: GovChartOptions,
): string | null {
  if (typeof document === 'undefined') return null;
  if (!groups || groups.length === 0) return null;

  const W = opts?.width ?? 720;
  const H = opts?.height ?? 320;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const padL = 52;
  const padR = 16;
  const padT = opts?.title ? 28 : 12;
  const allBars = groups.flatMap((g) => g.bars);
  const uniqueLabels = Array.from(new Set(allBars.filter((b) => b.label).map((b) => b.label!)));
  const hasLegend = uniqueLabels.length > 0;
  const padB = hasLegend ? 60 : 44;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxVal = Math.max(...allBars.map((b) => b.value), 1);

  // Y-axis gridlines
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#6b7280';
  ctx.font = '10px -apple-system, Helvetica, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const v = (maxVal * i) / 4;
    const py = padT + plotH - (v / maxVal) * plotH;
    ctx.beginPath();
    ctx.moveTo(padL, py);
    ctx.lineTo(padL + plotW, py);
    ctx.stroke();
    ctx.fillText(fmtTick(v), padL - 6, py);
  }

  // Draw grouped bars
  const groupW = plotW / groups.length;
  const maxBarsPerGroup = Math.max(...groups.map((g) => g.bars.length), 1);
  const barPad = 4;
  const clusterW = groupW - barPad * 2;
  const singleBarW = Math.min(clusterW / maxBarsPerGroup, 30);

  groups.forEach((group, gi) => {
    const gx = padL + gi * groupW;
    const clusterStart = gx + (groupW - singleBarW * group.bars.length) / 2;

    group.bars.forEach((bar, bi) => {
      const bx = clusterStart + bi * singleBarW;
      const bh = (bar.value / maxVal) * plotH;
      const by = padT + plotH - bh;

      ctx.fillStyle = bar.color;
      ctx.fillRect(bx + 1, by, singleBarW - 2, bh);
    });

    // X-axis label
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px -apple-system, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(group.label, gx + groupW / 2, padT + plotH + 6);
  });

  // Title
  if (opts?.title) {
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 14px -apple-system, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(opts.title, W / 2, 8);
  }

  // Y-axis label
  if (opts?.yLabel) {
    ctx.save();
    ctx.translate(14, padT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#374151';
    ctx.font = '11px -apple-system, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.yLabel, 0, 0);
    ctx.restore();
  }

  // Legend
  if (hasLegend) {
    const legendY = H - 14;
    let lx = padL;
    ctx.font = '11px -apple-system, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const lbl of uniqueLabels) {
      const matchBar = allBars.find((b) => b.label === lbl);
      if (!matchBar) continue;
      ctx.fillStyle = matchBar.color;
      ctx.fillRect(lx, legendY - 5, 12, 3);
      ctx.fillStyle = '#374151';
      ctx.fillText(lbl, lx + 16, legendY);
      lx += ctx.measureText(lbl).width + 32;
    }
  }

  try {
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('[govReportCharts] grouped bar toDataURL failed', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 10. generateExecutiveSummary
// ---------------------------------------------------------------------------

export function generateExecutiveSummary(data: FullExportData): string {
  const sentences: string[] = [];

  if (data.stats) {
    const animals = data.stats.active_animal_count ?? 0;
    const farms = data.stats.farm_count ?? 0;
    sentences.push(
      `The region monitors ${animals.toLocaleString()} active animals across ${farms.toLocaleString()} farms.`,
    );

    const growth = data.stats.farmGrowth;
    if (typeof growth === 'number') {
      if (growth > 5) {
        sentences.push(`Farm registrations grew ${growth.toFixed(1)}% over the period.`);
      } else if (growth < -5) {
        sentences.push(`Farm registrations declined ${Math.abs(growth).toFixed(1)}% over the period.`);
      }
    }
  }

  if (data.healthStats) {
    const rate = data.healthStats.vaccination_compliance_rate;
    if (typeof rate === 'number') {
      if (rate >= 80) {
        sentences.push(`Vaccination compliance is at ${rate.toFixed(0)}%, above the 80% target.`);
      } else {
        sentences.push(
          `Vaccination compliance is at ${rate.toFixed(0)}%, below the 80% target and requires attention.`,
        );
      }
    }
  }

  if (data.feedSecurity) {
    const pct = data.feedSecurity.overallCriticalPercentage;
    if (typeof pct === 'number' && pct > 10) {
      sentences.push(
        `Feed security requires attention with ${pct.toFixed(0)}% of farms in critical status.`,
      );
    }
  }

  return sentences.slice(0, 3).join(' ');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function fmtTick(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (abs >= 100) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(1);
  return v.toFixed(2);
}
