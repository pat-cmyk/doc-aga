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
    csv += `Average Purchase Price,${ga.avgPurchasePrice.toFixed(2)}\n`;
    
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
    csv += `Total Herd Investment,${ri.totalHerdInvestment.toFixed(2)}\n`;
    csv += `Total Animal Expenses,${ri.totalAnimalExpenses.toFixed(2)}\n`;
    csv += `Average Investment Per Farm,${ri.averageInvestmentPerFarm.toFixed(2)}\n`;
    csv += `Average Investment Per Animal,${ri.averageInvestmentPerAnimal.toFixed(2)}\n`;
    csv += `Total Farms,${ri.farmCount}\n`;
    csv += `Total Animals,${ri.animalCount}\n`;
  }

  // Veterinary Expenses Section
  if (data.veterinaryExpenses) {
    const ve = data.veterinaryExpenses;
    csv += "\n\nVeterinary Expense Summary\n";
    csv += "Metric,Value\n";
    csv += `Total Veterinary Services,${ve.totalVetExpenses.toFixed(2)}\n`;
    csv += `Total Medicine & Vaccines,${ve.totalMedicineExpenses.toFixed(2)}\n`;
    csv += `Combined Total,${ve.totalCombined.toFixed(2)}\n`;
    csv += `Average Cost Per Animal,${ve.avgCostPerAnimal.toFixed(2)}\n`;
    csv += `Total Animals,${ve.totalAnimals}\n`;
    csv += `Total Farms,${ve.totalFarms}\n`;
    
    if (ve.byLocation.length > 0) {
      csv += "\nVeterinary Expense Hotspots (Top 10)\n";
      csv += "Municipality,Province,Total Expenses,Animals,Cost Per Animal\n";
      ve.byLocation.slice(0, 10).forEach(loc => {
        csv += `"${loc.municipality}","${loc.province}",${loc.combinedTotal.toFixed(2)},${loc.animalCount},${loc.costPerAnimal.toFixed(2)}\n`;
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
