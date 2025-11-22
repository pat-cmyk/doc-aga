import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGovernmentFeedback } from "@/hooks/useGovernmentFeedback";
import { Download, FileDown, FileText } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const FeedbackExport = () => {
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");
  const [exportFilter, setExportFilter] = useState<"all" | "critical" | "pending">("all");
  const { feedbackList, isLoading } = useGovernmentFeedback({});

  const getFilteredData = () => {
    let filtered = feedbackList || [];
    
    if (exportFilter === "critical") {
      filtered = filtered.filter((f: any) => f.auto_priority === "critical");
    } else if (exportFilter === "pending") {
      filtered = filtered.filter((f: any) => f.status === "submitted");
    }

    return filtered;
  };

  const exportToCSV = () => {
    const data = getFilteredData();
    
    if (data.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "Date",
      "Location",
      "Category",
      "Priority",
      "Sentiment",
      "Status",
      "Summary",
      "Department",
    ];

    const rows = data.map((f: any) => [
      format(new Date(f.created_at), "yyyy-MM-dd"),
      `${f.farms?.municipality}, ${f.farms?.province}`,
      f.primary_category,
      f.auto_priority,
      f.sentiment,
      f.status,
      f.ai_summary || "",
      f.assigned_department || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `farmer-feedback-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();

    toast.success("CSV exported successfully");
  };

  const exportToPDF = () => {
    const data = getFilteredData();
    
    if (data.length === 0) {
      toast.error("No data to export");
      return;
    }

    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text("Boses ng Magsasaka - Farmer Feedback Report", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), "MMMM dd, yyyy")}`, 14, 28);
    doc.text(`Filter: ${exportFilter.toUpperCase()}`, 14, 34);
    doc.text(`Total Records: ${data.length}`, 14, 40);

    // Summary statistics
    const critical = data.filter((f: any) => f.auto_priority === "critical").length;
    const pending = data.filter((f: any) => f.status === "submitted").length;
    
    doc.setFontSize(12);
    doc.text("Summary:", 14, 50);
    doc.setFontSize(10);
    doc.text(`Critical Cases: ${critical}`, 20, 56);
    doc.text(`Pending Review: ${pending}`, 20, 62);

    // Table
    const tableData = data.map((f: any) => [
      format(new Date(f.created_at), "MM/dd/yy"),
      `${f.farms?.municipality}, ${f.farms?.province}`,
      f.primary_category.replace("_", " "),
      f.auto_priority,
      f.sentiment,
      f.status,
      (f.ai_summary || f.transcription).slice(0, 60) + "...",
    ]);

    autoTable(doc, {
      startY: 70,
      head: [["Date", "Location", "Category", "Priority", "Sentiment", "Status", "Summary"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { cellWidth: 20 },
        4: { cellWidth: 20 },
        5: { cellWidth: 20 },
        6: { cellWidth: 'auto' },
      },
    });

    doc.save(`farmer-feedback-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("PDF exported successfully");
  };

  const handleExport = () => {
    if (exportFormat === "csv") {
      exportToCSV();
    } else {
      exportToPDF();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileDown className="h-5 w-5" />
          Export Feedback Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Export Format</label>
            <Select value={exportFormat} onValueChange={(v: any) => setExportFormat(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    CSV (Excel Compatible)
                  </div>
                </SelectItem>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    <FileDown className="h-4 w-4" />
                    PDF Report
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Data Filter</label>
            <Select value={exportFilter} onValueChange={(v: any) => setExportFilter(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Feedback</SelectItem>
                <SelectItem value="critical">Critical Only</SelectItem>
                <SelectItem value="pending">Pending Review Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="pt-2">
          <p className="text-sm text-muted-foreground mb-3">
            Export includes: date, location, category, priority, sentiment, status, summary, and assigned department
          </p>
          <Button onClick={handleExport} disabled={isLoading} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Export {getFilteredData().length} Record(s)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
