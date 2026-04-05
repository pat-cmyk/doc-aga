/**
 * chart.ts — labeled line-chart canvas helper for PDF embeds.
 *
 * A step up from `sparkline.ts` (which is unlabeled, minimal, for overview
 * pages). This helper draws proper axes, tick labels, an optional title,
 * gridlines, and supports 1 or 2 data series on the same chart (for the
 * production report's "milk vs feed" combined view).
 *
 * Pure client-side: uses an offscreen 2D canvas and returns a PNG data URL
 * suitable for `doc.addImage(..., 'PNG')`. No external deps.
 */

export interface ChartPoint {
  date: string; // ISO yyyy-mm-dd
  value: number;
}

export interface ChartSeries {
  label: string;
  points: ChartPoint[];
  color: string; // hex like "#0d7a3d"
  fill?: string; // rgba() for area under line
}

export interface ChartOptions {
  width?: number;
  height?: number;
  title?: string;
  yLabel?: string;
  xLabel?: string;
  background?: string;
  showLegend?: boolean;
  /** Force shared Y-axis across series. Default true. */
  sharedYAxis?: boolean;
}

const DEFAULTS: Required<Omit<ChartOptions, 'title' | 'yLabel' | 'xLabel'>> & {
  title: string;
  yLabel: string;
  xLabel: string;
} = {
  width: 720,
  height: 320,
  title: '',
  yLabel: '',
  xLabel: '',
  background: '#ffffff',
  showLegend: true,
  sharedYAxis: true,
};

/**
 * Render a line chart to a PNG data URL. Returns null if canvas is
 * unavailable or every series is empty.
 */
export function lineChartToPngDataUrl(
  series: ChartSeries[],
  options: ChartOptions = {},
): string | null {
  if (typeof document === 'undefined') return null;
  const nonEmpty = series.filter((s) => s.points && s.points.length > 0);
  if (nonEmpty.length === 0) return null;

  const opts = { ...DEFAULTS, ...options };
  const canvas = document.createElement('canvas');
  canvas.width = opts.width;
  canvas.height = opts.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background
  ctx.fillStyle = opts.background;
  ctx.fillRect(0, 0, opts.width, opts.height);

  // Layout metrics
  const padL = 52;
  const padR = 16;
  const padT = opts.title ? 28 : 12;
  const padB = 44 + (opts.showLegend && nonEmpty.length > 0 ? 16 : 0);
  const plotW = opts.width - padL - padR;
  const plotH = opts.height - padT - padB;

  // Title
  if (opts.title) {
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 14px -apple-system, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(opts.title, padL, 8);
  }

  // Collect all points across series for axis scaling
  const allPoints = nonEmpty.flatMap((s) => s.points);
  const allValues = allPoints.map((p) => Number(p.value) || 0);
  const allDates = allPoints.map((p) => p.date).sort();

  const minV = Math.min(0, ...allValues); // anchor y=0 so bars/areas read naturally
  const maxV = Math.max(...allValues, 1);
  const vRange = maxV - minV || 1;

  const firstDate = new Date(allDates[0]).getTime();
  const lastDate = new Date(allDates[allDates.length - 1]).getTime();
  const dateRange = Math.max(1, lastDate - firstDate);

  const toX = (iso: string) => {
    const t = new Date(iso).getTime();
    if (dateRange === 0) return padL + plotW / 2;
    return padL + ((t - firstDate) / dateRange) * plotW;
  };
  const toY = (v: number) => padT + plotH - ((v - minV) / vRange) * plotH;

  // Gridlines + Y tick labels (4 horizontal lines)
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#6b7280';
  ctx.font = '10px -apple-system, Helvetica, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const v = minV + (vRange * i) / yTicks;
    const y = toY(v);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + plotW, y);
    ctx.stroke();
    ctx.fillText(formatTick(v), padL - 6, y);
  }

  // X tick labels (up to 6, evenly spaced by index of sorted unique dates)
  const uniqDates = Array.from(new Set(allDates)).sort();
  const xTickCount = Math.min(6, uniqDates.length);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#6b7280';
  for (let i = 0; i < xTickCount; i++) {
    const idx = Math.floor((i * (uniqDates.length - 1)) / Math.max(1, xTickCount - 1));
    const iso = uniqDates[idx];
    const x = toX(iso);
    ctx.beginPath();
    ctx.moveTo(x, padT + plotH);
    ctx.lineTo(x, padT + plotH + 3);
    ctx.strokeStyle = '#9ca3af';
    ctx.stroke();
    ctx.fillText(shortDate(iso), x, padT + plotH + 6);
  }

  // Axis labels
  if (opts.yLabel) {
    ctx.save();
    ctx.translate(14, padT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#374151';
    ctx.font = '11px -apple-system, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.yLabel, 0, 0);
    ctx.restore();
  }
  if (opts.xLabel) {
    ctx.fillStyle = '#374151';
    ctx.font = '11px -apple-system, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(opts.xLabel, padL + plotW / 2, opts.height - (opts.showLegend ? 22 : 6));
  }

  // Draw each series (area fill first, then stroke, so fills don't cover lines)
  for (const s of nonEmpty) {
    const sorted = [...s.points].sort((a, b) => a.date.localeCompare(b.date));
    // Area
    if (s.fill) {
      ctx.beginPath();
      ctx.moveTo(toX(sorted[0].date), toY(0));
      for (const p of sorted) ctx.lineTo(toX(p.date), toY(Number(p.value) || 0));
      ctx.lineTo(toX(sorted[sorted.length - 1].date), toY(0));
      ctx.closePath();
      ctx.fillStyle = s.fill;
      ctx.fill();
    }
    // Line
    ctx.beginPath();
    sorted.forEach((p, i) => {
      const x = toX(p.date);
      const y = toY(Number(p.value) || 0);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
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

  // Legend (bottom)
  if (opts.showLegend && nonEmpty.length > 0) {
    const legendY = opts.height - 14;
    let legendX = padL;
    ctx.font = '11px -apple-system, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const s of nonEmpty) {
      // swatch
      ctx.fillStyle = s.color;
      ctx.fillRect(legendX, legendY - 5, 12, 3);
      ctx.fillStyle = '#374151';
      ctx.fillText(s.label, legendX + 16, legendY);
      legendX += ctx.measureText(s.label).width + 32;
    }
  }

  try {
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('[chart] toDataURL failed', err);
    return null;
  }
}

// ---------- helpers ----------

function formatTick(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (abs >= 100) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

function shortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

/**
 * Aggregate an array of records into daily totals keyed by date.
 * Useful for feeding records (multiple per day) and any field extraction.
 */
export function aggregateDaily<T extends Record<string, unknown>>(
  rows: T[],
  getDate: (r: T) => string | null | undefined,
  getValue: (r: T) => number,
): ChartPoint[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const raw = getDate(r);
    if (!raw) continue;
    const iso = typeof raw === 'string' ? raw.slice(0, 10) : '';
    if (!iso) continue;
    const v = Number(getValue(r)) || 0;
    map.set(iso, (map.get(iso) ?? 0) + v);
  }
  return Array.from(map.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
