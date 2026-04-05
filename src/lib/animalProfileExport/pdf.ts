/**
 * Animal Profile Export — PDF renderer
 *
 * Produces a farmer-friendly, printable animal record using jsPDF + jspdf-autotable
 * (both already used by src/lib/financialReportExport.ts and src/lib/exportUtils.ts —
 * no new dependencies).
 *
 * Layout:
 *   Page 1 — Overview: identity, OVR bars, vitals, cost summary, genealogy
 *   Page 2 — Production: milking history + sparkline, feeding, weight trajectory
 *   Page 3 — Health & Breeding: health timeline, BCS history, AI/heat/breeding events
 *   Page 4 — Cost ledger: all expenses + feed cost rollup + category breakdown
 *
 * All section headings use Taglish (English / Filipino) per the farmer persona.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { AnimalProfileExportData } from './types';
import { sparklineToPngDataUrl } from './sparkline';

// Brand colors (sampled from HSL tokens in src/index.css, converted to RGB)
const COLORS = {
  primary: [13, 122, 61] as [number, number, number], // farm-green
  primarySoft: [220, 240, 228] as [number, number, number],
  accent: [255, 153, 0] as [number, number, number], // harvest-gold
  text: [33, 37, 41] as [number, number, number],
  muted: [120, 120, 120] as [number, number, number],
  danger: [204, 51, 51] as [number, number, number],
};

const fmtDate = (v: unknown): string => {
  if (!v) return '—';
  try {
    return format(new Date(v as string), 'MMM d, yyyy');
  } catch {
    return String(v);
  }
};

const fmtPhp = (n: number | null | undefined): string => {
  if (n == null) return '—';
  return `₱${Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
};

const fmtNumber = (n: number | null | undefined, suffix = ''): string => {
  if (n == null) return '—';
  return `${Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 })}${suffix}`;
};

const lastAutoTableY = (doc: jsPDF): number => {
  // jspdf-autotable stashes the last table here at runtime
  const anyDoc = doc as unknown as { lastAutoTable?: { finalY: number } };
  return anyDoc.lastAutoTable?.finalY ?? 20;
};

export function generateAnimalProfilePDF(data: AnimalProfileExportData): jsPDF {
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
    ensureSpace(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.primary);
    doc.text(english, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(filipino, margin + doc.getTextWidth(english) + 4, y);
    y += 6;
    doc.setTextColor(...COLORS.text);
  };

  // ====================== HEADER BAND ======================
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('DOC AGA — ANIMAL PROFILE / Talaan ng Hayop', margin, 8);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    format(new Date(data.meta.generatedAt), 'MMM d, yyyy · h:mm a'),
    pageWidth - margin,
    8,
    { align: 'right' },
  );

  y = 20;
  doc.setTextColor(...COLORS.text);

  // ====================== TITLE ======================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  const title = data.identity.name || 'Unnamed animal';
  doc.text(title, margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  const subline: string[] = [];
  if (data.identity.ear_tag) subline.push(`Ear tag: ${data.identity.ear_tag}`);
  if (data.identity.livestock_type) subline.push(data.identity.livestock_type);
  if (data.identity.breed) subline.push(data.identity.breed);
  if (data.identity.gender) subline.push(data.identity.gender);
  doc.text(subline.join('  ·  '), margin, y);
  y += 5;
  if (data.meta.farmName || data.meta.farmerName) {
    doc.text(
      [data.meta.farmName, data.meta.farmerName].filter(Boolean).join('  ·  '),
      margin,
      y,
    );
    y += 5;
  }
  if (data.meta.sourceIsOffline) {
    doc.setTextColor(...COLORS.accent);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Offline snapshot — data as of ${
        data.meta.cacheLastUpdated ? fmtDate(data.meta.cacheLastUpdated) : 'unknown'
      }`,
      margin,
      y,
    );
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);
  }
  y += 3;

  // ====================== IDENTITY TABLE ======================
  sectionTitle('Identity', 'Pagkakakilanlan');
  autoTable(doc, {
    startY: y,
    head: [['Field', 'Value']],
    body: [
      ['Name / Pangalan', data.identity.name ?? '—'],
      ['Ear tag / Tatak', data.identity.ear_tag ?? '—'],
      ['Species / Uri', data.identity.livestock_type],
      ['Breed / Lahi', data.identity.breed ?? '—'],
      ['Gender / Kasarian', data.identity.gender ?? '—'],
      ['Date of birth / Kapanganakan', fmtDate(data.identity.birth_date)],
      ['Life stage / Yugto', data.identity.life_stage ?? '—'],
      ['Milking stage / Yugto ng gatas', data.identity.milking_stage ?? '—'],
      ['Fertility / Pagpaparami', data.identity.fertility_status ?? '—'],
      ['Parity / Bilang ng pagsilang', data.identity.parity?.toString() ?? '—'],
      ['Current weight / Kasalukuyang timbang', fmtNumber(data.identity.current_weight_kg, ' kg')],
      ['Farm entry / Pagpasok sa sakahan', fmtDate(data.identity.farm_entry_date)],
      ['Acquisition / Pagkakuha', data.identity.acquisition_type ?? '—'],
    ],
    theme: 'striped',
    headStyles: { fillColor: COLORS.primary, textColor: 255 },
    styles: { fontSize: 9, cellPadding: 2 },
    margin: { left: margin, right: margin },
  });
  y = lastAutoTableY(doc) + 6;

  // ====================== OVR SCORES ======================
  sectionTitle('OVR Scores', 'Marka ng Kalagayan');
  autoTable(doc, {
    startY: y,
    head: [['Axis', 'Score (0–100)', 'Visual']],
    body: [
      ['Overall / Kabuuan', fmtNumber(data.ovr.overall), barFor(data.ovr.overall)],
      ['Production / Produksyon', fmtNumber(data.ovr.production), barFor(data.ovr.production)],
      ['Health / Kalusugan', fmtNumber(data.ovr.health), barFor(data.ovr.health)],
      ['Fertility / Pagpaparami', fmtNumber(data.ovr.fertility), barFor(data.ovr.fertility)],
      ['Growth / Paglaki', fmtNumber(data.ovr.growth), barFor(data.ovr.growth)],
      ['Body condition / Kondisyon', fmtNumber(data.ovr.bodyCondition), barFor(data.ovr.bodyCondition)],
    ],
    theme: 'plain',
    headStyles: { fillColor: COLORS.primarySoft, textColor: COLORS.text, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2, font: 'courier' },
    columnStyles: {
      0: { font: 'helvetica', cellWidth: 55 },
      1: { font: 'helvetica', halign: 'right', cellWidth: 30 },
      2: { font: 'courier', textColor: COLORS.primary },
    },
    margin: { left: margin, right: margin },
  });
  y = lastAutoTableY(doc) + 6;

  // ====================== VITALS SNAPSHOT ======================
  sectionTitle('Vitals', 'Kasalukuyang Lagay');
  autoTable(doc, {
    startY: y,
    head: [['Field', 'Value']],
    body: [
      ['Current weight / Timbang', fmtNumber(data.vitals.currentWeightKg, ' kg')],
      ['Latest BCS / BCS', fmtNumber(data.vitals.latestBCS)],
      ['Days in milk / Araw sa paggagatas', fmtNumber(data.vitals.daysInMilk)],
      ['Last heat / Huling pangangati', fmtDate(data.vitals.lastHeatDate)],
      ['Next vaccine due / Susunod na bakuna', fmtDate(data.vitals.nextVaccineDueDate)],
      ['Immunity compliance / Pagsunod sa bakuna', fmtNumber(data.vitals.immunityCompliancePercent, '%')],
      ['Pregnant / Buntis', data.vitals.isPregnant ? 'Yes / Oo' : 'No / Hindi'],
      ['Expected delivery / Inaasahang panganganak', fmtDate(data.vitals.expectedDeliveryDate)],
      ['Estimated value / Tinatayang halaga', fmtPhp(data.vitals.estimatedValuePhp)],
      ['Market price per kg / Presyo kada kilo', fmtPhp(data.vitals.marketPricePerKg)],
    ],
    theme: 'striped',
    headStyles: { fillColor: COLORS.primary, textColor: 255 },
    styles: { fontSize: 9, cellPadding: 2 },
    margin: { left: margin, right: margin },
  });
  y = lastAutoTableY(doc) + 6;

  // ====================== COST SUMMARY ======================
  sectionTitle('Cost Summary', 'Buod ng Gastos');
  autoTable(doc, {
    startY: y,
    head: [['Item', 'Amount (PHP)']],
    body: [
      ['Purchase price / Presyo ng pagbili', fmtPhp(data.costs.purchasePrice)],
      ['Manual expenses / Mano-manong gastos', fmtPhp(data.costs.manualExpenses)],
      ['Feed consumption cost / Gastos sa pakain', fmtPhp(data.costs.feedConsumptionCost)],
      ['Total expenses / Kabuuang gastos', fmtPhp(data.costs.totalExpenses)],
      ['Total invested / Kabuuang puhunan', fmtPhp(data.costs.totalInvested)],
    ],
    theme: 'striped',
    headStyles: { fillColor: COLORS.primary, textColor: 255 },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: margin, right: margin },
  });
  y = lastAutoTableY(doc) + 6;

  // ====================== GENEALOGY ======================
  sectionTitle('Genealogy', 'Lahi / Angkan');
  autoTable(doc, {
    startY: y,
    head: [['Relation', 'Name', 'Ear tag']],
    body: [
      ['Mother / Ina', data.genealogy.motherName ?? '—', data.genealogy.motherEarTag ?? '—'],
      ['Father / Ama', data.genealogy.fatherName ?? '—', data.genealogy.fatherEarTag ?? '—'],
      ['Offspring count / Bilang ng anak', String(data.genealogy.offspringCount), ''],
    ],
    theme: 'striped',
    headStyles: { fillColor: COLORS.primary, textColor: 255 },
    styles: { fontSize: 9, cellPadding: 2 },
    margin: { left: margin, right: margin },
  });
  y = lastAutoTableY(doc) + 6;

  // ====================== PAGE 2 — PRODUCTION ======================
  doc.addPage();
  y = 18;

  sectionTitle('Milking History (last 90 days)', 'Talaan ng Gatas');
  const milkingWindow = sliceLatest(data.records.milking, 90, 'record_date');
  if (milkingWindow.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text('No milking records / Walang talaan ng gatas', margin, y);
    y += 6;
    doc.setTextColor(...COLORS.text);
  } else {
    // Sparkline
    const milkSparkUri = sparklineToPngDataUrl(
      data.sparklines.milk.slice(-60),
      { strokeColor: '#0d7a3d' },
    );
    if (milkSparkUri) {
      ensureSpace(38);
      doc.addImage(milkSparkUri, 'PNG', margin, y, 80, 20);
      y += 24;
    }
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Liters', 'Session', 'Notes']],
      body: milkingWindow.slice(0, 40).map((r) => [
        fmtDate(r.record_date),
        fmtNumber(r.liters, ' L'),
        r.session ?? '—',
        (r.notes ?? '').slice(0, 60),
      ]),
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary, textColor: 255 },
      styles: { fontSize: 8, cellPadding: 1.5 },
      margin: { left: margin, right: margin },
    });
    y = lastAutoTableY(doc) + 6;
  }

  sectionTitle('Feeding (last 90 days)', 'Pakain');
  const feedingWindow = sliceLatest(data.records.feeding, 90, 'feed_date');
  if (feedingWindow.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text('No feeding records / Walang talaan ng pakain', margin, y);
    y += 6;
    doc.setTextColor(...COLORS.text);
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Feed type', 'Qty (kg)', '₱/kg', 'Cost (₱)']],
      body: feedingWindow.slice(0, 30).map((r) => {
        const kg = Number(r.kilograms ?? 0);
        const cpk = Number(r.cost_per_kg_at_time ?? 0);
        return [
          fmtDate(r.feed_date ?? r.fed_at),
          r.feed_type ?? '—',
          fmtNumber(kg),
          fmtPhp(cpk),
          fmtPhp(kg * cpk),
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary, textColor: 255 },
      styles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      margin: { left: margin, right: margin },
    });
    y = lastAutoTableY(doc) + 6;
  }

  sectionTitle('Weight Trajectory', 'Paglaki');
  const weightSparkUri = sparklineToPngDataUrl(data.sparklines.weight, {
    strokeColor: '#0d7a3d',
  });
  if (weightSparkUri) {
    ensureSpace(28);
    doc.addImage(weightSparkUri, 'PNG', margin, y, 80, 20);
    y += 24;
  }
  if (data.records.weight.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Weight (kg)', 'Recorded by', 'Notes']],
      body: data.records.weight.slice(0, 30).map((r) => [
        fmtDate(r.measurement_date),
        fmtNumber(r.weight_kg),
        r.recorded_by ?? '—',
        (r.notes ?? '').slice(0, 60),
      ]),
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary, textColor: 255 },
      styles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: margin, right: margin },
    });
    y = lastAutoTableY(doc) + 6;
  }

  // ====================== PAGE 3 — HEALTH & BREEDING ======================
  doc.addPage();
  y = 18;

  sectionTitle('Health Timeline', 'Talaan ng Kalusugan');
  if (data.records.health.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text('No health records / Walang talaan ng kalusugan', margin, y);
    y += 6;
    doc.setTextColor(...COLORS.text);
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Type', 'Condition', 'Treatment', 'Vet', 'Cost']],
      body: data.records.health.slice(0, 40).map((r) => [
        fmtDate(r.visit_date),
        r.visit_type ?? '—',
        (r.condition_noted ?? '—').toString().slice(0, 40),
        (r.treatment_given ?? '—').toString().slice(0, 40),
        r.vet_name ?? '—',
        fmtPhp(r.cost),
      ]),
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary, textColor: 255 },
      styles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: { 5: { halign: 'right' } },
      margin: { left: margin, right: margin },
    });
    y = lastAutoTableY(doc) + 6;
  }

  sectionTitle('Body Condition Scores', 'Kondisyon ng Katawan');
  if (data.records.bcs.length > 0) {
    const bcsSparkUri = sparklineToPngDataUrl(data.sparklines.bcs, {
      strokeColor: '#ff9900',
      fillColor: 'rgba(255, 153, 0, 0.12)',
    });
    if (bcsSparkUri) {
      ensureSpace(28);
      doc.addImage(bcsSparkUri, 'PNG', margin, y, 80, 20);
      y += 24;
    }
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Score', 'Notes']],
      body: data.records.bcs.slice(0, 20).map((r) => [
        fmtDate(r.assessment_date),
        fmtNumber(r.score),
        (r.notes ?? '').slice(0, 60),
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
    doc.text('No BCS records / Walang BCS', margin, y);
    y += 6;
    doc.setTextColor(...COLORS.text);
  }

  sectionTitle('AI / Breeding', 'AI / Pagpaparami');
  if (data.records.ai.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Scheduled', 'Performed', 'Semen code', 'Technician', 'Pregnant?', 'Expected delivery']],
      body: data.records.ai.slice(0, 30).map((r) => [
        fmtDate(r.scheduled_date),
        fmtDate(r.performed_date),
        r.semen_code ?? '—',
        r.technician ?? '—',
        r.pregnancy_confirmed ? 'Yes / Oo' : 'No / Hindi',
        fmtDate(r.expected_delivery_date),
      ]),
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary, textColor: 255 },
      styles: { fontSize: 8, cellPadding: 1.5 },
      margin: { left: margin, right: margin },
    });
    y = lastAutoTableY(doc) + 6;
  }

  if (data.records.heat.length > 0) {
    ensureSpace(20);
    autoTable(doc, {
      startY: y,
      head: [['Heat detected', 'Method', 'Intensity', 'Notes']],
      body: data.records.heat.slice(0, 20).map((r) => [
        fmtDate(r.detected_at),
        r.detection_method ?? '—',
        r.intensity ?? '—',
        (r.notes ?? '').slice(0, 50),
      ]),
      theme: 'striped',
      headStyles: { fillColor: COLORS.accent, textColor: 255 },
      styles: { fontSize: 8, cellPadding: 1.5 },
      margin: { left: margin, right: margin },
    });
    y = lastAutoTableY(doc) + 6;
  }

  // ====================== PAGE 4 — COST LEDGER ======================
  doc.addPage();
  y = 18;

  sectionTitle('Cost Ledger', 'Detalyadong Gastos');
  if (data.costs.categoryBreakdown.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Category', 'Amount (PHP)', 'Visual']],
      body: data.costs.categoryBreakdown.map((c) => [
        c.category,
        fmtPhp(c.amount),
        barForValue(c.amount, data.costs.totalExpenses),
      ]),
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary, textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        1: { halign: 'right' },
        2: { font: 'courier', textColor: COLORS.primary },
      },
      margin: { left: margin, right: margin },
    });
    y = lastAutoTableY(doc) + 6;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text('No categorized expenses / Walang nakakategoryang gastos', margin, y);
    y += 6;
    doc.setTextColor(...COLORS.text);
  }

  sectionTitle('Totals', 'Kabuuan');
  autoTable(doc, {
    startY: y,
    body: [
      ['Purchase price / Presyo ng pagbili', fmtPhp(data.costs.purchasePrice)],
      ['Manual expenses / Mano-manong gastos', fmtPhp(data.costs.manualExpenses)],
      ['Feed consumption / Gastos sa pakain', fmtPhp(data.costs.feedConsumptionCost)],
      ['TOTAL INVESTED / KABUUANG PUHUNAN', fmtPhp(data.costs.totalInvested)],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
  });
  y = lastAutoTableY(doc) + 10;

  // ====================== FOOTER ON ALL PAGES ======================
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      `Doc Aga Farm Management · Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' },
    );
  }

  return doc;
}

// ====================== HELPERS ======================

function sliceLatest<T extends Record<string, any>>(
  rows: T[],
  days: number,
  dateKey: string,
): T[] {
  if (!rows || rows.length === 0) return [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return rows.filter((r) => {
    const raw = r[dateKey];
    if (!raw) return false;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
}

function barFor(value: number | null | undefined): string {
  if (value == null) return '';
  const width = 20;
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function barForValue(value: number, total: number): string {
  if (!total || total <= 0) return '';
  const pct = (value / total) * 100;
  return barFor(pct);
}
