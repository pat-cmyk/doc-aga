import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { AuditReportData } from "@/types/auditReport";

export function exportAuditReportToPDF(report: AuditReportData): void {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  const addSectionTitle = (title: string) => {
    if (yPos > 170) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(33, 37, 41);
    doc.text(title, 14, yPos);
    yPos += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
  };

  const getLastTableY = () => (doc as any).lastAutoTable?.finalY ?? yPos;

  // ============================================
  // TITLE
  // ============================================
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 80, 0);
  doc.text("DATA INTEGRITY AUDIT REPORT", pageWidth / 2, yPos, { align: "center" });
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(
    `Farm: ${report.farm_summary.farm_name} | Owner: ${report.farm_summary.owner_name}`,
    pageWidth / 2, yPos, { align: "center" }
  );
  yPos += 5;
  doc.text(
    `Period: ${report.farm_summary.period_start} to ${report.farm_summary.period_end}`,
    pageWidth / 2, yPos, { align: "center" }
  );
  yPos += 5;
  doc.text(
    `Generated: ${format(new Date(report.farm_summary.generated_at), "MMMM d, yyyy 'at' h:mm a")}`,
    pageWidth / 2, yPos, { align: "center" }
  );
  yPos += 12;

  // ============================================
  // 1. FARM SUMMARY
  // ============================================
  addSectionTitle("1. Farm Summary");
  autoTable(doc, {
    startY: yPos,
    head: [["Field", "Value"]],
    body: [
      ["Farm Name", report.farm_summary.farm_name],
      ["Owner", report.farm_summary.owner_name],
      ["Region", report.farm_summary.region || "—"],
      ["Audit Period", `${report.farm_summary.period_start} to ${report.farm_summary.period_end}`],
      ["Active Animals", String(report.farm_summary.total_active_animals)],
      ["Registered Users", String(report.farm_summary.total_users)],
    ],
    theme: "striped",
    headStyles: { fillColor: [34, 87, 34] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 60 } },
  });
  yPos = getLastTableY() + 10;

  // ============================================
  // 2. DAILY ENTRY LOG
  // ============================================
  addSectionTitle("2. Daily Data Entry Log");
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("Records grouped by the date they were entered into the system and by user.", 14, yPos);
  yPos += 5;

  const formatRole = (role: string) => {
    switch (role) {
      case "farmer_owner": return "Owner";
      case "farmhand": return "Farmhand";
      case "vet": return "Vet";
      default: return role;
    }
  };

  autoTable(doc, {
    startY: yPos,
    head: [["Entry Date", "User", "Role", "Milking", "Feeding", "Health", "Weight", "Injection", "Expense", "Revenue", "Total"]],
    body: report.daily_entry_log.map((row) => [
      row.entry_date,
      row.user_name,
      formatRole(row.role),
      row.milking_count || "—",
      row.feeding_count || "—",
      row.health_count || "—",
      row.weight_count || "—",
      row.injection_count || "—",
      row.expense_count || "—",
      row.revenue_count || "—",
      row.total,
    ]),
    theme: "striped",
    headStyles: { fillColor: [34, 87, 34], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 28 },
      10: { fontStyle: "bold" },
    },
  });
  yPos = getLastTableY() + 10;

  // ============================================
  // 3. TEMPORAL INTEGRITY
  // ============================================
  addSectionTitle("3. Temporal Integrity Metrics");

  // Backdating ratio
  const backdateTypes = Object.keys(report.temporal_integrity.backdating_ratio).filter((k) => k !== "overall");
  autoTable(doc, {
    startY: yPos,
    head: [["Metric", ...backdateTypes.map((t) => t.charAt(0).toUpperCase() + t.slice(1)), "Overall"]],
    body: [
      [
        "Backdating Ratio (%)",
        ...backdateTypes.map((t) => `${report.temporal_integrity.backdating_ratio[t]}%`),
        `${report.temporal_integrity.backdating_ratio.overall}%`,
      ],
    ],
    theme: "striped",
    headStyles: { fillColor: [34, 87, 34], fontSize: 8 },
    styles: { fontSize: 8 },
    columnStyles: { 0: { fontStyle: "bold" } },
  });
  yPos = getLastTableY() + 6;

  // Continuity scores
  const contTypes = Object.keys(report.temporal_integrity.continuity_scores).filter((k) => k !== "overall");
  autoTable(doc, {
    startY: yPos,
    head: [["Metric", ...contTypes.map((t) => t.charAt(0).toUpperCase() + t.slice(1)), "Overall"]],
    body: [
      [
        "Continuity Score (%)",
        ...contTypes.map((t) => `${report.temporal_integrity.continuity_scores[t]}%`),
        `${report.temporal_integrity.continuity_scores.overall}%`,
      ],
    ],
    theme: "striped",
    headStyles: { fillColor: [34, 87, 34], fontSize: 8 },
    styles: { fontSize: 8 },
    columnStyles: { 0: { fontStyle: "bold" } },
  });
  yPos = getLastTableY() + 6;

  // Hourly distribution
  autoTable(doc, {
    startY: yPos,
    head: [["Hour", ...report.temporal_integrity.hourly_distribution.map((h) => String(h.hour).padStart(2, "0"))]],
    body: [["Count", ...report.temporal_integrity.hourly_distribution.map((h) => h.count)]],
    theme: "striped",
    headStyles: { fillColor: [34, 87, 34], fontSize: 7 },
    styles: { fontSize: 7, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: "bold" } },
  });
  yPos = getLastTableY() + 6;

  // Summary metrics
  const burst = report.temporal_integrity.max_hourly_burst;
  autoTable(doc, {
    startY: yPos,
    body: [
      ["Max Records in 1 Hour (Single User)", `${burst.count} records${burst.user_name ? ` by ${burst.user_name}` : ""}`],
      ["Avg. Time Between Entries", `${report.temporal_integrity.avg_inter_record_interval_minutes} minutes`],
    ],
    theme: "plain",
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 80 } },
  });
  yPos = getLastTableY() + 10;

  // ============================================
  // 4. VALUE DISTRIBUTION
  // ============================================
  addSectionTitle("4. Value Distribution Analysis");

  const renderDigitTable = (label: string, digits: AuditReportData["value_distribution"]["terminal_digits"]["milk"]) => {
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text(`${label} — Terminal Digit Distribution (expected: ~10% each)`, 14, yPos);
    yPos += 4;

    autoTable(doc, {
      startY: yPos,
      head: [["", ...digits.map((d) => String(d.digit))]],
      body: [
        ["Count", ...digits.map((d) => d.count ?? 0)],
        ["%", ...digits.map((d) => d.pct != null ? `${d.pct}%` : "0%")],
      ],
      theme: "striped",
      headStyles: { fillColor: [34, 87, 34], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: { 0: { fontStyle: "bold" } },
    });
    yPos = getLastTableY() + 5;
  };

  renderDigitTable("Milk (liters)", report.value_distribution.terminal_digits.milk);
  renderDigitTable("Weight (kg)", report.value_distribution.terminal_digits.weight);
  renderDigitTable("Feed (kg)", report.value_distribution.terminal_digits.feed);

  // Duplicate ratios
  autoTable(doc, {
    startY: yPos,
    head: [["Dataset", "Duplicate Value %"]],
    body: [
      ["Milk Liters", `${report.value_distribution.duplicate_ratios.milk_pct}%`],
      ["Weight (kg)", `${report.value_distribution.duplicate_ratios.weight_pct}%`],
      ["Feed (kg)", `${report.value_distribution.duplicate_ratios.feed_pct}%`],
    ],
    theme: "striped",
    headStyles: { fillColor: [34, 87, 34], fontSize: 8 },
    styles: { fontSize: 8 },
  });
  yPos = getLastTableY() + 6;

  // Per-animal milk yield
  if (report.value_distribution.milk_yield_stats.animals.length > 0) {
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text(
      `Per-Animal Milk Yield (Overall CV: ${report.value_distribution.milk_yield_stats.overall_cv}%)`,
      14, yPos
    );
    yPos += 4;

    autoTable(doc, {
      startY: yPos,
      head: [["Ear Tag", "Name", "Avg Liters", "Std Dev", "CV %", "Records"]],
      body: report.value_distribution.milk_yield_stats.animals.map((a) => [
        a.ear_tag, a.name, a.avg_liters, a.std_dev, `${a.cv}%`, a.record_count,
      ]),
      theme: "striped",
      headStyles: { fillColor: [34, 87, 34], fontSize: 8 },
      styles: { fontSize: 8 },
    });
    yPos = getLastTableY() + 10;
  }

  // ============================================
  // 5. CROSS-DATASET CONSISTENCY
  // ============================================
  addSectionTitle("5. Cross-Dataset Consistency");

  autoTable(doc, {
    startY: yPos,
    body: [
      ["Milk Revenue Linked to Production Records", `${report.cross_dataset_consistency.revenue_linkage_pct}%`],
      ["Expenses with Receipt Attachments", `${report.cross_dataset_consistency.receipt_attachment_pct}%`],
    ],
    theme: "plain",
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 100 } },
  });
  yPos = getLastTableY() + 6;

  if (report.cross_dataset_consistency.feed_milk_trend.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [["Month", "Feed Consumed (kg)", "Milk Produced (liters)"]],
      body: report.cross_dataset_consistency.feed_milk_trend.map((r) => [
        r.month,
        Number(r.total_feed_kg).toLocaleString(),
        Number(r.total_milk_liters).toLocaleString(),
      ]),
      theme: "striped",
      headStyles: { fillColor: [34, 87, 34], fontSize: 8 },
      styles: { fontSize: 8 },
    });
    yPos = getLastTableY() + 10;
  }

  // ============================================
  // 6. USER ATTRIBUTION
  // ============================================
  addSectionTitle("6. User Attribution Summary");

  autoTable(doc, {
    startY: yPos,
    head: [["User", "Role", "Records", "Active Days", "First Entry", "Last Entry", "% of Total"]],
    body: report.user_attribution.map((u) => [
      u.user_name,
      formatRole(u.role),
      u.total_records,
      u.active_days,
      u.first_entry,
      u.last_entry,
      `${u.pct_of_total}%`,
    ]),
    theme: "striped",
    headStyles: { fillColor: [34, 87, 34], fontSize: 8 },
    styles: { fontSize: 8 },
  });

  // ============================================
  // FOOTER — page numbers + disclaimer
  // ============================================
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      "This report presents factual data entry patterns. No assessment or recommendation is implied.",
      pageWidth / 2,
      pageHeight - 12,
      { align: "center" }
    );
    doc.text(
      `Page ${i} of ${pageCount} | Doc Aga Data Integrity Audit`,
      pageWidth / 2,
      pageHeight - 7,
      { align: "center" }
    );
  }

  doc.save(
    `audit-report-${report.farm_summary.farm_name.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd-HHmmss")}.pdf`
  );
}
