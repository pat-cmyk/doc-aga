import { useState } from "react";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Download, Search, Shield, Key, UserCheck, Activity, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const UserActivityLogs = () => {
  const [searchEmail, setSearchEmail] = useState("");
  const [activityType, setActivityType] = useState<string | undefined>();
  const [activityCategory, setActivityCategory] = useState<string | undefined>();
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [dateFromPopoverOpen, setDateFromPopoverOpen] = useState(false);
  const [dateToPopoverOpen, setDateToPopoverOpen] = useState(false);

  const { data: logs, isLoading } = useActivityLogs({
    activityType,
    activityCategory,
    dateFrom,
    dateTo,
    limit: 100,
  });

  const filteredLogs = logs?.filter((log) => {
    if (searchEmail && !log.user_email?.toLowerCase().includes(searchEmail.toLowerCase()) && 
        !log.user_name?.toLowerCase().includes(searchEmail.toLowerCase())) {
      return false;
    }
    return true;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "security":
        return <Shield className="h-4 w-4" />;
      case "access_control":
        return <Key className="h-4 w-4" />;
      case "authentication":
        return <UserCheck className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getCategoryVariant = (category: string) => {
    switch (category) {
      case "security":
        return "destructive";
      case "access_control":
        return "default";
      case "authentication":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getActivityTypeLabel = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const exportToCSV = () => {
    if (!filteredLogs) return;

    const headers = ["Timestamp", "User", "Email", "Activity Type", "Category", "Description"];
    const rows = filteredLogs.map((log) => [
      format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
      log.user_name || "N/A",
      log.user_email || "N/A",
      getActivityTypeLabel(log.activity_type),
      log.activity_category,
      log.description,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          User Activity Logs
        </CardTitle>
        <CardDescription>Audit trail of user actions, role changes, and authentication events</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user name or email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <Select value={activityType || "all"} onValueChange={(v) => setActivityType(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Activity Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="logout">Logout</SelectItem>
              <SelectItem value="role_change">Role Change</SelectItem>
              <SelectItem value="farm_access">Farm Access</SelectItem>
              <SelectItem value="user_created">User Created</SelectItem>
            </SelectContent>
          </Select>

          <Select value={activityCategory || "all"} onValueChange={(v) => setActivityCategory(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="authentication">Authentication</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="access_control">Access Control</SelectItem>
            </SelectContent>
          </Select>

          <Popover open={dateFromPopoverOpen} onOpenChange={setDateFromPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "PP") : "From date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={(d) => {
                  setDateFrom(d);
                  setDateFromPopoverOpen(false);
                }}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <Popover open={dateToPopoverOpen} onOpenChange={setDateToPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "PP") : "To date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={(d) => {
                  setDateTo(d);
                  setDateToPopoverOpen(false);
                }}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <Button onClick={exportToCSV} variant="outline" disabled={!filteredLogs || filteredLogs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Results count */}
        {filteredLogs && (
          <div className="text-sm text-muted-foreground">
            Showing {filteredLogs.length} {filteredLogs.length === 1 ? "activity" : "activities"}
          </div>
        )}

        {/* Activity logs table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading activity logs...
                  </TableCell>
                </TableRow>
              ) : filteredLogs && filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {format(new Date(log.created_at), "MMM dd, yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{log.user_name || "Unknown"}</span>
                        <span className="text-xs text-muted-foreground">{log.user_email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getActivityTypeLabel(log.activity_type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getCategoryVariant(log.activity_category)} className="flex items-center gap-1 w-fit">
                        {getCategoryIcon(log.activity_category)}
                        {log.activity_category}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <span className="text-sm">{log.description}</span>
                    </TableCell>
                    <TableCell>
                      {Object.keys(log.metadata).length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <AlertCircle className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80">
                            <div className="space-y-2">
                              <h4 className="font-medium">Additional Details</h4>
                              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-60">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No activity logs found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
