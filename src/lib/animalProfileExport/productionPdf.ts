/**
 * productionPdf.ts — focused production report (milk + feed).
 *
 * A narrower variant of the full animal profile PDF, built specifically
 * for farmers/vets who just want to see production trends at a glance.
 * Two big line charts anchor the document; small summary tables follow.
 *
 * Uses the same jsPDF + jspdf-autotable stack as pdf.ts (no new deps) and
 * the new `chart.ts` helper for proper labeled line charts.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { AnimalProfileExportData } from './types';
import { lineChartToPngDataUrl, aggregateDaily, type ChartPoint } from './chart';

const COLORS = {
  primary: [13, 122, 61] as [number, number, number], // farm-green — milk
  accent: [204, 133, 0] as [number, number, number], // harvest-gold — feed
  text: [33, 37, 41] as [number, number, number],
  muted: [120, 120, 120] as [number, number, number],
};

const fmtDate = (v: unknown): string => {
  if (!v) return '—';
  try {
    return format(new Date(v as string), 'MMM d, yyyy');
  } catch {
    return String(v);
  }
};

const fmtNumber = (n: number | null | undefined, suffix = ''): string => {
  if (n == null) return '—';
  return `${Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 })}${suffix}`;
};

const fmtPhp = (n: number | null | undefined): string => {
  if (n == null) return '—';
  return `₱${Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
};

const lastAutoTableY = (doc: jsPDF): number => {
  const anyDoc = doc as unknown as { lastAutoTable?: { finalY: number } };
  return anyDoc.lastAutoTable?.finalY ?? 20;
};

export function generateAnimalProductionPDF(data: AnimalProfileExportData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 18;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 18) {
      doc.addPage();
      y = 18;
    }
  };

  const sectionTitle = (english: string, filipino: string) => {
    ensureSpace(12);
    // Draw the English heading first and capture its width WHILE the bold
    // 12pt font is still active — otherwise getTextWidth() measures with
    // whatever font we switch to for the Filipino subtitle and the two
    // strings overlap.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.primary);
    doc.text(english, margin, y);
    const englishWidth = doc.getTextWidth(english);
    // Now switch to the subtitle font and draw it to the right.
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(filipino, margin + englishWidth + 4, y);
    y += 6;
    doc.setTextColor(...COLORS.text);
  };

  // ---------- HEADER BAND ----------
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('DOC AGA — PRODUCTION REPORT / Talaan ng Produksyon', margin, 8);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    format(new Date(data.meta.generatedAt), 'MMM d, yyyy · h:mm a'),
    pageWidth - margin,
    8,
    { align: 'right' },
  );

  // ---------- TITLE ----------
  y = 20;
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(data.identity.name || 'Unnamed animal', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  const subline: string[] = [];
  if (data.identity.ear_tag) subline.push(`Ear tag: ${data.identity.ear_tag}`);
  if (data.identity.breed) subline.push(data.identity.breed);
  if (data.identity.livestock_type) subline.push(data.identity.livestock_type);
  if (data.identity.milking_stage) subline.push(data.identity.milking_stage);
  doc.text(subline.join('  ·  '), margin, y);
  y += 4;
  if (data.meta.farmName || data.meta.farmerName) {
    doc.text(
      [data.meta.farmName, data.meta.farmerName].filter(Boolean).join('  ·  '),
      margin,
      y,
    );
    y += 4;
  }
  if (data.meta.sourceIsOffline) {
    doc.setTextColor(...COLORS.accent);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Offline snapshot — data as of ${data.meta.cacheLastUpdated ? fmtDate(data.meta.cacheLastUpdated) : 'unknown'}`,
      margin,
      y,
    );
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);
  }
  y += 3;

  // ---------- PRODUCTION SNAPSHOT ----------
  const milkRows = data.records.milking ?? [];
  const feedingRows = data.records.feeding ?? [];

  const milkDaily: ChartPoint[] = aggregateDaily(
    milkRows,
    (r) => (r as { record_date?: string }).record_date,
    (r) => Number((r as { liters?: number }).liters ?? 0),
  );
  const feedDaily: ChartPoint[] = aggregateDaily(
    feedingRows,
    (r) =>
      (r as { record_datetime?: string; feed_date?: string; fed_at?: string })
        .record_datetime ??
      (r as { feed_date?: string }).feed_date ??
      (r as { fed_at?: string }).fed_at,
    (r) => Number((r as { kilograms?: number }).kilograms ?? 0),
  );
  const feedCostDaily: ChartPoint[] = aggregateDaily(
    feedingRows,
    (r) =>
      (r as { record_datetime?: string; feed_date?: string; fed_at?: string })
        .record_datetime ??
      (r as { feed_date?: string }).feed_date ??
      (r as { fed_at?: string }).fed_at,
    (r) => {
      const kg = Number((r as { kilograms?: number }).kilograms ?? 0);
      const cpk = Number((r as { cost_per_kg_at_time?: number }).cost_per_kg_at_time ?? 0);
      return kg * cpk;
    },
  );

  const milkTotal = milkDaily.reduce((s, p) => s + p.value, 0);
  const feedTotalKg = feedDaily.reduce((s, p) => s + p.value, 0);
  const feedTotalCost = feedCostDaily.reduce((s, p) => s + p.value, 0);
  const milkAvg = milkDaily.length > 0 ? milkTotal / milkDaily.length : 0;
  const feedAvg = feedDaily.length > 0 ? feedTotalKg / feedDaily.length : 0;
  const feedEfficiencyLPerKg = feedTotalKg > 0 ? milkTotal / feedTotalKg : 0;

  sectionTitle('Production Snapshot', 'Buod ng Produksyon');
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Milk recorded days / Araw ng talaan', `${milkDaily.length}`],
      ['Total milk / Kabuuang gatas', fmtNumber(milkTotal, ' L')],
      ['Average per day / Karaniwan kada araw', fmtNumber(milkAvg, ' L')],
      ['Feed recorded days / Araw ng pakain', `${feedDaily.length}`],
      ['Total feed / Kabuuang pakain', fmtNumber(feedTotalKg, ' kg')],
      ['Average feed per day / Karaniwang pakain', fmtNumber(feedAvg, ' kg')],
      ['Feed cost / Gastos sa pakain', fmtPhp(feedTotalCost)],
      [
        'Feed efficiency / Bisa ng pakain',
        feedEfficiencyLPerKg > 0
          ? `${fmtNumber(feedEfficiencyLPerKg)} L milk per kg feed`
          : '—',
      ],
    ],
    theme: 'striped',
    headStyles: { fillColor: COLORS.primary, textColor: 255 },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: margin, right: margin },
  });
  y = lastAutoTableY(doc) + 6;

  // ---------- MILK PRODUCTION CHART ----------
  sectionTitle('Milk Production Trend', 'Tunguhin ng Produksyon ng Gatas');
  const milkChart = lineChartToPngDataUrl(
    [
      {
        label: 'Daily milk (L)',
        points: milkDaily,
        color: '#0d7a3d',
        fill: 'rgba(13, 122, 61, 0.15)',
      },
    ],
    {
      title: 'Daily milk output / Araw-araw na gatas',
      yLabel: 'Liters',
      xLabel: 'Date',
    },
  );
  if (milkChart) {
    ensureSpace(78);
    // A4 usable width ≈ 182mm; chart aspect 720×320 → ~182×81
    doc.addImage(milkChart, 'PNG', margin, y, pageWidth - margin * 2, 75);
    y += 80;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text('No milking records / Walang talaan ng gatas', margin, y);
    y += 6;
    doc.setTextColor(...COLORS.text);
  }

  // ---------- FEED CONSUMPTION CHART ----------
  sectionTitle('Feed Consumption Trend', 'Tunguhin ng Pakain');
  const feedChart = lineChartToPngDataUrl(
    [
      {
        label: 'Daily feed (kg)',
        points: feedDaily,
        color: '#cc8500',
        fill: 'rgba(204, 133, 0, 0.15)',
      },
    ],
    {
      title: 'Daily feed consumption / Pakain kada araw',
      yLabel: 'Kilograms',
      xLabel: 'Date',
    },
  );
  if (feedChart) {
    ensureSpace(82);
    doc.addImage(feedChart, 'PNG', margin, y, pageWidth - margin * 2, 75);
    y += 80;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text('No feeding records / Walang talaan ng pakain', margin, y);
    y += 6;
    doc.setTextColor(...COLORS.text);
  }

  // ---------- MILK vs FEED OVERLAY (efficiency visualization) ----------
  if (milkDaily.length > 0 && feedDaily.length > 0) {
    sectionTitle('Milk vs Feed (overlay)', 'Gatas laban sa Pakain');
    const overlay = lineChartToPngDataUrl(
      [
        {
          label: 'Milk (L)',
          points: milkDaily,
          color: '#0d7a3d',
        },
        {
          label: 'Feed (kg)',
          points: feedDaily,
          color: '#cc8500',
        },
      ],
      {
        title: 'Production vs input / Ani laban sa pakain',
        xLabel: 'Date',
      },
    );
    if (overlay) {
      ensureSpace(82);
      doc.addImage(overlay, 'PNG', margin, y, pageWidth - margin * 2, 75);
      y += 80;
    }
  }

  // ---------- RECENT ROWS ----------
  // New page if not enough room for two small tables
  if (y > pageHeight - 90) {
    doc.addPage();
    y = 18;
  }

  sectionTitle('Recent Milking (last 20)', 'Huling 20 na Talaan ng Gatas');
  if (milkRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Liters', 'Session', 'Notes']],
      body: milkRows.slice(0, 20).map((r) => [
        fmtDate((r as { record_date?: string }).record_date),
        fmtNumber(Number((r as { liters?: number }).liters ?? 0), ' L'),
        (r as { session?: string }).session ?? '—',
        ((r as { notes?: string }).notes ?? '').toString().slice(0, 50),
      ]),
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary, textColor: 255 },
      styles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: margin, right: margin },
    });
    y = lastAutoTableY(doc) + 6;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text('No milking records', margin, y);
    y += 6;
    doc.setTextColor(...COLORS.text);
  }

  sectionTitle('Recent Feeding (last 20)', 'Huling 20 na Talaan ng Pakain');
  if (feedingRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Feed type', 'Qty (kg)', '₱/kg', 'Cost (₱)']],
      body: feedingRows.slice(0, 20).map((r) => {
        const kg = Number((r as { kilograms?: number }).kilograms ?? 0);
        const cpk = Number((r as { cost_per_kg_at_time?: number }).cost_per_kg_at_time ?? 0);
        return [
          fmtDate(
            (r as { record_datetime?: string }).record_datetime ??
              (r as { feed_date?: string }).feed_date ??
              (r as { fed_at?: string }).fed_at,
          ),
          (r as { feed_type?: string }).feed_type ?? '—',
          fmtNumber(kg),
          fmtPhp(cpk),
          fmtPhp(kg * cpk),
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: COLORS.accent, textColor: 255 },
      styles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      margin: { left: margin, right: margin },
    });
    y = lastAutoTableY(doc) + 6;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text('No feeding records', margin, y);
    y += 6;
  }

  // ---------- FOOTER ----------
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      `Doc Aga Production Report · Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' },
    );
  }

  return doc;
}
