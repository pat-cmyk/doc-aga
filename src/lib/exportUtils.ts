import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { GovStatsWithGrowth, TimeseriesDataPoint, HeatmapData } from "@/hooks/useGovernmentStats";
import type { GrantAnalytics } from "@/hooks/useGrantAnalytics";
import type { RegionalInvestmentData } from "@/hooks/useRegionalInvestment";
import type { VeterinaryExpenseSummary } from "@/hooks/useVeterinaryExpenseHeatmap";

interface ExportData {
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
  // Phase 3 additions
  grantAnalytics?: GrantAnalytics;
  regionalInvestment?: RegionalInvestmentData;
  veterinaryExpenses?: VeterinaryExpenseSummary;
}

export const exportToCSV = (data: ExportData) => {
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
    csv += `Average Purchase Price,₱${ga.avgPurchasePrice.toFixed(2)}\n`;
    
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
    csv += `Total Herd Investment,₱${ri.totalHerdInvestment.toFixed(2)}\n`;
    csv += `Total Animal Expenses,₱${ri.totalAnimalExpenses.toFixed(2)}\n`;
    csv += `Average Investment Per Farm,₱${ri.averageInvestmentPerFarm.toFixed(2)}\n`;
    csv += `Average Investment Per Animal,₱${ri.averageInvestmentPerAnimal.toFixed(2)}\n`;
    csv += `Total Farms,${ri.farmCount}\n`;
    csv += `Total Animals,${ri.animalCount}\n`;
  }

  // Veterinary Expenses Section
  if (data.veterinaryExpenses) {
    const ve = data.veterinaryExpenses;
    csv += "\n\nVeterinary Expense Summary\n";
    csv += "Metric,Value\n";
    csv += `Total Veterinary Services,₱${ve.totalVetExpenses.toFixed(2)}\n`;
    csv += `Total Medicine & Vaccines,₱${ve.totalMedicineExpenses.toFixed(2)}\n`;
    csv += `Combined Total,₱${ve.totalCombined.toFixed(2)}\n`;
    csv += `Average Cost Per Animal,₱${ve.avgCostPerAnimal.toFixed(2)}\n`;
    csv += `Total Animals,${ve.totalAnimals}\n`;
    csv += `Total Farms,${ve.totalFarms}\n`;
    
    if (ve.byLocation.length > 0) {
      csv += "\nVeterinary Expense Hotspots (Top 10)\n";
      csv += "Municipality,Province,Total Expenses,Animals,Cost Per Animal\n";
      ve.byLocation.slice(0, 10).forEach(loc => {
        csv += `"${loc.municipality}","${loc.province}",₱${loc.combinedTotal.toFixed(2)},${loc.animalCount},₱${loc.costPerAnimal.toFixed(2)}\n`;
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

export const exportToPDF = (data: ExportData) => {
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
    
    const tableData = [];
    
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

  const addPageIfNeeded = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
  };

  const heading = (text: string, size: number, space = 8) => {
    addPageIfNeeded(size + space + 4);
    doc.setFontSize(size);
    doc.setFont("helvetica", "bold");
    doc.text(text, margin, y);
    y += space;
  };

  const paragraph = (text: string) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(text, contentWidth);
    addPageIfNeeded(lines.length * 4 + 2);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 3;
  };

  const table = (head: string[][], body: string[][]) => {
    addPageIfNeeded(20);
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

  // ── Title Page ──
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

  // ── Table of Contents ──
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

  // ── 1. Introduction ──
  heading("1. Introduction", 14, 10);
  paragraph("The Doc Aga Government Dashboard is a web-based analytics portal that aggregates livestock farm data across Philippine regions. It provides government officers with evidence-based insights for policy decisions, program evaluation, and farmer support.");
  paragraph("What it does: Displays cross-farm statistics, tracks livestock population/health/breeding/milk production trends, captures and analyzes farmer feedback, and measures grant program effectiveness.");
  paragraph("What it does NOT do: It does not show individual animal records, does not allow editing farm data, and does not store personal farmer information — only aggregated statistics.");
  paragraph("All data comes from farmer activity in the Doc Aga mobile app. The dashboard requires an internet connection — data is always fetched live from the server.");

  // ── 2. Getting Started ──
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

  // ── 3. Livestock Analytics ──
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
  paragraph("Mortality rate interpretation: 0-2% (Healthy), 2-5% (Moderate — warrants attention), >5% (High Risk — requires investigation). The Animal Health Heatmap shows disease hotspots by municipality.");

  heading("3.4 Trends & Insights", 11, 7);
  paragraph("Three time-series charts: Farm Growth Trend (number of active farms over time), Livestock Composition Trend (stacked area by species), and Health Events Trend (daily health event counts). In comparison mode, overlay data appears as dashed lines.");

  // ── 4. Farmer Voice ──
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
  paragraph("Feedback workflow states: Submitted → Acknowledged → Under Review → Action Taken → Resolved → Closed. Officers update status through the \"View & Action\" button.");

  // ── 5. Programs & Insights ──
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

  // ── 6. Filters ──
  heading("6. Filters & Data Controls", 14, 10);
  paragraph("Date Range presets: Last 7 Days, Last 30 Days, Last 90 Days, Custom Range. Date range affects time-dependent metrics but NOT cumulative counts (total farms, active animals).");
  paragraph("Location Filters cascade: Region → Province → Municipality. Leave blank to include all.");
  paragraph("Comparison Mode: overlay two datasets (different time periods, different regions, or any combination). Comparison data appears as dashed lines on charts.");
  paragraph("Data Category: Live (real data for reporting) or Demo (training data — do not use in official reports).");

  // ── 7. Exporting ──
  heading("7. Exporting Data", 14, 10);
  paragraph("CSV Export: Available on Livestock Analytics tab. Exports filtered dataset as comma-separated values for spreadsheet analysis.");
  paragraph("PDF Export: Available on Livestock Analytics tab. Generates a formatted report of the current dashboard view for printing or sharing.");

  // ── 8. Glossary ──
  heading("8. Glossary", 14, 10);
  table(
    [["Term", "Definition"]],
    [
      ["Active Animal", "Alive (exit_date empty) and not soft-deleted (is_deleted = false)"],
      ["AI (Artificial Insemination)", "Breeding technique — manual semen introduction. Not AI = Artificial Intelligence."],
      ["BCS", "Body Condition Score, 1-5 scale. Optimal: 2.5-4.0"],
      ["Carabao", "Philippine water buffalo for draft work and milk production"],
      ["Doc Aga", "AI veterinary assistant in the farmer mobile app"],
      ["Exit", "Animal leaving active herd (sold, died, culled, transferred, slaughtered)"],
      ["Grant Animal", "Animal distributed via government program, not purchased"],
      ["Heat Detection", "Identifying estrus (fertile period) in female animals"],
      ["Mortality Rate", "deaths / (active animals + deaths) x 100"],
      ["PCRS", "Pregnant Cow Risk Score — evaluates pregnancy risk factors"],
      ["Prevalence Rate", "(health events / total animals) x 100"],
      ["RLS", "Row-Level Security — ensures government sees only aggregated data"],
      ["Vaccination Compliance", "(completed / scheduled) x 100"],
    ]
  );

  // ── 9. FAQ ──
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
    addPageIfNeeded(16);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const qLines = doc.splitTextToSize(`Q: ${q}`, contentWidth);
    doc.text(qLines, margin, y);
    y += qLines.length * 4 + 1;
    doc.setFont("helvetica", "normal");
    const aLines = doc.splitTextToSize(`A: ${a}`, contentWidth);
    addPageIfNeeded(aLines.length * 4 + 4);
    doc.text(aLines, margin, y);
    y += aLines.length * 4 + 5;
  });

  // ── Footer on all pages ──
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
