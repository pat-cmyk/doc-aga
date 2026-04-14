import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { GovStatsWithGrowth, TimeseriesDataPoint, HeatmapData } from "@/hooks/useGovernmentStats";
import type { GrantAnalytics } from "@/hooks/useGrantAnalytics";
import type { RegionalInvestmentData } from "@/hooks/useRegionalInvestment";
import type { VeterinaryExpenseSummary } from "@/hooks/useVeterinaryExpenseHeatmap";
import type { BreedingStats } from "@/hooks/useBreedingStats";
import type { GovernmentHealthStats } from "@/hooks/useGovernmentHealthStats";
import type { PCRSSummary } from "@/hooks/useRegionalPCRS";
import type { MilkAnalyticsSummary } from "@/hooks/useGovernmentMilkAnalytics";
import type { FeedSecuritySummary } from "@/hooks/useRegionalFeedSecurity";
import type { DataCategory } from "@/types/government";
import {
  GOV_COLORS, ensureSpace, drawSectionHeader, drawKpiCard, drawKpiRow,
  drawHorizontalBarChart, drawStackedBar, drawProgressGauge, drawMiniSparkline,
  govTrendChartToPng, govGroupedBarChartToPng, generateExecutiveSummary,
  formatAdaptive, type KpiCardOptions,
} from "./govReportCharts";

// ---------------------------------------------------------------------------
// Full Export Data Interface (new comprehensive export)
// ---------------------------------------------------------------------------

export interface FullExportData {
  // Core stats
  stats: GovStatsWithGrowth | null;
  comparisonStats?: GovStatsWithGrowth | null;
  timeseriesData?: TimeseriesDataPoint[];
  comparisonTimeseriesData?: TimeseriesDataPoint[];
  heatmapData?: HeatmapData[];
  comparisonHeatmapData?: HeatmapData[];
  farmerQueries?: Array<{ created_at: string; question: string }>;
  comparisonFarmerQueries?: Array<{ created_at: string; question: string }>;
  dateRange: { start: Date; end: Date };
  comparisonDateRange?: { start: Date; end: Date };
  region?: string;
  comparisonRegion?: string;
  grantAnalytics?: GrantAnalytics;
  regionalInvestment?: RegionalInvestmentData;
  veterinaryExpenses?: VeterinaryExpenseSummary;

  // Livestock Analytics
  breedingStats?: BreedingStats;
  healthStats?: GovernmentHealthStats | null;
  pcrsData?: PCRSSummary;

  // Farmer Voice
  feedbackList?: any[];
  feedbackStats?: {
    total: number;
    pending: number;
    critical: number;
    categoryCount: Record<string, number>;
    recent: number;
  } | null;

  // Programs & Insights
  milkAnalytics?: MilkAnalyticsSummary;
  feedSecurity?: FeedSecuritySummary;

  // Metadata
  dataCategory: DataCategory;
  province?: string;
  municipality?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape a string for CSV (wrap in quotes if it contains commas, quotes, or newlines). */
function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format a number as peso currency for PDF/CSV.
 * Uses "P" instead of "₱" (U+20B1) because jsPDF Helvetica lacks the glyph.
 * Whole numbers: no decimals. Fractional: 2 decimals.
 */
function peso(value: number | null | undefined): string {
  if (value == null) return "N/A";
  const isWhole = Number.isInteger(value) || Math.abs(value - Math.round(value)) < 0.005;
  return `P${Math.round(value).toLocaleString()}`;
}

/** Format a number as percentage string (keeps decimals for precision). */
function pct(value: number | null | undefined, decimals = 1): string {
  if (value == null) return "N/A";
  return `${value.toFixed(decimals)}%`;
}

/** Format a plain number: whole numbers only, with commas. No prefix. */
function fmtNum(value: number | null | undefined, suffix?: string): string {
  if (value == null) return "N/A";
  const formatted = Math.round(value).toLocaleString();
  return suffix ? `${formatted} ${suffix}` : formatted;
}

/** Trigger a browser download for a blob. */
function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Generate a timestamped filename. */
function timestampedFilename(prefix: string, ext: string): string {
  return `${prefix}-${format(new Date(), "yyyy-MM-dd-HHmmss")}.${ext}`;
}

/** Add page if yPos exceeds threshold; returns new yPos. */
function addPageIfNeeded(doc: jsPDF, yPos: number, threshold = 220): number {
  if (yPos > threshold) {
    doc.addPage();
    return 20;
  }
  return yPos;
}

/** Get the final Y after the last autoTable. */
function getLastTableY(doc: jsPDF): number {
  return (doc as any).lastAutoTable?.finalY ?? 20;
}

// ---------------------------------------------------------------------------
// CSV Section Generators
// ---------------------------------------------------------------------------

export function csvMetadataSection(data: FullExportData): string {
  let csv = "Government Livestock Dashboard Report\n";
  csv += `Export Date,${format(new Date(), "yyyy-MM-dd HH:mm:ss")}\n`;
  csv += `Report Period,${format(data.dateRange.start, "yyyy-MM-dd")} to ${format(data.dateRange.end, "yyyy-MM-dd")}\n`;
  csv += `Region,${data.region || "All Regions"}\n`;
  if (data.province) csv += `Province,${data.province}\n`;
  if (data.municipality) csv += `Municipality,${data.municipality}\n`;
  csv += `Data Category,${data.dataCategory ?? "live"}\n`;

  if (data.comparisonStats && data.comparisonDateRange) {
    csv += `\nComparison Period,${format(data.comparisonDateRange.start, "yyyy-MM-dd")} to ${format(data.comparisonDateRange.end, "yyyy-MM-dd")}\n`;
    csv += `Comparison Region,${data.comparisonRegion || "All Regions"}\n`;
  }

  csv += "\n";
  return csv;
}

export function csvLivestockSection(data: FullExportData): string {
  let csv = "";

  // ---- Summary Statistics ----
  const { stats, comparisonStats } = data;
  if (stats) {
    csv += "LIVESTOCK ANALYTICS\n\n";
    csv += "Summary Statistics\n";

    const hasComp = !!comparisonStats;
    csv += hasComp
      ? "Metric,Primary Value,Primary Growth,Comparison Value,Comparison Growth,Difference,% Change\n"
      : "Metric,Value,Growth\n";

    const addRow = (label: string, pv: number, pg: number, cv?: number, cg?: number) => {
      csv += `${csvEscape(label)},${pv.toLocaleString()},${pct(pg)}`;
      if (hasComp && cv !== undefined) {
        const diff = pv - cv;
        const change = cv !== 0 ? ((diff / cv) * 100).toFixed(1) : "0.0";
        csv += `,${cv.toLocaleString()},${pct(cg ?? 0)},${diff.toLocaleString()},${change}%`;
      }
      csv += "\n";
    };

    addRow("Total Farms", stats.farm_count, stats.farmGrowth, comparisonStats?.farm_count, comparisonStats?.farmGrowth);
    addRow("Active Animals", stats.active_animal_count, 0, comparisonStats?.active_animal_count, 0);
    addRow("Daily Logs", stats.daily_log_count, stats.logGrowth, comparisonStats?.daily_log_count, comparisonStats?.logGrowth);
    addRow("Health Events", stats.health_event_count, stats.healthGrowth, comparisonStats?.health_event_count, comparisonStats?.healthGrowth);
    addRow("Avg Milk (L)", Math.round(stats.avg_milk_liters), 0, comparisonStats ? Math.round(comparisonStats.avg_milk_liters) : undefined, 0);
    addRow("Doc Aga Queries", stats.doc_aga_query_count, 0, comparisonStats?.doc_aga_query_count, 0);
    csv += "\n";
  }

  // ---- Breeding Statistics ----
  const bs = data.breedingStats;
  if (bs) {
    csv += "Breeding Statistics\n";
    csv += "Metric,Value\n";
    csv += `AI Scheduled,${bs.total_ai_scheduled}\n`;
    csv += `AI Performed,${bs.total_ai_performed}\n`;
    csv += `Pregnancies Confirmed,${bs.total_pregnancies_confirmed}\n`;
    csv += `Currently Pregnant,${bs.currently_pregnant}\n`;
    csv += `AI Success Rate,${pct(bs.ai_success_rate)}\n`;
    csv += `Due This Quarter,${bs.due_this_quarter}\n`;
    csv += `Unique Semen Codes,${bs.unique_semen_count}\n`;
    csv += "\n";

    csv += "Breeding Success by Species\n";
    csv += "Species,Success Rate\n";
    csv += `Cattle,${pct(bs.cattle_success_rate)}\n`;
    csv += `Goat,${pct(bs.goat_success_rate)}\n`;
    csv += `Carabao,${pct(bs.carabao_success_rate)}\n`;
    csv += `Sheep,${pct(bs.sheep_success_rate)}\n`;
    csv += "\n";
  }

  // ---- Health & Welfare ----
  const hs = data.healthStats;
  if (hs) {
    csv += "Health & Welfare\n";
    csv += "Metric,Value\n";
    csv += `Vaccination Scheduled,${hs.scheduled_vaccinations}\n`;
    csv += `Vaccination Completed,${hs.completed_vaccinations}\n`;
    csv += `Vaccination Compliance,${pct(hs.vaccination_compliance_rate)}\n`;
    csv += `Deworming Scheduled,${hs.scheduled_deworming}\n`;
    csv += `Deworming Completed,${hs.completed_deworming}\n`;
    csv += `Heat Events,${hs.heat_events_count}\n`;
    csv += `Avg Cycle Length (days),${hs.avg_cycle_length_days?.toFixed(1) ?? "N/A"}\n`;
    csv += `Animals in Optimal Window,${hs.animals_in_optimal_window}\n`;
    csv += `BCS Average,${hs.avg_bcs_score?.toFixed(2) ?? "N/A"}\n`;
    csv += `BCS Underweight,${hs.animals_underweight}\n`;
    csv += `BCS Optimal,${hs.animals_optimal}\n`;
    csv += `BCS Overweight,${hs.animals_overweight}\n`;
    csv += `Mortality Rate,${pct(hs.mortality_rate)}\n`;
    csv += `Total Exits,${hs.total_exits}\n`;
    csv += `Sold,${hs.exits_sold}\n`;
    csv += `Died,${hs.exits_died}\n`;
    csv += `Culled,${hs.exits_culled}\n`;
    csv += `Transferred,${hs.exits_transferred}\n`;
    csv += `Slaughtered,${hs.exits_slaughtered}\n`;
    csv += `Total Sales Revenue,${peso(hs.total_sales_revenue)}\n`;
    csv += "\n";
  }

  // ---- PCRS Summary ----
  const pcrs = data.pcrsData;
  if (pcrs) {
    csv += "PCRS Summary (Pregnant Cow Risk Score)\n";
    csv += "Metric,Value\n";
    csv += `Total Pregnant,${pcrs.totalPregnant}\n`;
    csv += `Critical Risk,${pcrs.totalCritical}\n`;
    csv += `High Risk,${pcrs.totalHigh}\n`;
    csv += `Moderate Risk,${pcrs.totalModerate}\n`;
    csv += `Low Risk,${pcrs.totalLow}\n`;
    csv += `Avg Risk Score,${pcrs.avgRiskScore?.toFixed(2) ?? "N/A"}\n`;
    csv += "\n";
  }

  // ---- Health Heatmap Top 10 ----
  if (data.heatmapData && data.heatmapData.length > 0) {
    csv += "Health Heatmap - Top 10 Municipalities\n";
    csv += "Municipality,Region,Health Events,Total Animals,Prevalence Rate,Symptoms\n";
    data.heatmapData.slice(0, 10).forEach((item) => {
      csv += `${csvEscape(item.municipality)},${csvEscape(item.region)},${item.health_event_count},${item.total_animals},${pct(item.prevalence_rate)},${csvEscape(item.symptom_types?.join(", ") || "")}\n`;
    });
    csv += "\n";
  }

  // ---- Expected Deliveries by Month ----
  if (bs?.expected_deliveries_by_month && Object.keys(bs.expected_deliveries_by_month).length > 0) {
    csv += "Expected Deliveries by Month\n";
    const months = Object.keys(bs.expected_deliveries_by_month).sort();
    // Gather all species keys
    const speciesSet = new Set<string>();
    months.forEach((m) => {
      Object.keys(bs.expected_deliveries_by_month[m]?.by_type ?? {}).forEach((s) => speciesSet.add(s));
    });
    const speciesList = Array.from(speciesSet).sort();
    csv += `Month,Total,${speciesList.join(",")}\n`;
    months.forEach((m) => {
      const entry = bs.expected_deliveries_by_month[m];
      csv += `${m},${entry?.total ?? 0}`;
      speciesList.forEach((sp) => {
        csv += `,${entry?.by_type?.[sp] ?? 0}`;
      });
      csv += "\n";
    });
    csv += "\n";
  }

  // ---- Top Farmer Queries ----
  if (data.farmerQueries && data.farmerQueries.length > 0) {
    csv += "Top Farmer Queries\n";
    csv += "Date,Question\n";
    data.farmerQueries.slice(0, 20).forEach((query) => {
      csv += `${format(new Date(query.created_at), "yyyy-MM-dd HH:mm")},${csvEscape(query.question)}\n`;
    });
    csv += "\n";
  }

  return csv;
}

export function csvFarmerVoiceSection(data: FullExportData): string {
  let csv = "FARMER VOICE\n\n";

  // ---- Feedback Overview ----
  const fs = data.feedbackStats;
  if (fs) {
    csv += "Feedback Overview\n";
    csv += "Metric,Value\n";
    csv += `Total Submissions,${fs.total}\n`;
    csv += `Pending Review,${fs.pending}\n`;
    csv += `Critical Cases,${fs.critical}\n`;
    csv += `Recent (Last 7 Days),${fs.recent}\n`;
    csv += "\n";

    // ---- Category Breakdown ----
    if (fs.categoryCount && Object.keys(fs.categoryCount).length > 0) {
      csv += "Feedback by Category\n";
      csv += "Category,Count\n";
      Object.entries(fs.categoryCount)
        .sort(([, a], [, b]) => b - a)
        .forEach(([cat, count]) => {
          csv += `${csvEscape(cat)},${count}\n`;
        });
      csv += "\n";
    }
  }

  // ---- Full Feedback List ----
  if (data.feedbackList && data.feedbackList.length > 0) {
    csv += "Full Feedback List\n";
    csv += "Date,Farm,Region,Province,Municipality,Category,Priority,Sentiment Score,Status,Summary\n";
    data.feedbackList.forEach((item: any) => {
      const farm = item.farms; // Nested join from farmer_feedback → farms!inner
      csv += [
        csvEscape(item.created_at ? format(new Date(item.created_at), "yyyy-MM-dd HH:mm") : ""),
        csvEscape(farm?.name ?? item.farm_id ?? ""),
        csvEscape(farm?.region ?? ""),
        csvEscape(farm?.province ?? ""),
        csvEscape(farm?.municipality ?? ""),
        csvEscape(item.primary_category ?? ""),
        csvEscape(item.auto_priority ?? ""),
        item.sentiment_score != null ? String(item.sentiment_score) : "",
        csvEscape(item.status ?? ""),
        csvEscape(item.ai_summary ?? item.feedback_text ?? ""),
      ].join(",") + "\n";
    });
    csv += "\n";
  }

  return csv;
}

export function csvProgramsSection(data: FullExportData): string {
  let csv = "PROGRAMS & INSIGHTS\n\n";

  // ---- Grant Distribution ----
  const ga = data.grantAnalytics;
  if (ga) {
    csv += "Grant Distribution\n";
    csv += "Metric,Value\n";
    csv += `Total Grant Recipients,${ga.totalGrantAnimals}\n`;
    csv += `Total Purchased,${ga.totalPurchasedAnimals}\n`;
    csv += `Total Born on Farm,${ga.totalBornOnFarm}\n`;
    csv += `Grant Percentage,${pct(ga.grantPercentage)}\n`;
    csv += `Average Purchase Price,${peso(ga.avgPurchasePrice)}\n`;
    csv += "\n";

    if (ga.grantSourceBreakdown && ga.grantSourceBreakdown.length > 0) {
      csv += "Grant Source Breakdown\n";
      csv += "Source,Count,Percentage\n";
      ga.grantSourceBreakdown.forEach((source) => {
        csv += `${csvEscape(source.grantSource)},${source.count},${pct(source.percentage)}\n`;
      });
      csv += "\n";
    }
  }

  // ---- Regional Investment ----
  const ri = data.regionalInvestment;
  if (ri) {
    csv += "Regional Investment Summary\n";
    csv += "Metric,Value\n";
    csv += `Total Herd Investment,${peso(ri.totalHerdInvestment)}\n`;
    csv += `Total Animal Expenses,${peso(ri.totalAnimalExpenses)}\n`;
    csv += `Average Per Farm,${peso(ri.averageInvestmentPerFarm)}\n`;
    csv += `Average Per Animal,${peso(ri.averageInvestmentPerAnimal)}\n`;
    csv += `Total Farms,${ri.farmCount}\n`;
    csv += `Total Animals,${ri.animalCount}\n`;
    csv += "\n";
  }

  // ---- Veterinary Expenses ----
  const ve = data.veterinaryExpenses;
  if (ve) {
    csv += "Veterinary Expense Summary\n";
    csv += "Metric,Value\n";
    csv += `Total Veterinary Services,${peso(ve.totalVetExpenses)}\n`;
    csv += `Total Medicine & Vaccines,${peso(ve.totalMedicineExpenses)}\n`;
    csv += `Combined Total,${peso(ve.totalCombined)}\n`;
    csv += `Average Cost Per Animal,${peso(ve.avgCostPerAnimal)}\n`;
    csv += `Total Animals,${ve.totalAnimals}\n`;
    csv += `Total Farms,${ve.totalFarms}\n`;
    csv += "\n";

    if (ve.byLocation && ve.byLocation.length > 0) {
      csv += "Veterinary Expense Hotspots (Top 10)\n";
      csv += "Municipality,Province,Total Expenses,Animals,Cost Per Animal\n";
      ve.byLocation.slice(0, 10).forEach((loc) => {
        csv += `${csvEscape(loc.municipality)},${csvEscape(loc.province)},${peso(loc.combinedTotal)},${loc.animalCount},${peso(loc.costPerAnimal)}\n`;
      });
      csv += "\n";
    }
  }

  // ---- Milk Production by Species ----
  const ma = data.milkAnalytics;
  if (ma) {
    csv += "Milk Production by Species\n";
    csv += "Species,Total Liters,Revenue Estimate,Avg Price/Liter\n";
    csv += `Cattle,${ma.totalCattleMilk.toLocaleString()},${peso(ma.cattleRevenueEstimate)},${ma.avgCattlePrice != null ? peso(ma.avgCattlePrice) : "N/A"}\n`;
    csv += `Goat,${ma.totalGoatMilk.toLocaleString()},${peso(ma.goatRevenueEstimate)},${ma.avgGoatPrice != null ? peso(ma.avgGoatPrice) : "N/A"}\n`;
    csv += `Carabao,${ma.totalCarabaoMilk.toLocaleString()},${peso(ma.carabaoRevenueEstimate)},${ma.avgCarabaoPrice != null ? peso(ma.avgCarabaoPrice) : "N/A"}\n`;
    csv += `Total,${ma.totalMilk.toLocaleString()},${peso(ma.totalRevenueEstimate)},\n`;
    csv += "\n";
  }

  // ---- Feed Security ----
  const fss = data.feedSecurity;
  if (fss) {
    csv += "Feed Security Status\n";
    csv += "Metric,Value\n";
    csv += `Total Farms Assessed,${fss.totalFarms}\n`;
    csv += `Critical (<7 days),${fss.criticalFarms},${pct(fss.overallCriticalPercentage)}\n`;
    csv += `Low (7-30 days),${fss.lowFarms},${pct(fss.overallLowPercentage)}\n`;
    csv += `Adequate (>30 days),${fss.adequateFarms},${pct(fss.totalFarms > 0 ? (fss.adequateFarms / fss.totalFarms) * 100 : 0)}\n`;
    csv += "\n";
  }

  return csv;
}

// ---------------------------------------------------------------------------
// PDF Section Generators (visual-rich using govReportCharts primitives)
// ---------------------------------------------------------------------------

const PDF_MARGIN = 14;

/** Convert a hex color string to an RGB tuple. */
function hexToRgb(hex: string): readonly [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ] as const;
}

export function pdfCoverPage(doc: jsPDF, data: FullExportData): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Full-width green band at top (40mm tall)
  doc.setFillColor(...GOV_COLORS.primary);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // White text inside band
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Republic of the Philippines", PDF_MARGIN, 12);
  doc.text("Department of Agriculture", PDF_MARGIN, 18);

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Government Livestock Dashboard Report", PDF_MARGIN, 32);

  // Below band — normal text
  doc.setTextColor(...GOV_COLORS.text);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  doc.text(
    `Report Period: ${format(data.dateRange.start, "MMM d, yyyy")} \u2013 ${format(data.dateRange.end, "MMM d, yyyy")}`,
    PDF_MARGIN,
    52
  );

  const locationParts: string[] = [];
  if (data.region) locationParts.push(`Region: ${data.region}`);
  if (data.province) locationParts.push(`Province: ${data.province}`);
  if (data.municipality) locationParts.push(`Municipality: ${data.municipality}`);
  doc.text(locationParts.length > 0 ? locationParts.join("  |  ") : "All Regions", PDF_MARGIN, 60);

  doc.text(`Data Category: ${data.dataCategory ?? "live"}`, PDF_MARGIN, 68);

  if (data.comparisonDateRange) {
    doc.text(
      `Comparison: ${format(data.comparisonDateRange.start, "MMM d, yyyy")} \u2013 ${format(data.comparisonDateRange.end, "MMM d, yyyy")} (${data.comparisonRegion || "All Regions"})`,
      PDF_MARGIN,
      76
    );
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...GOV_COLORS.muted);
  doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`, PDF_MARGIN, 130);
  doc.text("CONFIDENTIAL \u2014 For Official Use Only", PDF_MARGIN, 145);

  doc.setTextColor(...GOV_COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.addPage();
  return 18;
}

export function pdfExecutiveDashboard(doc: jsPDF, data: FullExportData): number {
  let y = drawSectionHeader(doc, 18, "Executive Summary");

  if (data.stats) {
    const s = data.stats;
    y = ensureSpace(doc, y, 60);

    // Row 1: Total Farms, Active Animals, Daily Logs
    const row1: KpiCardOptions[] = [
      {
        value: (s.farm_count ?? 0).toLocaleString(),
        label: "Total Farms",
        accentColor: GOV_COLORS.primary,
        ...(typeof s.farmGrowth === 'number' ? {
          trend: { direction: s.farmGrowth >= 0 ? 'up' as const : 'down' as const, value: `${Math.abs(s.farmGrowth).toFixed(1)}%`, positive: s.farmGrowth >= 0 },
        } : {}),
      },
      {
        value: (s.active_animal_count ?? 0).toLocaleString(),
        label: "Active Animals",
        accentColor: GOV_COLORS.primary,
      },
      {
        value: (s.daily_log_count ?? 0).toLocaleString(),
        label: "Daily Logs",
        accentColor: GOV_COLORS.accent,
        ...(typeof s.logGrowth === 'number' ? {
          trend: { direction: s.logGrowth >= 0 ? 'up' as const : 'down' as const, value: `${Math.abs(s.logGrowth).toFixed(1)}%`, positive: s.logGrowth >= 0 },
        } : {}),
      },
    ];
    y = drawKpiRow(doc, y, row1);

    // Row 2: Health Events, Avg Milk, Doc Aga Queries
    const row2: KpiCardOptions[] = [
      {
        value: (s.health_event_count ?? 0).toLocaleString(),
        label: "Health Events",
        accentColor: GOV_COLORS.danger,
        ...(typeof s.healthGrowth === 'number' ? {
          trend: { direction: s.healthGrowth >= 0 ? 'up' as const : 'down' as const, value: `${Math.abs(s.healthGrowth).toFixed(1)}%`, positive: s.healthGrowth <= 0 },
        } : {}),
      },
      {
        value: `${Math.round(s.avg_milk_liters ?? 0)}`,
        label: "Avg Milk (L)",
        accentColor: GOV_COLORS.accent,
      },
      {
        value: (s.doc_aga_query_count ?? 0).toLocaleString(),
        label: "Doc Aga Queries",
        accentColor: GOV_COLORS.primary,
      },
    ];
    y = drawKpiRow(doc, y, row2);
  }

  // Auto-generated narrative
  const narrative = generateExecutiveSummary(data);
  if (narrative) {
    y = ensureSpace(doc, y, 20);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GOV_COLORS.text);
    const contentWidth = doc.internal.pageSize.getWidth() - PDF_MARGIN * 2;
    const lines = doc.splitTextToSize(narrative, contentWidth);
    doc.text(lines, PDF_MARGIN, y);
    y += lines.length * 4 + 6;
  }

  // Livestock distribution bar chart from latest timeseries
  if (data.timeseriesData && data.timeseriesData.length > 0) {
    const latest = data.timeseriesData[data.timeseriesData.length - 1];
    const speciesItems = [
      { label: "Cattle", value: latest.cattle_count ?? 0, color: hexToRgb(GOV_COLORS.cattle) },
      { label: "Goat", value: latest.goat_count ?? 0, color: hexToRgb(GOV_COLORS.goat) },
      { label: "Carabao", value: latest.carabao_count ?? 0, color: hexToRgb(GOV_COLORS.carabao) },
      { label: "Sheep", value: latest.sheep_count ?? 0, color: hexToRgb(GOV_COLORS.sheep) },
    ].filter(item => item.value > 0);

    if (speciesItems.length > 0) {
      y = ensureSpace(doc, y, 40);
      y = drawHorizontalBarChart(doc, PDF_MARGIN, y, {
        title: "Livestock Distribution",
        items: speciesItems,
      });
    }
  }

  return y;
}

export function pdfLivestockTrendsPage(doc: jsPDF, data: FullExportData, y: number): number {
  y = drawSectionHeader(doc, y, "Livestock Population Trends");

  if (data.timeseriesData && data.timeseriesData.length >= 3) {
    const farmSeries = {
      label: "Farms",
      points: data.timeseriesData.map(d => ({ date: d.date, value: d.total_farms ?? 0 })),
      color: `rgb(${GOV_COLORS.primary.join(',')})`,
      fill: `rgba(${GOV_COLORS.primary.join(',')}, 0.1)`,
    };
    const animalSeries = {
      label: "Animals",
      points: data.timeseriesData.map(d => ({
        date: d.date,
        value: (d.cattle_count ?? 0) + (d.goat_count ?? 0) + (d.carabao_count ?? 0) + (d.sheep_count ?? 0),
      })),
      color: `rgb(${GOV_COLORS.accent.join(',')})`,
    };

    const png = govTrendChartToPng([farmSeries, animalSeries], {
      title: "Farm & Animal Population Over Time",
    });

    if (png) {
      y = ensureSpace(doc, y, 80);
      doc.addImage(png, 'PNG', PDF_MARGIN, y, 182, 75);
      y += 80;
    } else {
      doc.setFontSize(9);
      doc.setTextColor(...GOV_COLORS.muted);
      doc.text("Chart rendering unavailable in this environment.", PDF_MARGIN, y);
      doc.setTextColor(...GOV_COLORS.text);
      y += 8;
    }
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...GOV_COLORS.muted);
    doc.text("Insufficient data for trend visualization (minimum 3 data points required).", PDF_MARGIN, y);
    doc.setTextColor(...GOV_COLORS.text);
    y += 8;
  }

  return y;
}

export function pdfBreedingPage(doc: jsPDF, data: FullExportData, y: number): number {
  y = drawSectionHeader(doc, y, "Reproduction & Breeding");

  const bs = data.breedingStats;
  if (!bs) return y;

  // Row 1: AI Activity KPIs
  y = ensureSpace(doc, y, 34);
  y = drawKpiRow(doc, y, [
    { value: fmtNum(bs.total_ai_scheduled), label: "AI Scheduled", accentColor: GOV_COLORS.accent },
    { value: fmtNum(bs.total_ai_performed), label: "AI Performed", accentColor: GOV_COLORS.primary },
    { value: fmtNum(bs.unique_semen_count), label: "Semen Sources", accentColor: GOV_COLORS.accent },
  ]);

  // Row 2: Outcomes
  const aiRate = bs.ai_success_rate ?? 0;
  const aiAccent = aiRate > 60 ? GOV_COLORS.low : aiRate >= 40 ? GOV_COLORS.accent : GOV_COLORS.danger;

  y = ensureSpace(doc, y, 34);
  y = drawKpiRow(doc, y, [
    { value: pct(bs.ai_success_rate), label: "AI Success Rate", accentColor: aiAccent },
    { value: fmtNum(bs.currently_pregnant), label: "Currently Pregnant", accentColor: GOV_COLORS.primary },
    { value: fmtNum(bs.due_this_quarter), label: "Due This Quarter", accentColor: GOV_COLORS.accent },
  ]);

  // AI Activities Summary table
  y = ensureSpace(doc, y, 30);
  autoTable(doc, {
    startY: y,
    head: [["AI Activity Metric", "Count"]],
    body: [
      ["AI Procedures Scheduled", fmtNum(bs.total_ai_scheduled)],
      ["AI Procedures Performed", fmtNum(bs.total_ai_performed)],
      ["Pregnancies Confirmed (from AI)", fmtNum(bs.total_pregnancies_confirmed)],
      ["Currently Pregnant", fmtNum(bs.currently_pregnant)],
      ["Due This Quarter", fmtNum(bs.due_this_quarter)],
      ["Unique Semen/Bull Codes", fmtNum(bs.unique_semen_count)],
    ],
    theme: "striped",
    styles: { fontSize: 8 },
    headStyles: { fillColor: [...GOV_COLORS.primary] as any, textColor: 255 },
  });
  y = getLastTableY(doc) + 8;

  // Horizontal bar chart: Breeding Success by Species
  y = ensureSpace(doc, y, 40);
  y = drawHorizontalBarChart(doc, PDF_MARGIN, y, {
    title: "Breeding Success Rate by Species (%)",
    items: [
      { label: "Cattle", value: Math.round(bs.cattle_success_rate ?? 0), color: hexToRgb(GOV_COLORS.cattle) },
      { label: "Goat", value: Math.round(bs.goat_success_rate ?? 0), color: hexToRgb(GOV_COLORS.goat) },
      { label: "Carabao", value: Math.round(bs.carabao_success_rate ?? 0), color: hexToRgb(GOV_COLORS.carabao) },
      { label: "Sheep", value: Math.round(bs.sheep_success_rate ?? 0), color: hexToRgb(GOV_COLORS.sheep) },
    ],
  });

  // Expected Deliveries table
  if (bs.expected_deliveries_by_month && Object.keys(bs.expected_deliveries_by_month).length > 0) {
    y = ensureSpace(doc, y, 30);
    const months = Object.keys(bs.expected_deliveries_by_month).sort();
    const speciesSet = new Set<string>();
    months.forEach((m) => {
      Object.keys(bs.expected_deliveries_by_month[m]?.by_type ?? {}).forEach((s) => speciesSet.add(s));
    });
    const speciesList = Array.from(speciesSet).sort();

    autoTable(doc, {
      startY: y,
      head: [["Month", "Total", ...speciesList]],
      body: months.map((m) => {
        const entry = bs.expected_deliveries_by_month[m];
        return [m, String(entry?.total ?? 0), ...speciesList.map((sp) => String(entry?.by_type?.[sp] ?? 0))];
      }),
      theme: "striped",
      styles: { fontSize: 7 },
      headStyles: { fillColor: [...GOV_COLORS.primary] as any, textColor: 255 },
    });
    y = getLastTableY(doc) + 8;
  }

  return y;
}

export function pdfHealthPage(doc: jsPDF, data: FullExportData, y: number): number {
  y = drawSectionHeader(doc, y, "Animal Health & Welfare");

  const hs = data.healthStats;
  if (hs) {
    // KPI row: Vaccination Compliance, BCS Average, Mortality Rate
    const vaccRate = hs.vaccination_compliance_rate ?? 0;
    const vaccAccent = vaccRate >= 80 ? GOV_COLORS.low : GOV_COLORS.danger;

    const bcsScore = hs.avg_bcs_score ?? 0;
    const bcsAccent = (bcsScore >= 2.5 && bcsScore <= 4.0) ? GOV_COLORS.low : GOV_COLORS.accent;

    const mortRate = hs.mortality_rate ?? 0;
    const mortAccent = mortRate < 2 ? GOV_COLORS.low : mortRate <= 5 ? GOV_COLORS.accent : GOV_COLORS.danger;

    y = ensureSpace(doc, y, 34);
    y = drawKpiRow(doc, y, [
      { value: pct(hs.vaccination_compliance_rate), label: "Vaccination Compliance", accentColor: vaccAccent },
      { value: hs.avg_bcs_score?.toFixed(1) ?? "N/A", label: "BCS Average", accentColor: bcsAccent },
      { value: pct(hs.mortality_rate), label: "Mortality Rate", accentColor: mortAccent },
    ]);

    // Progress gauge: Vaccination Compliance
    y = ensureSpace(doc, y, 12);
    const contentWidth = doc.internal.pageSize.getWidth() - PDF_MARGIN * 2;
    y = drawProgressGauge(doc, PDF_MARGIN, y, contentWidth, {
      label: "Vaccination",
      current: hs.completed_vaccinations ?? 0,
      total: hs.scheduled_vaccinations ?? 1,
      color: vaccAccent,
    });

    // Stacked bar: BCS Distribution
    y = ensureSpace(doc, y, 20);
    y = drawStackedBar(doc, PDF_MARGIN, y, contentWidth, {
      title: "BCS Distribution",
      segments: [
        { label: "Underweight", value: hs.animals_underweight ?? 0, color: GOV_COLORS.danger },
        { label: "Optimal", value: hs.animals_optimal ?? 0, color: GOV_COLORS.primary },
        { label: "Overweight", value: hs.animals_overweight ?? 0, color: GOV_COLORS.accent },
      ],
    });

    // Stacked bar: Mortality/Exit Breakdown
    y = ensureSpace(doc, y, 20);
    y = drawStackedBar(doc, PDF_MARGIN, y, contentWidth, {
      title: "Exit Breakdown",
      segments: [
        { label: "Sold", value: hs.exits_sold ?? 0, color: [59, 130, 246] },
        { label: "Died", value: hs.exits_died ?? 0, color: GOV_COLORS.danger },
        { label: "Culled", value: hs.exits_culled ?? 0, color: GOV_COLORS.accent },
        { label: "Transferred", value: hs.exits_transferred ?? 0, color: GOV_COLORS.muted },
        { label: "Slaughtered", value: hs.exits_slaughtered ?? 0, color: GOV_COLORS.danger },
      ],
    });
  }

  // PCRS Risk Distribution
  const pcrs = data.pcrsData;
  if (pcrs) {
    const contentWidth = doc.internal.pageSize.getWidth() - PDF_MARGIN * 2;
    y = ensureSpace(doc, y, 20);
    y = drawStackedBar(doc, PDF_MARGIN, y, contentWidth, {
      title: "PCRS Risk Distribution",
      segments: [
        { label: "Critical", value: pcrs.totalCritical ?? 0, color: GOV_COLORS.critical },
        { label: "High", value: pcrs.totalHigh ?? 0, color: GOV_COLORS.high },
        { label: "Moderate", value: pcrs.totalModerate ?? 0, color: GOV_COLORS.moderate },
        { label: "Low", value: pcrs.totalLow ?? 0, color: GOV_COLORS.low },
      ],
    });
  }

  // Health Heatmap Top 10
  if (data.heatmapData && data.heatmapData.length > 0) {
    y = ensureSpace(doc, y, 30);
    autoTable(doc, {
      startY: y,
      head: [["Municipality", "Region", "Events", "Animals", "Rate", "Symptoms"]],
      body: data.heatmapData.slice(0, 10).map((item) => [
        item.municipality,
        item.region,
        String(item.health_event_count),
        String(item.total_animals),
        pct(item.prevalence_rate),
        item.symptom_types?.slice(0, 2).join(", ") || "-",
      ]),
      theme: "striped",
      styles: { fontSize: 7 },
      headStyles: { fillColor: [...GOV_COLORS.primary] as any, textColor: 255 },
      columnStyles: { 5: { cellWidth: 40 } },
    });
    y = getLastTableY(doc) + 8;
  }

  return y;
}

export function pdfFarmerVoicePage(doc: jsPDF, data: FullExportData, y: number): number {
  y = drawSectionHeader(doc, y, "Farmer Voice & Feedback");

  const fs = data.feedbackStats;
  if (fs) {
    // KPI row: Total, Pending, Critical, Recent
    y = ensureSpace(doc, y, 34);
    y = drawKpiRow(doc, y, [
      { value: String(fs.total ?? 0), label: "Total", accentColor: GOV_COLORS.primary },
      { value: String(fs.pending ?? 0), label: "Pending", accentColor: GOV_COLORS.accent },
      { value: String(fs.critical ?? 0), label: "Critical", accentColor: GOV_COLORS.danger },
      { value: String(fs.recent ?? 0), label: "Recent", accentColor: GOV_COLORS.primary },
    ]);

    // Horizontal bar chart: Feedback by Category
    if (fs.categoryCount && Object.keys(fs.categoryCount).length > 0) {
      const items = Object.entries(fs.categoryCount)
        .sort(([, a], [, b]) => b - a)
        .map(([label, value]) => ({ label, value, color: GOV_COLORS.primary as readonly number[] }));

      y = ensureSpace(doc, y, items.length * 10 + 10);
      y = drawHorizontalBarChart(doc, PDF_MARGIN, y, {
        title: "Feedback by Category",
        items,
      });
    }
  }

  // Feedback list table
  if (data.feedbackList && data.feedbackList.length > 0) {
    y = ensureSpace(doc, y, 30);
    const fbRows = data.feedbackList.slice(0, 15).map((item: any) => {
      const farm = item.farms;
      return [
        item.created_at ? format(new Date(item.created_at), "MM/dd") : "",
        (farm?.name ?? item.farm_id ?? "").toString().substring(0, 12),
        (farm?.municipality ?? "").toString().substring(0, 12),
        item.primary_category ?? "",
        item.auto_priority ?? "",
        item.status ?? "",
        (item.ai_summary ?? item.feedback_text ?? "").toString().substring(0, 60),
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["Date", "Farm", "Municipality", "Category", "Priority", "Status", "Summary"]],
      body: fbRows,
      theme: "striped",
      styles: { fontSize: 6, cellPadding: 1.5 },
      headStyles: { fillColor: [...GOV_COLORS.primary] as any, textColor: 255, fontSize: 7 },
      columnStyles: { 6: { cellWidth: 50 } },
    });
    y = getLastTableY(doc) + 10;
  }

  return y;
}

export function pdfGrantsPage(doc: jsPDF, data: FullExportData, y: number): number {
  y = drawSectionHeader(doc, y, "Grant Program & Investment");

  const ga = data.grantAnalytics;
  if (ga) {
    // Stacked bar: Acquisition Distribution
    const contentWidth = doc.internal.pageSize.getWidth() - PDF_MARGIN * 2;
    y = ensureSpace(doc, y, 20);
    y = drawStackedBar(doc, PDF_MARGIN, y, contentWidth, {
      title: "Acquisition Distribution",
      segments: [
        { label: "Grant", value: ga.totalGrantAnimals ?? 0, color: GOV_COLORS.primary },
        { label: "Purchased", value: ga.totalPurchasedAnimals ?? 0, color: [59, 130, 246] },
        { label: "Born on Farm", value: ga.totalBornOnFarm ?? 0, color: GOV_COLORS.accent },
      ],
    });

    // Grant source breakdown table
    if (ga.grantSourceBreakdown && ga.grantSourceBreakdown.length > 0) {
      y = ensureSpace(doc, y, 30);
      autoTable(doc, {
        startY: y,
        head: [["Source", "Count", "Percentage"]],
        body: ga.grantSourceBreakdown.map((s) => [s.grantSource, String(s.count), pct(s.percentage)]),
        theme: "striped",
        styles: { fontSize: 7 },
        headStyles: { fillColor: [...GOV_COLORS.primary] as any, textColor: 255 },
      });
      y = getLastTableY(doc) + 8;
    }
  }

  const ri = data.regionalInvestment;
  if (ri) {
    // KPI row: Total Herd Investment, Avg Per Farm, Avg Per Animal
    y = ensureSpace(doc, y, 34);
    y = drawKpiRow(doc, y, [
      { value: peso(ri.totalHerdInvestment), label: "Total Herd Investment", accentColor: GOV_COLORS.primary },
      { value: peso(ri.averageInvestmentPerFarm), label: "Avg Per Farm", accentColor: GOV_COLORS.accent },
      { value: peso(ri.averageInvestmentPerAnimal), label: "Avg Per Animal", accentColor: GOV_COLORS.primary },
    ]);
  }

  return y;
}

export function pdfProductionPage(doc: jsPDF, data: FullExportData, y: number): number {
  y = drawSectionHeader(doc, y, "Production Economics");

  const ma = data.milkAnalytics;
  if (ma) {
    // Horizontal bar chart: Milk Production by Species
    y = ensureSpace(doc, y, 40);
    y = drawHorizontalBarChart(doc, PDF_MARGIN, y, {
      title: "Milk Production by Species (Liters)",
      items: [
        { label: "Cattle", value: ma.totalCattleMilk ?? 0, color: hexToRgb(GOV_COLORS.cattle) },
        { label: "Goat", value: ma.totalGoatMilk ?? 0, color: hexToRgb(GOV_COLORS.goat) },
        { label: "Carabao", value: ma.totalCarabaoMilk ?? 0, color: hexToRgb(GOV_COLORS.carabao) },
      ],
    });

    // KPI row: Total Revenue, Total Milk
    y = ensureSpace(doc, y, 34);
    const milkKpis: KpiCardOptions[] = [
      { value: peso(ma.totalRevenueEstimate), label: "Total Revenue Estimate", accentColor: GOV_COLORS.primary },
      { value: fmtNum(ma.totalMilk, "L"), label: "Total Milk", accentColor: GOV_COLORS.accent },
    ];
    y = drawKpiRow(doc, y, milkKpis);
  }

  const fss = data.feedSecurity;
  if (fss) {
    // Stacked bar: Feed Security Status
    const contentWidth = doc.internal.pageSize.getWidth() - PDF_MARGIN * 2;
    y = ensureSpace(doc, y, 20);
    y = drawStackedBar(doc, PDF_MARGIN, y, contentWidth, {
      title: "Feed Security Status",
      segments: [
        { label: "Critical", value: fss.criticalFarms ?? 0, color: GOV_COLORS.danger },
        { label: "Low", value: fss.lowFarms ?? 0, color: GOV_COLORS.accent },
        { label: "Adequate", value: fss.adequateFarms ?? 0, color: GOV_COLORS.primary },
      ],
    });
  }

  const ve = data.veterinaryExpenses;
  if (ve && ve.byLocation && ve.byLocation.length > 0) {
    y = ensureSpace(doc, y, 30);
    autoTable(doc, {
      startY: y,
      head: [["Municipality", "Province", "Total", "Animals", "Cost/Animal"]],
      body: ve.byLocation.slice(0, 5).map((loc) => [
        loc.municipality,
        loc.province,
        peso(loc.combinedTotal),
        String(loc.animalCount),
        peso(loc.costPerAnimal),
      ]),
      theme: "striped",
      styles: { fontSize: 7 },
      headStyles: { fillColor: [...GOV_COLORS.primary] as any, textColor: 255 },
    });
    y = getLastTableY(doc) + 8;
  }

  return y;
}

export function pdfFooters(doc: jsPDF, data: FullExportData): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Thin green line
    doc.setDrawColor(...GOV_COLORS.primary);
    doc.setLineWidth(0.3);
    doc.line(PDF_MARGIN, pageHeight - 13, pageWidth - PDF_MARGIN, pageHeight - 13);

    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...GOV_COLORS.muted);

    // Left: report name
    doc.text("Doc Aga Government Dashboard Report", PDF_MARGIN, pageHeight - 8);

    // Center: page number
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: "center" });

    // Right: generated date
    doc.text(`Generated: ${format(new Date(), "MMM d, yyyy")}`, pageWidth - PDF_MARGIN, pageHeight - 8, { align: "right" });

    // Reset
    doc.setDrawColor(0, 0, 0);
    doc.setTextColor(...GOV_COLORS.text);
    doc.setFont("helvetica", "normal");
  }
}

// ---------------------------------------------------------------------------
// Public Composition API — Full Dashboard
// ---------------------------------------------------------------------------

export function exportFullDashboardCSV(data: FullExportData): void {
  const csv =
    csvMetadataSection(data) +
    csvLivestockSection(data) +
    csvFarmerVoiceSection(data) +
    csvProgramsSection(data);

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, timestampedFilename("gov-full-report", "csv"));
}

export function exportFullDashboardPDF(data: FullExportData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Page 1: Cover
  pdfCoverPage(doc, data);

  // Page 2: Executive Dashboard (always shown if stats exist)
  let y = pdfExecutiveDashboard(doc, data);

  // Page 3: Livestock Trends
  if (data.timeseriesData && data.timeseriesData.length >= 3) {
    doc.addPage();
    y = pdfLivestockTrendsPage(doc, data, 18);
  }

  // Page 4: Breeding
  if (data.breedingStats) {
    doc.addPage();
    y = pdfBreedingPage(doc, data, 18);
  }

  // Page 5: Health
  if (data.healthStats || data.pcrsData || (data.heatmapData && data.heatmapData.length > 0)) {
    doc.addPage();
    y = pdfHealthPage(doc, data, 18);
  }

  // Page 6: Farmer Voice
  if (data.feedbackStats || (data.feedbackList && data.feedbackList.length > 0)) {
    doc.addPage();
    y = pdfFarmerVoicePage(doc, data, 18);
  }

  // Page 7: Grants & Investment
  if (data.grantAnalytics || data.regionalInvestment) {
    doc.addPage();
    y = pdfGrantsPage(doc, data, 18);
  }

  // Page 8: Production Economics
  if (data.milkAnalytics || data.feedSecurity || data.veterinaryExpenses) {
    doc.addPage();
    y = pdfProductionPage(doc, data, 18);
  }

  pdfFooters(doc, data);
  doc.save(timestampedFilename("gov-full-report", "pdf"));
}

// ---------------------------------------------------------------------------
// Public Composition API — Per-Tab
// ---------------------------------------------------------------------------

export function exportTabCSV(tab: "livestock" | "farmer-voice" | "programs", data: FullExportData): void {
  let csv = csvMetadataSection(data);

  switch (tab) {
    case "livestock":
      csv += csvLivestockSection(data);
      break;
    case "farmer-voice":
      csv += csvFarmerVoiceSection(data);
      break;
    case "programs":
      csv += csvProgramsSection(data);
      break;
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, timestampedFilename(`gov-${tab}-report`, "csv"));
}

export function exportTabPDF(tab: "livestock" | "farmer-voice" | "programs", data: FullExportData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Slim green header band (12mm) instead of full cover
  doc.setFillColor(...GOV_COLORS.primary);
  doc.rect(0, 0, pageWidth, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  const tabTitles = { livestock: "Livestock Analytics Report", "farmer-voice": "Farmer Voice Report", programs: "Programs & Insights Report" };
  doc.text(tabTitles[tab], PDF_MARGIN, 8);
  doc.setTextColor(...GOV_COLORS.muted);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`${format(data.dateRange.start, "MMM d, yyyy")} \u2013 ${format(data.dateRange.end, "MMM d, yyyy")}  |  ${data.region || "All Regions"}`, PDF_MARGIN, 17);

  let y = 24;

  switch (tab) {
    case "livestock":
      y = pdfExecutiveDashboard(doc, data);
      if (data.timeseriesData && data.timeseriesData.length >= 3) { doc.addPage(); y = pdfLivestockTrendsPage(doc, data, 18); }
      if (data.breedingStats) { doc.addPage(); y = pdfBreedingPage(doc, data, 18); }
      if (data.healthStats || data.pcrsData || (data.heatmapData && data.heatmapData.length > 0)) { doc.addPage(); y = pdfHealthPage(doc, data, 18); }
      break;
    case "farmer-voice":
      y = pdfFarmerVoicePage(doc, data, y);
      break;
    case "programs":
      if (data.grantAnalytics || data.regionalInvestment) { y = pdfGrantsPage(doc, data, y); }
      if (data.milkAnalytics || data.feedSecurity || data.veterinaryExpenses) { doc.addPage(); y = pdfProductionPage(doc, data, 18); }
      break;
  }

  pdfFooters(doc, data);
  doc.save(timestampedFilename(`gov-${tab}-report`, "pdf"));
}

// ---------------------------------------------------------------------------
// Legacy Exports (backward compatibility)
// ---------------------------------------------------------------------------

/** @deprecated Use FullExportData instead. */
export interface LegacyExportData {
  stats: GovStatsWithGrowth | null;
  comparisonStats?: GovStatsWithGrowth | null;
  timeseriesData?: TimeseriesDataPoint[];
  comparisonTimeseriesData?: TimeseriesDataPoint[];
  heatmapData?: HeatmapData[];
  comparisonHeatmapData?: HeatmapData[];
  farmerQueries?: Array<{ created_at: string; question: string }>;
  comparisonFarmerQueries?: Array<{ created_at: string; question: string }>;
  dateRange: { start: Date; end: Date };
  comparisonDateRange?: { start: Date; end: Date };
  region?: string;
  comparisonRegion?: string;
  grantAnalytics?: GrantAnalytics;
  regionalInvestment?: RegionalInvestmentData;
  veterinaryExpenses?: VeterinaryExpenseSummary;
}

/** @deprecated Use exportFullDashboardCSV or exportTabCSV instead. */
export const exportToCSV = (data: LegacyExportData) => {
  const { stats, comparisonStats, dateRange, comparisonDateRange, region, comparisonRegion } = data;

  let csv = "Government Livestock Dashboard Export\n\n";

  // Add metadata
  csv += `Export Date,${format(new Date(), "yyyy-MM-dd HH:mm:ss")}\n`;
  csv += `Primary Period,${format(dateRange.start, "yyyy-MM-dd")} to ${format(dateRange.end, "yyyy-MM-dd")}\n`;
  csv += `Primary Region,${region || "All Regions"}\n`;

  if (comparisonStats && comparisonDateRange) {
    csv += `Comparison Period,${format(comparisonDateRange.start, "yyyy-MM-dd")} to ${format(comparisonDateRange.end, "yyyy-MM-dd")}\n`;
    csv += `Comparison Region,${comparisonRegion || "All Regions"}\n`;
  }

  csv += "\n\nSummary Statistics\n";
  csv += "Metric,Primary Value,Primary Growth";

  if (comparisonStats) {
    csv += ",Comparison Value,Comparison Growth,Difference,% Change\n";
  } else {
    csv += "\n";
  }

  if (stats) {
    const addRow = (label: string, primaryValue: number, primaryGrowth: number, compValue?: number, compGrowth?: number) => {
      const diff = compValue !== undefined ? primaryValue - compValue : null;
      const pctChange = compValue !== undefined && compValue !== 0
        ? (((primaryValue - compValue) / compValue) * 100).toFixed(1)
        : null;

      csv += `${label},${primaryValue.toLocaleString()},${primaryGrowth}%`;

      if (compValue !== undefined) {
        csv += `,${compValue.toLocaleString()},${compGrowth}%,${diff?.toLocaleString() || 0},${pctChange}%`;
      }

      csv += "\n";
    };

    addRow("Total Farms", stats.farm_count, stats.farmGrowth, comparisonStats?.farm_count, comparisonStats?.farmGrowth);
    addRow("Active Animals", stats.active_animal_count, 0, comparisonStats?.active_animal_count, 0);
    addRow("Daily Logs", stats.daily_log_count, stats.logGrowth, comparisonStats?.daily_log_count, comparisonStats?.logGrowth);
    addRow("Health Events", stats.health_event_count, stats.healthGrowth, comparisonStats?.health_event_count, comparisonStats?.healthGrowth);
    addRow("Avg Milk (L)", Math.round(stats.avg_milk_liters), 0, comparisonStats ? Math.round(comparisonStats.avg_milk_liters) : undefined, 0);
    addRow("Doc Aga Queries", stats.doc_aga_query_count, 0, comparisonStats?.doc_aga_query_count, 0);
  }

  // Add heatmap data
  if (data.heatmapData && data.heatmapData.length > 0) {
    csv += "\n\nHealth Heatmap Data\n";
    csv += "Municipality,Region,Health Events,Total Animals,Prevalence Rate,Symptoms\n";

    data.heatmapData.slice(0, 10).forEach(item => {
      csv += `${item.municipality},${item.region},${item.health_event_count},${item.total_animals},${item.prevalence_rate}%,"${item.symptom_types?.join(", ") || ""}"\n`;
    });
  }

  // Add farmer queries
  if (data.farmerQueries && data.farmerQueries.length > 0) {
    csv += "\n\nTop Farmer Queries\n";
    csv += "Date,Question\n";

    data.farmerQueries.slice(0, 20).forEach(query => {
      const cleanQuestion = query.question.replace(/"/g, '""');
      csv += `${format(new Date(query.created_at), "yyyy-MM-dd HH:mm")},"${cleanQuestion}"\n`;
    });
  }

  // Grant Analytics Section
  if (data.grantAnalytics) {
    const ga = data.grantAnalytics;
    csv += "\n\nGrant Program Distribution\n";
    csv += "Metric,Value\n";
    csv += `Total Grant Recipients,${ga.totalGrantAnimals}\n`;
    csv += `Total Purchased,${ga.totalPurchasedAnimals}\n`;
    csv += `Total Born on Farm,${ga.totalBornOnFarm}\n`;
    csv += `Grant Percentage,${ga.grantPercentage.toFixed(1)}%\n`;
    csv += `Average Purchase Price,\u20B1${ga.avgPurchasePrice.toFixed(2)}\n`;

    if (ga.grantSourceBreakdown.length > 0) {
      csv += "\nGrant Source Breakdown\n";
      csv += "Source,Count,Percentage\n";
      ga.grantSourceBreakdown.forEach(source => {
        csv += `"${source.grantSource}",${source.count},${source.percentage.toFixed(1)}%\n`;
      });
    }
  }

  // Regional Investment Section
  if (data.regionalInvestment) {
    const ri = data.regionalInvestment;
    csv += "\n\nRegional Investment Summary\n";
    csv += "Metric,Value\n";
    csv += `Total Herd Investment,\u20B1${ri.totalHerdInvestment.toFixed(2)}\n`;
    csv += `Total Animal Expenses,\u20B1${ri.totalAnimalExpenses.toFixed(2)}\n`;
    csv += `Average Investment Per Farm,\u20B1${ri.averageInvestmentPerFarm.toFixed(2)}\n`;
    csv += `Average Investment Per Animal,\u20B1${ri.averageInvestmentPerAnimal.toFixed(2)}\n`;
    csv += `Total Farms,${ri.farmCount}\n`;
    csv += `Total Animals,${ri.animalCount}\n`;
  }

  // Veterinary Expenses Section
  if (data.veterinaryExpenses) {
    const ve = data.veterinaryExpenses;
    csv += "\n\nVeterinary Expense Summary\n";
    csv += "Metric,Value\n";
    csv += `Total Veterinary Services,\u20B1${ve.totalVetExpenses.toFixed(2)}\n`;
    csv += `Total Medicine & Vaccines,\u20B1${ve.totalMedicineExpenses.toFixed(2)}\n`;
    csv += `Combined Total,\u20B1${ve.totalCombined.toFixed(2)}\n`;
    csv += `Average Cost Per Animal,\u20B1${ve.avgCostPerAnimal.toFixed(2)}\n`;
    csv += `Total Animals,${ve.totalAnimals}\n`;
    csv += `Total Farms,${ve.totalFarms}\n`;

    if (ve.byLocation.length > 0) {
      csv += "\nVeterinary Expense Hotspots (Top 10)\n";
      csv += "Municipality,Province,Total Expenses,Animals,Cost Per Animal\n";
      ve.byLocation.slice(0, 10).forEach(loc => {
        csv += `"${loc.municipality}","${loc.province}",\u20B1${loc.combinedTotal.toFixed(2)},${loc.animalCount},\u20B1${loc.costPerAnimal.toFixed(2)}\n`;
      });
    }
  }

  // Create download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `government-dashboard-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/** @deprecated Use exportFullDashboardPDF or exportTabPDF instead. */
export const exportToPDF = (data: LegacyExportData) => {
  const { stats, comparisonStats, dateRange, comparisonDateRange, region, comparisonRegion } = data;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Government Livestock Dashboard Report", pageWidth / 2, yPos, { align: "center" });

  yPos += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`, pageWidth / 2, yPos, { align: "center" });

  yPos += 15;

  // Period information
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Report Period", 14, yPos);

  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Primary: ${format(dateRange.start, "MMM d, yyyy")} - ${format(dateRange.end, "MMM d, yyyy")}`, 14, yPos);
  doc.text(`Region: ${region || "All Regions"}`, 120, yPos);

  if (comparisonStats && comparisonDateRange) {
    yPos += 5;
    doc.text(`Comparison: ${format(comparisonDateRange.start, "MMM d, yyyy")} - ${format(comparisonDateRange.end, "MMM d, yyyy")}`, 14, yPos);
    doc.text(`Region: ${comparisonRegion || "All Regions"}`, 120, yPos);
  }

  yPos += 12;

  // Summary statistics table
  if (stats) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Summary Statistics", 14, yPos);

    yPos += 5;

    const tableData: any[][] = [];

    const addTableRow = (label: string, primaryValue: number, primaryGrowth: number, compValue?: number, compGrowth?: number) => {
      const row: any[] = [
        label,
        primaryValue.toLocaleString(),
        `${primaryGrowth}%`
      ];

      if (comparisonStats && compValue !== undefined) {
        const diff = primaryValue - compValue;
        const pctChange = compValue !== 0 ? (((primaryValue - compValue) / compValue) * 100).toFixed(1) : "0.0";
        row.push(compValue.toLocaleString(), `${compGrowth}%`, diff.toLocaleString(), `${pctChange}%`);
      }

      return row;
    };

    tableData.push(addTableRow("Total Farms", stats.farm_count, stats.farmGrowth, comparisonStats?.farm_count, comparisonStats?.farmGrowth));
    tableData.push(addTableRow("Active Animals", stats.active_animal_count, 0, comparisonStats?.active_animal_count, 0));
    tableData.push(addTableRow("Daily Logs", stats.daily_log_count, stats.logGrowth, comparisonStats?.daily_log_count, comparisonStats?.logGrowth));
    tableData.push(addTableRow("Health Events", stats.health_event_count, stats.healthGrowth, comparisonStats?.health_event_count, comparisonStats?.healthGrowth));
    tableData.push(addTableRow("Avg Milk (L)", Math.round(stats.avg_milk_liters), 0, comparisonStats ? Math.round(comparisonStats.avg_milk_liters) : undefined, 0));
    tableData.push(addTableRow("Doc Aga Queries", stats.doc_aga_query_count, 0, comparisonStats?.doc_aga_query_count, 0));

    const headers = comparisonStats
      ? [["Metric", "Primary", "Growth", "Comparison", "Growth", "Diff", "% Change"]]
      : [["Metric", "Value", "Growth"]];

    autoTable(doc, {
      startY: yPos,
      head: headers,
      body: tableData,
      theme: "striped",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    yPos = (doc as any).lastAutoTable.finalY + 12;
  }

  // Health heatmap data
  if (data.heatmapData && data.heatmapData.length > 0) {
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Health Heatmap - Top Municipalities", 14, yPos);

    yPos += 5;

    const heatmapTableData = data.heatmapData.slice(0, 10).map(item => [
      item.municipality,
      item.region,
      item.health_event_count.toString(),
      item.total_animals.toString(),
      `${item.prevalence_rate}%`,
      item.symptom_types?.slice(0, 2).join(", ") || "-"
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Municipality", "Region", "Events", "Animals", "Rate", "Symptoms"]],
      body: heatmapTableData,
      theme: "striped",
      styles: { fontSize: 7 },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: {
        5: { cellWidth: 40 }
      }
    });

    yPos = (doc as any).lastAutoTable.finalY + 12;
  }

  // Farmer queries
  if (data.farmerQueries && data.farmerQueries.length > 0) {
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Recent Farmer Queries", 14, yPos);

    yPos += 5;

    const queriesTableData = data.farmerQueries.slice(0, 15).map(query => [
      format(new Date(query.created_at), "MMM d, h:mm a"),
      query.question.length > 80 ? query.question.substring(0, 80) + "..." : query.question
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Date", "Question"]],
      body: queriesTableData,
      theme: "striped",
      styles: { fontSize: 7 },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 'auto' }
      }
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  // Save
  doc.save(`government-dashboard-${format(new Date(), "yyyy-MM-dd-HHmmss")}.pdf`);
};

/**
 * Generates and downloads the Government Dashboard User Manual as a PDF.
 * Content mirrors docs/government-dashboard-manual.md.
 */
export const exportManualPDF = () => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const addPageIfNeededManual = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
  };

  const heading = (text: string, size: number, space = 8) => {
    addPageIfNeededManual(size + space + 4);
    doc.setFontSize(size);
    doc.setFont("helvetica", "bold");
    doc.text(text, margin, y);
    y += space;
  };

  const paragraph = (text: string) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(text, contentWidth);
    addPageIfNeededManual(lines.length * 4 + 2);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 3;
  };

  const table = (head: string[][], body: string[][]) => {
    addPageIfNeededManual(20);
    autoTable(doc, {
      startY: y,
      head,
      body,
      theme: "striped",
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  };

  // -- Title Page --
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Doc Aga Government Dashboard", pageWidth / 2, 60, { align: "center" });
  doc.setFontSize(18);
  doc.text("User Manual", pageWidth / 2, 72, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Version 1.0  |  March 2026", pageWidth / 2, 84, { align: "center" });
  doc.text("Audience: Government livestock officers, regional agricultural coordinators, program managers", pageWidth / 2, 92, { align: "center" });
  doc.addPage();
  y = 20;

  // -- Table of Contents --
  heading("Table of Contents", 14, 10);
  const tocItems = [
    "1. Introduction",
    "2. Getting Started",
    "3. Tab 1: Livestock Analytics",
    "4. Tab 2: Farmer Voice",
    "5. Tab 3: Programs & Insights",
    "6. Filters & Data Controls",
    "7. Exporting Data",
    "8. Glossary",
    "9. Frequently Asked Questions",
  ];
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  tocItems.forEach((item) => {
    doc.text(item, margin + 4, y);
    y += 6;
  });
  y += 6;

  // -- 1. Introduction --
  heading("1. Introduction", 14, 10);
  paragraph("The Doc Aga Government Dashboard is a web-based analytics portal that aggregates livestock farm data across Philippine regions. It provides government officers with evidence-based insights for policy decisions, program evaluation, and farmer support.");
  paragraph("What it does: Displays cross-farm statistics, tracks livestock population/health/breeding/milk production trends, captures and analyzes farmer feedback, and measures grant program effectiveness.");
  paragraph("What it does NOT do: It does not show individual animal records, does not allow editing farm data, and does not store personal farmer information \u2014 only aggregated statistics.");
  paragraph("All data comes from farmer activity in the Doc Aga mobile app. The dashboard requires an internet connection \u2014 data is always fetched live from the server.");

  // -- 2. Getting Started --
  heading("2. Getting Started", 14, 10);
  paragraph("Navigate to the Government Dashboard URL provided by your administrator and sign in with your government account credentials.");
  paragraph("Data Source Toggle (top-right): \"Live Data\" shows real farm data for actual monitoring. \"Demo Data\" shows sample training data for learning and training sessions.");
  table(
    [["Tab", "Purpose"]],
    [
      ["Livestock Analytics", "Farm population, health, breeding, and trend data"],
      ["Farmer Voice", "Farmer feedback, concerns, and sentiment analysis"],
      ["Programs & Insights", "Grant program effectiveness, milk production economics, platform adoption"],
    ]
  );

  // -- 3. Livestock Analytics --
  heading("3. Tab 1: Livestock Analytics", 14, 10);

  heading("3.1 Population Overview", 11, 7);
  table(
    [["Card", "What It Shows", "How It's Computed"]],
    [
      ["Active Farms", "Registered farms currently operating", "Count of farms where is_deleted = false, filtered by location"],
      ["Active Animals", "Total living animals across farms", "Count where exit_date is empty AND is_deleted = false"],
      ["Daily Logs", "Milking records in the date range", "Count of milking records with record_date in period"],
      ["Health Events", "Health check-ups and treatments", "Count of health records with visit_date in period, non-deleted animals"],
      ["Avg Milk (Liters)", "Average daily milk per record", "Total liters / number of milking records"],
      ["Doc Aga Queries", "AI assistant consultations", "Count of questions asked within selected period"],
    ]
  );
  paragraph("Each card shows a percentage change compared to the previous equivalent period. The Regional Livestock Distribution Map shows farm clusters by region with marker sizes indicating farm counts.");

  heading("3.2 Reproduction & Breeding", 11, 7);
  table(
    [["Metric", "Definition"]],
    [
      ["Heat Events", "Number of heat detection records logged in the period"],
      ["Avg Cycle (days)", "Average days between consecutive heats. Healthy: 18-24 days for cattle"],
      ["Ready for AI", "Female animals in optimal breeding window (heat 18-21 days ago)"],
      ["AI Scheduled", "AI procedures planned but not yet performed"],
      ["AI Performed", "AI procedures carried out"],
      ["Currently Pregnant", "Animals with confirmed pregnancy from AI records"],
      ["AI Success Rate", "(confirmed pregnancies / total AI performed) x 100"],
      ["Due This Quarter", "Pregnant animals with delivery expected this quarter"],
      ["Unique Semen Codes", "Distinct semen/bull codes used (genetic diversity indicator)"],
    ]
  );
  paragraph("The AI Success Rate chart shows breeding success by species. The Expected Deliveries Timeline shows monthly delivery counts with risk breakdowns (Critical, High, Moderate, Low).");

  heading("3.3 Animal Health & Welfare", 11, 7);
  table(
    [["Metric", "Definition"]],
    [
      ["Vaccination Compliance", "(completed / scheduled) x 100. Above 80% is healthy."],
      ["BCS (Body Condition Score)", "1-5 scale. Underweight <2.5, Optimal 2.5-4.0, Overweight >4.0"],
      ["Mortality Rate", "deaths / (active animals + deaths in period) x 100"],
      ["Total Exits", "Animals that left active herd (sold, died, culled, transferred, slaughtered)"],
      ["Prevalence Rate", "(health events / total animals) x 100"],
    ]
  );
  paragraph("Mortality rate interpretation: 0-2% (Healthy), 2-5% (Moderate \u2014 warrants attention), >5% (High Risk \u2014 requires investigation). The Animal Health Heatmap shows disease hotspots by municipality.");

  heading("3.4 Trends & Insights", 11, 7);
  paragraph("Three time-series charts: Farm Growth Trend (number of active farms over time), Livestock Composition Trend (stacked area by species), and Health Events Trend (daily health event counts). In comparison mode, overlay data appears as dashed lines.");

  // -- 4. Farmer Voice --
  heading("4. Tab 2: Farmer Voice", 14, 10);
  table(
    [["Section", "Description"]],
    [
      ["Dashboard Overview", "Total submissions, pending review, critical cases, last 7 days count"],
      ["Top Concerns", "Ranked list of most common feedback categories"],
      ["Feedback Priority Queue", "Cards with priority badges, feedback text, location, status workflow"],
      ["Geographic Heatmap", "Feedback volume and severity by municipality"],
      ["Sentiment Trend", "Stacked area chart (Urgent/Negative/Neutral/Positive) over 14 days"],
      ["Feedback Clusters", "Auto-grouped similar topics revealing systemic issues"],
      ["Smart Insights", "AI-generated geographic hotspots, trend alerts, recommended actions"],
    ]
  );
  paragraph("Feedback workflow states: Submitted \u2192 Acknowledged \u2192 Under Review \u2192 Action Taken \u2192 Resolved \u2192 Closed. Officers update status through the \"View & Action\" button.");

  // -- 5. Programs & Insights --
  heading("5. Tab 3: Programs & Insights", 14, 10);

  heading("5.1 Grant Program Distribution", 11, 7);
  paragraph("Shows how livestock was acquired: Grant Recipients (government programs), Purchased Animals (farmer-bought), Born on Farm, and Unknown. An acquisition overview bar visualizes the distribution.");

  heading("5.2 Grant Effectiveness", 11, 7);
  table(
    [["Metric", "Definition"]],
    [
      ["Health Events/Animal", "Average health records per animal. Lower is better."],
      ["Milk L/Animal", "Average milk per milking animal. Higher = better productivity."],
      ["Mortality Rate", "Percentage that died. Lower is better."],
      ["Breeding Success", "AI procedures resulting in pregnancy. Higher is better."],
    ]
  );
  paragraph("Compares outcomes between grant, purchased, and farm-born animals. Further breakdown by specific grant source is available.");

  heading("5.3 Production Economics", 11, 7);
  paragraph("Milk Production by Species: total production and revenue estimates with time-series chart. Market Price Intelligence: average prices per liter by species. Feed Security Status: farms classified as Critical (<7 days), Low (7-30 days), or Adequate (>30 days) with a Feed Security Index.");

  heading("5.4 Platform Adoption", 11, 7);
  paragraph("Top Farmer Queries: common AI assistant questions by topic. Farm Operational Health: system usage activity tracking. Data Quality Dashboard: completeness and accuracy monitoring.");

  // -- 6. Filters --
  heading("6. Filters & Data Controls", 14, 10);
  paragraph("Date Range presets: Last 7 Days, Last 30 Days, Last 90 Days, Custom Range. Date range affects time-dependent metrics but NOT cumulative counts (total farms, active animals).");
  paragraph("Location Filters cascade: Region \u2192 Province \u2192 Municipality. Leave blank to include all.");
  paragraph("Comparison Mode: overlay two datasets (different time periods, different regions, or any combination). Comparison data appears as dashed lines on charts.");
  paragraph("Data Category: Live (real data for reporting) or Demo (training data \u2014 do not use in official reports).");

  // -- 7. Exporting --
  heading("7. Exporting Data", 14, 10);
  paragraph("CSV Export: Available on Livestock Analytics tab. Exports filtered dataset as comma-separated values for spreadsheet analysis.");
  paragraph("PDF Export: Available on Livestock Analytics tab. Generates a formatted report of the current dashboard view for printing or sharing.");

  // -- 8. Glossary --
  heading("8. Glossary", 14, 10);
  table(
    [["Term", "Definition"]],
    [
      ["Active Animal", "Alive (exit_date empty) and not soft-deleted (is_deleted = false)"],
      ["AI (Artificial Insemination)", "Breeding technique \u2014 manual semen introduction. Not AI = Artificial Intelligence."],
      ["BCS", "Body Condition Score, 1-5 scale. Optimal: 2.5-4.0"],
      ["Carabao", "Philippine water buffalo for draft work and milk production"],
      ["Doc Aga", "AI veterinary assistant in the farmer mobile app"],
      ["Exit", "Animal leaving active herd (sold, died, culled, transferred, slaughtered)"],
      ["Grant Animal", "Animal distributed via government program, not purchased"],
      ["Heat Detection", "Identifying estrus (fertile period) in female animals"],
      ["Mortality Rate", "deaths / (active animals + deaths) x 100"],
      ["PCRS", "Pregnant Cow Risk Score \u2014 evaluates pregnancy risk factors"],
      ["Prevalence Rate", "(health events / total animals) x 100"],
      ["RLS", "Row-Level Security \u2014 ensures government sees only aggregated data"],
      ["Vaccination Compliance", "(completed / scheduled) x 100"],
    ]
  );

  // -- 9. FAQ --
  heading("9. Frequently Asked Questions", 14, 10);
  const faqs = [
    ["Why do numbers on different tabs sometimes not match?", "Each tab may use different date ranges or filter contexts. Ensure filters are consistent. Active Animals should match between Livestock Analytics and Programs & Insights with same filters."],
    ["What does \"No data available\" mean?", "No records exist for current filters. Try expanding date range or removing location filters."],
    ["How often is data updated?", "Real-time as farmers submit records. Some aggregations may take a few seconds."],
    ["Can I see which specific farm has a problem?", "Government dashboard shows municipality-level aggregated data. For farm-level, coordinate with your regional agricultural officer."],
    ["What if mortality rate is above 5%?", "Check Animal Health Heatmap for affected areas, review health event types, coordinate veterinary response, and monitor Farmer Voice for related concerns."],
    ["How is Feed Security Index calculated?", "Percentage of farms with >30 days of feed remaining. Farms <7 days are Critical."],
    ["What does Comparison Mode compare?", "Overlays two datasets: quarter vs quarter, region vs region, or before/after a program intervention."],
  ];
  faqs.forEach(([q, a]) => {
    addPageIfNeededManual(16);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const qLines = doc.splitTextToSize(`Q: ${q}`, contentWidth);
    doc.text(qLines, margin, y);
    y += qLines.length * 4 + 1;
    doc.setFont("helvetica", "normal");
    const aLines = doc.splitTextToSize(`A: ${a}`, contentWidth);
    addPageIfNeededManual(aLines.length * 4 + 4);
    doc.text(aLines, margin, y);
    y += aLines.length * 4 + 5;
  });

  // -- Footer on all pages --
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.text(
      `Doc Aga Government Dashboard Manual v1.0  |  Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
  }

  doc.save("Government-Dashboard-Manual.pdf");
};
