/**
 * Sparkline → PNG data URL
 *
 * Tiny offscreen-canvas utility for embedding mini line charts in the
 * Animal Profile Export PDF. No external deps. Gracefully no-ops in
 * non-browser environments (returns null).
 */

export interface SparklinePoint {
  date: string;
  value: number;
}

export interface SparklineOptions {
  width?: number;
  height?: number;
  strokeColor?: string;
  fillColor?: string;
  background?: string;
  lineWidth?: number;
  padding?: number;
}

const DEFAULTS: Required<SparklineOptions> = {
  width: 480,
  height: 120,
  strokeColor: '#0d7a3d', // farm-green ≈ primary
  fillColor: 'rgba(13, 122, 61, 0.12)',
  background: '#ffffff',
  lineWidth: 2,
  padding: 8,
};

/**
 * Render a sparkline to a PNG data URL suitable for `doc.addImage(..., 'PNG')`.
 * Returns `null` if canvas is unavailable or there are no data points.
 */
export function sparklineToPngDataUrl(
  points: SparklinePoint[],
  options: SparklineOptions = {},
): string | null {
  if (typeof document === 'undefined') return null;
  if (!points || points.length === 0) return null;

  const opts = { ...DEFAULTS, ...options };
  const canvas = document.createElement('canvas');
  canvas.width = opts.width;
  canvas.height = opts.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background
  ctx.fillStyle = opts.background;
  ctx.fillRect(0, 0, opts.width, opts.height);

  const values = points.map((p) => Number(p.value) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const innerW = opts.width - opts.padding * 2;
  const innerH = opts.height - opts.padding * 2;
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;

  const toX = (i: number) => opts.padding + i * step;
  const toY = (v: number) =>
    opts.padding + innerH - ((v - min) / range) * innerH;

  // Fill area under line
  ctx.beginPath();
  ctx.moveTo(toX(0), opts.padding + innerH);
  points.forEach((_, i) => ctx.lineTo(toX(i), toY(values[i])));
  ctx.lineTo(toX(points.length - 1), opts.padding + innerH);
  ctx.closePath();
  ctx.fillStyle = opts.fillColor;
  ctx.fill();

  // Stroke line
  ctx.beginPath();
  points.forEach((_, i) => {
    const x = toX(i);
    const y = toY(values[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineWidth = opts.lineWidth;
  ctx.strokeStyle = opts.strokeColor;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // End-cap dot
  if (points.length > 0) {
    const lastX = toX(points.length - 1);
    const lastY = toY(values[values.length - 1]);
    ctx.beginPath();
    ctx.arc(lastX, lastY, Math.max(2, opts.lineWidth + 1), 0, Math.PI * 2);
    ctx.fillStyle = opts.strokeColor;
    ctx.fill();
  }

  try {
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('[sparkline] toDataURL failed', err);
    return null;
  }
}
