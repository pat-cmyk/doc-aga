import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { 
  FinancialCapacityReport, 
  formatCurrency, 
  formatCurrencyDecimal 
} from "./financialReportGenerator";

export function exportReportToPDF(report: FinancialCapacityReport): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Helper function
  const addSectionTitle = (title: string) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(33, 37, 41);
    doc.text(title, 14, yPos);
    yPos += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  };

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 100, 0); // Dark green
  doc.text("FARMER FINANCIAL CAPACITY REPORT", pageWidth / 2, yPos, { align: "center" });
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(
    `Period: ${format(new Date(report.periodStart), "MMM d, yyyy")} - ${format(new Date(report.periodEnd), "MMM d, yyyy")}`,
    pageWidth / 2,
    yPos,
    { align: "center" }
  );
  yPos += 5;
  doc.text(
    `Generated: ${format(new Date(report.generatedAt), "MMMM d, yyyy 'at' h:mm a")}`,
    pageWidth / 2,
    yPos,
    { align: "center" }
  );
  yPos += 12;

  // Section 1: Farm Profile
  addSectionTitle("1. FARM PROFILE & TECHNICAL PARAMETRICS");
  
  autoTable(doc, {
    startY: yPos,
    head: [["Field", "Value"]],
    body: [
      ["Farmer/Entity Name", report.farmProfile.ownerName],
      ["Farm Name", report.farmProfile.farmName],
      ["Geo-Location", report.farmProfile.gpsLat && report.farmProfile.gpsLng 
        ? `Lat: ${report.farmProfile.gpsLat?.toFixed(4)}, Long: ${report.farmProfile.gpsLng?.toFixed(4)}`
        : "Not recorded"],
      ["Region", report.farmProfile.region || "Not specified"],
      ["Province", report.farmProfile.province || "Not specified"],
      ["Municipality", report.farmProfile.municipality || "Not specified"],
      ["Livestock Type", report.farmProfile.livestockType],
      ["Total Active Animals", `${report.farmProfile.totalActiveAnimals} head`],
    ],
    theme: "striped",
    headStyles: { fillColor: [76, 175, 80], textColor: 255 },
    styles: { fontSize: 9 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Section 2: Herd Composition
  addSectionTitle("2. HERD COMPOSITION & ASSET VALUATION");

  if (report.herdSummary.composition.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [["Category", "Count", "Acquisition", "Est. Value (₱)"]],
      body: [
        ...report.herdSummary.composition.map((c) => [
          c.category,
          c.count.toString(),
          c.acquisitionType,
          formatCurrency(c.estimatedValue),
        ]),
        ["TOTAL", report.herdSummary.totalAnimals.toString(), "", formatCurrency(report.herdSummary.totalValue)],
      ],
      theme: "striped",
      headStyles: { fillColor: [76, 175, 80], textColor: 255 },
      styles: { fontSize: 9 },
      footStyles: { fontStyle: "bold" },
    });
    yPos = (doc as any).lastAutoTable.finalY + 5;
  }

  // Technical metrics
  doc.setFontSize(9);
  doc.text(`Average Animal Weight: ${report.herdSummary.averageWeight?.toFixed(1) || "N/A"} kg`, 14, yPos);
  yPos += 5;
  doc.text(`Market Price Used: ${formatCurrency(report.herdSummary.marketPricePerKg)}/kg live weight`, 14, yPos);
  yPos += 10;

  // Section 3: Current Assets & Inventory (NEW)
  addSectionTitle("3. CURRENT ASSETS & INVENTORY");

  // Feed Inventory sub-table
  if (report.currentAssets.feedInventory.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Feed Inventory (as of report date)", 14, yPos);
    yPos += 5;
    doc.setFont("helvetica", "normal");

    autoTable(doc, {
      startY: yPos,
      head: [["Category", "Quantity (kg)", "Value (\u20B1)"]],
      body: [
        ...report.currentAssets.feedInventory.map((f) => [
          f.category,
          f.quantityKg.toLocaleString(),
          formatCurrency(f.valuePhp),
        ]),
        ["TOTAL FEED INVENTORY", "", formatCurrency(report.currentAssets.feedInventoryTotal)],
      ],
      theme: "striped",
      headStyles: { fillColor: [76, 175, 80], textColor: 255 },
      styles: { fontSize: 9 },
      footStyles: { fontStyle: "bold" },
    });
    yPos = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.setFontSize(9);
    doc.text("No feed inventory data available.", 14, yPos);
    yPos += 5;
  }

  // Milk Inventory sub-table
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Milk Inventory (unsold stock)", 14, yPos);
  yPos += 5;
  doc.setFont("helvetica", "normal");

  const milkRows: string[][] = [];
  report.currentAssets.milkInventoryGood.speciesBreakdown.forEach((s) => {
    milkRows.push([
      `${s.species} (Good Quality)`,
      `${s.liters.toFixed(1)} L`,
      `\u20B1${s.pricePerLiter}/L`,
      formatCurrency(s.value),
    ]);
  });
  if (report.currentAssets.milkInventoryRejected.litersRemaining > 0) {
    milkRows.push([
      "Rejected Milk (feed-only)",
      `${report.currentAssets.milkInventoryRejected.litersRemaining.toFixed(1)} L`,
      "\u20B10/L",
      "\u20B10",
    ]);
  }

  if (milkRows.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [["Type", "Quantity", "Price", "Value (\u20B1)"]],
      body: [
        ...milkRows,
        ["TOTAL MILK VALUE", "", "", formatCurrency(report.currentAssets.milkInventoryGood.valuePhp)],
      ],
      theme: "striped",
      headStyles: { fillColor: [76, 175, 80], textColor: 255 },
      styles: { fontSize: 9 },
      footStyles: { fontStyle: "bold" },
    });
    yPos = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.setFontSize(9);
    doc.text("No milk inventory data available.", 14, yPos);
    yPos += 5;
  }

  // Total current assets
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Total Current Assets: ${formatCurrency(report.currentAssets.totalCurrentAssets)}`,
    14, yPos
  );
  doc.setFont("helvetica", "normal");
  yPos += 10;

  // Section 4: Production Performance
  addSectionTitle("4. PRODUCTION PERFORMANCE HISTORY");

  autoTable(doc, {
    startY: yPos,
    head: [["Metric", "Value", "Benchmark", "Status"]],
    body: [
      [
        "Total Milk Production",
        `${report.productionMetrics.totalMilkProduction.toLocaleString()} L (${report.productionMetrics.monthsOfData} months)`,
        "-",
        "-",
      ],
      [
        "Avg Daily Production/Animal",
        `${report.productionMetrics.avgDailyProductionPerAnimal.toFixed(1)} L`,
        "15-20 L",
        report.productionMetrics.avgDailyProductionPerAnimal >= 15 ? "OK - Within Range" : "Below Target",
      ],
      [
        "Average Daily Gain",
        report.productionMetrics.avgDailyGain 
          ? `${report.productionMetrics.avgDailyGain.toFixed(2)} kg/day`
          : "N/A",
        "0.6-0.8 kg",
        report.productionMetrics.avgDailyGain && report.productionMetrics.avgDailyGain >= 0.6 
          ? "OK - Acceptable" 
          : "Monitor",
      ],
      [
        "Mortality Rate (Period)",
        `${report.productionMetrics.mortalityRate.toFixed(1)}%`,
        "< 3%",
        report.productionMetrics.mortalityRate < 3 ? "OK - Low Risk" : "ALERT - Review",
      ],
    ],
    theme: "striped",
    headStyles: { fillColor: [76, 175, 80], textColor: 255 },
    styles: { fontSize: 9 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Check for new page
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  // Section 5: Cost Structure (Accrual for feed)
  addSectionTitle("5. COST STRUCTURE ANALYSIS");

  if (report.costStructure.operationalCosts.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [["Cost Category", "Amount (₱)", "% of Total"]],
      body: [
        ...report.costStructure.operationalCosts.map((c) => [
          c.category,
          formatCurrency(c.amount),
          `${c.percentage.toFixed(1)}%`,
        ]),
        ["TOTAL OPERATIONAL", formatCurrency(report.costStructure.totalOperational), "100%"],
      ],
      theme: "striped",
      headStyles: { fillColor: [76, 175, 80], textColor: 255 },
      styles: { fontSize: 9 },
      footStyles: { fontStyle: "bold" },
    });
    yPos = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.text("No operational expenses recorded for this period.", 14, yPos);
    yPos += 5;
  }

  // Accrual note for feed costs
  if (report.costStructure.feedCostBasis === 'accrual') {
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
      `Feed costs: Accrual basis (consumed: ${formatCurrency(report.costStructure.feedConsumedAmount)}) | Cash basis (purchased: ${formatCurrency(report.costStructure.feedPurchasedAmount)})`,
      14, yPos
    );
    yPos += 5;
    doc.setTextColor(33, 37, 41);
  }
  if (report.costStructure.feedConsumptionNote) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150);
    doc.text(`Note: ${report.costStructure.feedConsumptionNote}`, 14, yPos);
    yPos += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(33, 37, 41);
  }
  yPos += 5;

  // Section 6: Revenue & Cash Flow (cash-basis, unchanged)
  addSectionTitle("6. REVENUE & CASH FLOW STATEMENT");

  if (report.cashFlow.revenueBreakdown.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [["Revenue Source", "Amount (₱)", "% of Total"]],
      body: [
        ...report.cashFlow.revenueBreakdown.map((r) => [
          r.source,
          formatCurrency(r.amount),
          `${r.percentage.toFixed(1)}%`,
        ]),
        ["GROSS REVENUE", formatCurrency(report.cashFlow.grossRevenue), "100%"],
      ],
      theme: "striped",
      headStyles: { fillColor: [76, 175, 80], textColor: 255 },
      styles: { fontSize: 9 },
      footStyles: { fontStyle: "bold" },
    });
    yPos = (doc as any).lastAutoTable.finalY + 5;
  }

  // Cash Flow Summary
  autoTable(doc, {
    startY: yPos,
    head: [["Cash Flow Line Item", "Amount (₱)"]],
    body: [
      ["Gross Revenue", formatCurrency(report.cashFlow.grossRevenue)],
      ["Less: Operational Costs", `(${formatCurrency(report.cashFlow.operationalCosts)})`],
      ["NET FARM INCOME", formatCurrency(report.cashFlow.netFarmIncome)],
      ["Less: Personal/Household", `(${formatCurrency(report.cashFlow.personalExpenses)})`],
      ["NET CASH AVAILABLE", formatCurrency(report.cashFlow.netCashAvailable)],
    ],
    theme: "striped",
    headStyles: { fillColor: [33, 150, 243], textColor: 255 },
    styles: { fontSize: 9 },
    didParseCell: function(data: any) {
      // Bold the NET FARM INCOME and NET CASH AVAILABLE rows
      if (data.row.index === 2 || data.row.index === 4) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Check for new page
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  // Section 7: Financial Ratios
  addSectionTitle("7. KEY FINANCIAL RATIOS");

  autoTable(doc, {
    startY: yPos,
    head: [["Ratio", "Value", "Bank Insight"]],
    body: [
      [
        "Return on Investment (ROI)",
        `${report.financialRatios.roi.toFixed(1)}%`,
        report.financialRatios.roi >= 15 ? "GOOD - ROI of 15-25% is healthy for livestock" : "Below typical range (15-25%)",
      ],
      [
        "Breakeven Price (per liter)",
        report.financialRatios.breakevenPricePerLiter 
          ? formatCurrencyDecimal(report.financialRatios.breakevenPricePerLiter)
          : "N/A",
        "Cost to produce one liter of milk",
      ],
      [
        "Current Selling Price",
        report.financialRatios.currentSellingPrice 
          ? formatCurrencyDecimal(report.financialRatios.currentSellingPrice)
          : "N/A",
        "Average price received",
      ],
      [
        "Price Margin",
        report.financialRatios.priceMargin 
          ? `${report.financialRatios.priceMargin.toFixed(1)}%`
          : "N/A",
        report.financialRatios.priceMargin && report.financialRatios.priceMargin > 20 
          ? "GOOD - Healthy margin" 
          : "Monitor pricing",
      ],
    ],
    theme: "striped",
    headStyles: { fillColor: [76, 175, 80], textColor: 255 },
    styles: { fontSize: 9 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Section 8: Data Completeness
  addSectionTitle("8. SUPPORTING EVIDENCE CHECKLIST");

  const checklistItems = [
    [report.dataCompleteness.hasGeoLocation ? "YES" : "NO", "Farm geo-location recorded"],
    [report.dataCompleteness.hasAnimalInventory ? "YES" : "NO", "Animal inventory with details"],
    [report.dataCompleteness.hasWeightRecords ? "YES" : "NO", "Weight records available"],
    [report.dataCompleteness.hasProductionRecords ? "YES" : "NO", `Production records (${report.productionMetrics.monthsOfData} months of data)`],
    [report.dataCompleteness.hasExpenseTracking ? "YES" : "NO", `Expense tracking (${report.dataCompleteness.monthsOfExpenseData} months of data)`],
    [report.dataCompleteness.hasRevenueDocumentation ? "YES" : "NO", `Revenue documentation (${report.dataCompleteness.monthsOfRevenueData} months of data)`],
    [report.dataCompleteness.hasFeedingRecords ? "YES" : "NO", "Feeding records (for accrual cost basis)"],
    [report.dataCompleteness.hasFeedInventory ? "YES" : "NO", "Feed inventory tracked"],
    [report.dataCompleteness.hasMilkInventory ? "YES" : "NO", "Milk inventory tracked"],
  ];

  autoTable(doc, {
    startY: yPos,
    body: checklistItems,
    theme: "plain",
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
      1: { cellWidth: "auto" },
    },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 0) {
        const isYes = data.cell.raw === "YES";
        data.cell.styles.textColor = isYes ? [76, 175, 80] : [244, 67, 54];
      }
    },
  });
  yPos = (doc as any).lastAutoTable.finalY + 5;

  // Data completeness score
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  const scoreColor = report.dataCompleteness.completenessScore >= 80 
    ? [76, 175, 80] 
    : report.dataCompleteness.completenessScore >= 50 
    ? [255, 152, 0] 
    : [244, 67, 54];
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.text(`Data Completeness Score: ${report.dataCompleteness.completenessScore.toFixed(0)}%`, 14, yPos);
  yPos += 8;

  // Missing items
  if (report.dataCompleteness.missingItems.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(244, 67, 54);
    doc.text("Recommended additions:", 14, yPos);
    yPos += 5;
    report.dataCompleteness.missingItems.forEach((item) => {
      doc.text(`• ${item}`, 18, yPos);
      yPos += 4;
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Generated by Doc Aga Farm Management System | Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  // Save the PDF
  const filename = `${report.farmProfile.farmName.replace(/\s+/g, "_")}_Financial_Report_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}

export function exportReportToCSV(report: FinancialCapacityReport): void {
  const lines: string[] = [];
  const addLine = (...cols: (string | number)[]) => {
    lines.push(cols.map((c) => `"${c}"`).join(","));
  };

  // Header
  addLine("FARMER FINANCIAL CAPACITY REPORT");
  addLine("Period", `${report.periodStart} to ${report.periodEnd}`);
  addLine("Generated", format(new Date(report.generatedAt), "yyyy-MM-dd HH:mm:ss"));
  addLine("");

  // Farm Profile
  addLine("SECTION 1: FARM PROFILE");
  addLine("Field", "Value");
  addLine("Farm Name", report.farmProfile.farmName);
  addLine("Owner Name", report.farmProfile.ownerName);
  addLine("Latitude", report.farmProfile.gpsLat || "N/A");
  addLine("Longitude", report.farmProfile.gpsLng || "N/A");
  addLine("Region", report.farmProfile.region || "N/A");
  addLine("Province", report.farmProfile.province || "N/A");
  addLine("Municipality", report.farmProfile.municipality || "N/A");
  addLine("Livestock Type", report.farmProfile.livestockType);
  addLine("Total Active Animals", report.farmProfile.totalActiveAnimals);
  addLine("");

  // Herd Composition
  addLine("SECTION 2: HERD COMPOSITION");
  addLine("Category", "Count", "Acquisition Type", "Estimated Value (PHP)");
  report.herdSummary.composition.forEach((c) => {
    addLine(c.category, c.count, c.acquisitionType, c.estimatedValue);
  });
  addLine("TOTAL", report.herdSummary.totalAnimals, "", report.herdSummary.totalValue);
  addLine("");
  addLine("Average Weight (kg)", report.herdSummary.averageWeight || "N/A");
  addLine("Market Price (PHP/kg)", report.herdSummary.marketPricePerKg);
  addLine("");

  // Current Assets & Inventory
  addLine("SECTION 3: CURRENT ASSETS & INVENTORY");
  addLine("");
  addLine("FEED INVENTORY");
  addLine("Category", "Quantity (kg)", "Value (PHP)");
  report.currentAssets.feedInventory.forEach((f) => {
    addLine(f.category, f.quantityKg.toFixed(1), f.valuePhp.toFixed(2));
  });
  addLine("TOTAL FEED INVENTORY", "", report.currentAssets.feedInventoryTotal.toFixed(2));
  addLine("");
  addLine("MILK INVENTORY (GOOD QUALITY)");
  addLine("Species", "Liters", "Price/L (PHP)", "Value (PHP)");
  report.currentAssets.milkInventoryGood.speciesBreakdown.forEach((s) => {
    addLine(s.species, s.liters.toFixed(1), s.pricePerLiter, s.value.toFixed(2));
  });
  addLine("TOTAL GOOD MILK VALUE", "", "", report.currentAssets.milkInventoryGood.valuePhp.toFixed(2));
  addLine("");
  addLine("REJECTED MILK (FEED-ONLY)");
  addLine("Liters", report.currentAssets.milkInventoryRejected.litersRemaining.toFixed(1));
  addLine("Value (PHP)", 0);
  addLine("");
  addLine("TOTAL CURRENT ASSETS", report.currentAssets.totalCurrentAssets.toFixed(2));
  addLine("");

  // Production Metrics
  addLine("SECTION 4: PRODUCTION METRICS");
  addLine("Metric", "Value");
  addLine("Total Milk Production (L)", report.productionMetrics.totalMilkProduction);
  addLine("Avg Daily Production/Animal (L)", report.productionMetrics.avgDailyProductionPerAnimal.toFixed(2));
  addLine("Milking Animals Count", report.productionMetrics.milkingAnimalsCount);
  addLine("Average Daily Gain (kg)", report.productionMetrics.avgDailyGain?.toFixed(2) || "N/A");
  addLine("Mortality Rate (%)", report.productionMetrics.mortalityRate.toFixed(2));
  addLine("Months of Data", report.productionMetrics.monthsOfData);
  addLine("");

  // Cost Structure (Accrual)
  addLine("SECTION 5: COST STRUCTURE");
  addLine("Cost Basis", report.costStructure.feedCostBasis === 'accrual' ? "Accrual (feed consumption-based)" : "Cash (feed purchase-based)");
  addLine("Feed Consumed (Accrual)", report.costStructure.feedConsumedAmount.toFixed(2));
  addLine("Feed Purchased (Cash)", report.costStructure.feedPurchasedAmount.toFixed(2));
  if (report.costStructure.feedConsumptionNote) {
    addLine("Note", report.costStructure.feedConsumptionNote);
  }
  addLine("");
  addLine("Category", "Amount (PHP)", "Percentage");
  report.costStructure.operationalCosts.forEach((c) => {
    addLine(c.category, c.amount, `${c.percentage.toFixed(1)}%`);
  });
  addLine("TOTAL OPERATIONAL", report.costStructure.totalOperational, "100%");
  addLine("");

  // Revenue & Cash Flow (cash-basis)
  addLine("SECTION 6: REVENUE & CASH FLOW");
  addLine("Source", "Amount (PHP)", "Percentage");
  report.cashFlow.revenueBreakdown.forEach((r) => {
    addLine(r.source, r.amount, `${r.percentage.toFixed(1)}%`);
  });
  addLine("GROSS REVENUE", report.cashFlow.grossRevenue, "100%");
  addLine("");
  addLine("Cash Flow Summary");
  addLine("Gross Revenue", report.cashFlow.grossRevenue);
  addLine("Operational Costs", report.cashFlow.operationalCosts);
  addLine("Net Farm Income", report.cashFlow.netFarmIncome);
  addLine("Personal Expenses", report.cashFlow.personalExpenses);
  addLine("Net Cash Available", report.cashFlow.netCashAvailable);
  addLine("");

  // Financial Ratios
  addLine("SECTION 7: FINANCIAL RATIOS");
  addLine("Ratio", "Value");
  addLine("ROI (%)", report.financialRatios.roi.toFixed(2));
  addLine("Breakeven Price/Liter (PHP)", report.financialRatios.breakevenPricePerLiter?.toFixed(2) || "N/A");
  addLine("Current Selling Price (PHP)", report.financialRatios.currentSellingPrice?.toFixed(2) || "N/A");
  addLine("Price Margin (%)", report.financialRatios.priceMargin?.toFixed(2) || "N/A");
  addLine("");

  // Data Completeness
  addLine("SECTION 8: DATA COMPLETENESS");
  addLine("Check", "Status");
  addLine("Geo-location", report.dataCompleteness.hasGeoLocation ? "Yes" : "No");
  addLine("Animal Inventory", report.dataCompleteness.hasAnimalInventory ? "Yes" : "No");
  addLine("Weight Records", report.dataCompleteness.hasWeightRecords ? "Yes" : "No");
  addLine("Production Records", report.dataCompleteness.hasProductionRecords ? "Yes" : "No");
  addLine("Expense Tracking", report.dataCompleteness.hasExpenseTracking ? "Yes" : "No");
  addLine("Revenue Documentation", report.dataCompleteness.hasRevenueDocumentation ? "Yes" : "No");
  addLine("Feeding Records", report.dataCompleteness.hasFeedingRecords ? "Yes" : "No");
  addLine("Feed Inventory", report.dataCompleteness.hasFeedInventory ? "Yes" : "No");
  addLine("Milk Inventory", report.dataCompleteness.hasMilkInventory ? "Yes" : "No");
  addLine("Completeness Score (%)", report.dataCompleteness.completenessScore.toFixed(0));

  // Create and download
  const csvContent = lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `${report.farmProfile.farmName.replace(/\s+/g, "_")}_Financial_Report_${format(new Date(), "yyyy-MM-dd")}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
