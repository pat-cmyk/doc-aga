import { ReactNode } from "react";
import { UserEmailDropdown } from "@/components/UserEmailDropdown";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import { PhilippineTimeBanner } from "@/components/ui/PhilippineTimeBanner";
import { DataCategory } from "@/types/government";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Database as DatabaseIcon, Download, FileText, Table, Loader2 } from "lucide-react";

interface GovernmentLayoutProps {
  children: ReactNode;
  dataCategory?: DataCategory;
  onDataCategoryChange?: (value: DataCategory) => void;
  onExportFullReport?: (format: 'csv' | 'pdf') => void;
  isExporting?: boolean;
}

export const GovernmentLayout = ({ children, dataCategory, onDataCategoryChange, onExportFullReport, isExporting }: GovernmentLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card pt-safe">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-4xl">🇵🇭</div>
            <div>
              <h1 className="text-2xl font-bold">Government Dashboard</h1>
              <p className="text-sm text-muted-foreground">Livestock industry insights for policy and program planning</p>
              <PhilippineTimeBanner compact />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onExportFullReport && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" disabled={isExporting}>
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">
                      {isExporting ? "Preparing..." : "Full Report"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onExportFullReport('pdf')} className="gap-2">
                    <FileText className="h-4 w-4" />
                    Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onExportFullReport('csv')} className="gap-2">
                    <Table className="h-4 w-4" />
                    Download CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {dataCategory && onDataCategoryChange && (
              <Select value={dataCategory} onValueChange={(value: DataCategory) => onDataCategoryChange(value)}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <DatabaseIcon className="h-3.5 w-3.5 mr-1.5" />
                  <SelectValue placeholder="Data Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      Live Data
                    </div>
                  </SelectItem>
                  <SelectItem value="demo">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      Demo Data
                    </div>
                  </SelectItem>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-gray-500" />
                      All Data
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
            <NetworkStatusIndicator />
            <UserEmailDropdown />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  );
};
