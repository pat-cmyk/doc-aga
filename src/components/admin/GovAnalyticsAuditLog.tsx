import { format } from "date-fns";
import { useGovAnalyticsAuditLog } from "@/hooks/useGovAnalyticsAuditLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Eye, Download, Code } from "lucide-react";

const accessTypeIcons: Record<string, React.ReactNode> = {
  view: <Eye className="h-4 w-4" />,
  export: <Download className="h-4 w-4" />,
  api: <Code className="h-4 w-4" />,
};

const roleColors: Record<string, string> = {
  admin: "bg-destructive text-destructive-foreground",
  government: "bg-primary text-primary-foreground",
  user: "bg-secondary text-secondary-foreground",
};

export function GovAnalyticsAuditLog() {
  const { data: auditLogs, isLoading, error } = useGovAnalyticsAuditLog(50);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Farm Analytics Access Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Farm Analytics Access Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Failed to load audit logs. You may not have permission to view this data.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Farm Analytics Access Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {auditLogs?.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No access logs recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User Role</TableHead>
                <TableHead>Access Type</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Regions</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs?.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-sm">
                    {format(new Date(log.accessed_at), "MMM d, yyyy HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <Badge className={roleColors[log.user_role || "user"] || roleColors.user}>
                      {log.user_role || "user"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {accessTypeIcons[log.access_type] || accessTypeIcons.view}
                      <span className="capitalize">{log.access_type}</span>
                    </div>
                  </TableCell>
                  <TableCell>{log.records_accessed}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {log.regions_accessed.slice(0, 3).map((region) => (
                        <Badge key={region} variant="outline" className="text-xs">
                          {region}
                        </Badge>
                      ))}
                      {log.regions_accessed.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{log.regions_accessed.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {String((log.metadata as Record<string, unknown>)?.source || "—")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
