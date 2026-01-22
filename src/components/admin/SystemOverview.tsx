import { useSystemHealth, calculateHealthScore, getHealthStatus, getTrendIndicator } from "@/hooks/useSystemHealth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, Building2, Beef, MessageSquare, AlertTriangle, 
  CheckCircle2, Clock, TrendingUp, Activity, Mic, 
  RefreshCw, ExternalLink, HeartPulse, Inbox, ShieldAlert
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { format, parseISO } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useResponsiveChart } from "@/hooks/useResponsiveChart";

export const SystemOverview = () => {
  const { data: metrics, isLoading, error, refetch, dataUpdatedAt } = useSystemHealth();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { fontSize } = useResponsiveChart({ size: 'small' });

  const healthScore = calculateHealthScore(metrics);
  const healthStatus = getHealthStatus(healthScore);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold">Failed to load system metrics</h3>
        <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
        <Button onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const navigateToTab = (tab: string, subtab?: string) => {
    const params: Record<string, string> = { tab };
    if (subtab) params.subtab = subtab;
    setSearchParams(params);
  };

  return (
    <div className="space-y-6">
      {/* System Health Score Banner */}
      <Card className={`border-2 ${healthStatus.bgClass}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`h-16 w-16 rounded-full ${healthStatus.bgClass} flex items-center justify-center`}>
                <HeartPulse className={`h-8 w-8 ${healthStatus.textClass}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-3xl font-bold">{isLoading ? "--" : healthScore}</h2>
                  <span className="text-lg text-muted-foreground">/ 100</span>
                  <Badge variant="outline" className={healthStatus.textClass}>
                    {healthStatus.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">System Health Score</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {dataUpdatedAt ? `Updated ${format(new Date(dataUpdatedAt), "HH:mm:ss")}` : "Loading..."}
              <Button variant="ghost" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Alerts Panel */}
      {metrics && (metrics.support.urgent > 0 || metrics.feedback.pending > 20 || metrics.approvals.pending > 10 || metrics.stt.failed_24h > 0) && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Requires Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {metrics.support.urgent > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-destructive/50 text-destructive hover:bg-destructive/10"
                  onClick={() => navigateToTab("operations", "tickets")}
                >
                  <ShieldAlert className="h-4 w-4 mr-2" />
                  {metrics.support.urgent} Urgent Ticket{metrics.support.urgent > 1 ? "s" : ""}
                </Button>
              )}
              {metrics.feedback.pending > 20 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10"
                  onClick={() => navigate("/government?tab=farmer-voice")}
                >
                  <Inbox className="h-4 w-4 mr-2" />
                  {metrics.feedback.pending} Pending Feedback
                </Button>
              )}
              {metrics.approvals.pending > 10 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10"
                  onClick={() => navigateToTab("operations", "farms")}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {metrics.approvals.pending} Pending Approvals
                </Button>
              )}
              {metrics.stt.failed_24h > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-destructive/50 text-destructive hover:bg-destructive/10"
                  onClick={() => navigateToTab("ai-voice")}
                >
                  <Mic className="h-4 w-4 mr-2" />
                  {metrics.stt.failed_24h} STT Failure{metrics.stt.failed_24h > 1 ? "s" : ""} (24h)
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Growth Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Users"
          value={metrics?.users.total}
          trend={metrics ? { current: metrics.users.new_7d, label: "this week" } : undefined}
          icon={Users}
          isLoading={isLoading}
          subtitle="Registered accounts"
        />
        <MetricCard
          title="Total Farms"
          value={metrics?.farms.total}
          trend={metrics ? { current: metrics.farms.new_7d, label: "this week" } : undefined}
          icon={Building2}
          isLoading={isLoading}
          subtitle="Active farms"
        />
        <MetricCard
          title="Total Animals"
          value={metrics?.animals.total}
          trend={metrics ? { current: metrics.animals.new_7d, label: "this week" } : undefined}
          icon={Beef}
          isLoading={isLoading}
          subtitle="Animals registered"
        />
        <MetricCard
          title="Doc Aga Queries"
          value={metrics?.doc_aga.total_queries}
          trend={metrics ? { current: metrics.doc_aga.queries_7d, label: "this week" } : undefined}
          icon={MessageSquare}
          isLoading={isLoading}
          subtitle="AI consultations"
        />
      </div>

      {/* Service Status & Activity Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Service Status Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Service Status</CardTitle>
            <CardDescription>Real-time health of core services</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ServiceStatusRow
              name="Database"
              status="operational"
              detail="Connected"
              isLoading={isLoading}
            />
            <ServiceStatusRow
              name="Authentication"
              status={metrics && metrics.users.active_24h > 0 ? "operational" : "warning"}
              detail={metrics ? `${metrics.users.active_24h} active users (24h)` : "Loading..."}
              isLoading={isLoading}
            />
            <ServiceStatusRow
              name="Doc Aga AI"
              status={metrics && metrics.doc_aga.queries_24h > 0 ? "operational" : (metrics?.doc_aga.queries_7d === 0 ? "warning" : "operational")}
              detail={metrics ? `${metrics.doc_aga.queries_24h} queries (24h)` : "Loading..."}
              isLoading={isLoading}
            />
            <ServiceStatusRow
              name="Voice STT"
              status={
                !metrics || metrics.stt.total_requests === 0 
                  ? "unknown" 
                  : metrics.stt.success_rate >= 95 
                    ? "operational" 
                    : metrics.stt.success_rate >= 80 
                      ? "warning" 
                      : "critical"
              }
              detail={
                metrics 
                  ? metrics.stt.total_requests > 0 
                    ? `${metrics.stt.success_rate}% success, ${metrics.stt.avg_latency_ms}ms avg` 
                    : "No data yet"
                  : "Loading..."
              }
              isLoading={isLoading}
            />
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Login Activity (7 Days)</CardTitle>
            <CardDescription>User engagement trends</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[180px] w-full" />
            ) : metrics?.activity_trend && metrics.activity_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={metrics.activity_trend}>
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => format(parseISO(value), "MMM d")}
                    tick={{ fontSize }}
                  />
                  <YAxis tick={{ fontSize }} />
                  <Tooltip 
                    labelFormatter={(value) => format(parseISO(value as string), "MMM d, yyyy")}
                    formatter={(value) => [value, "Logins"]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="logins" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground">
                <Activity className="h-8 w-8 mr-2 opacity-50" />
                No login activity data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Support Tickets Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              Support Tickets
              <Button variant="ghost" size="sm" onClick={() => navigateToTab("operations", "tickets")}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-yellow-500" />
                  <span className="text-muted-foreground">Open:</span>
                  <span className="font-medium">{metrics?.support.open || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">In Progress:</span>
                  <span className="font-medium">{metrics?.support.in_progress || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-muted-foreground">Urgent:</span>
                  <span className="font-medium">{metrics?.support.urgent || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">Resolved (7d):</span>
                  <span className="font-medium">{metrics?.support.resolved_7d || 0}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approval Queue Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              Approval Queue
              <Button variant="ghost" size="sm" onClick={() => navigateToTab("operations", "farms")}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-yellow-500" />
                  <span className="text-muted-foreground">Pending:</span>
                  <span className="font-medium">{metrics?.approvals.pending || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span className="text-muted-foreground">Approved:</span>
                  <span className="font-medium">{metrics?.approvals.approved_7d || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className="h-3 w-3 text-blue-500" />
                  <span className="text-muted-foreground">Auto-approved:</span>
                  <span className="font-medium">{metrics?.approvals.auto_approved_7d || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                  <span className="text-muted-foreground">Rejected:</span>
                  <span className="font-medium">{metrics?.approvals.rejected_7d || 0}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Farmer Feedback Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              Farmer Feedback
              <Button variant="ghost" size="sm" onClick={() => navigate("/government?tab=farmer-voice")}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Inbox className="h-3 w-3 text-yellow-500" />
                  <span className="text-muted-foreground">Pending:</span>
                  <span className="font-medium">{metrics?.feedback.pending || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-blue-500" />
                  <span className="text-muted-foreground">Acknowledged:</span>
                  <span className="font-medium">{metrics?.feedback.acknowledged || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className="h-3 w-3 text-purple-500" />
                  <span className="text-muted-foreground">Under Review:</span>
                  <span className="font-medium">{metrics?.feedback.under_review || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-medium">{metrics?.feedback.total || 0}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Helper Components
interface MetricCardProps {
  title: string;
  value: number | undefined;
  trend?: { current: number; label: string };
  icon: React.ComponentType<{ className?: string }>;
  isLoading: boolean;
  subtitle: string;
}

function MetricCard({ title, value, trend, icon: Icon, isLoading, subtitle }: MetricCardProps) {
  const trendIndicator = trend && trend.current > 0 
    ? { icon: "↑", colorClass: "text-green-600", value: `+${trend.current}` }
    : trend && trend.current === 0
      ? { icon: "→", colorClass: "text-muted-foreground", value: "0" }
      : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value?.toLocaleString() || 0}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{subtitle}</span>
              {trendIndicator && (
                <span className={`ml-2 ${trendIndicator.colorClass} font-medium`}>
                  {trendIndicator.icon} {trendIndicator.value} {trend?.label}
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface ServiceStatusRowProps {
  name: string;
  status: "operational" | "warning" | "critical" | "unknown";
  detail: string;
  isLoading: boolean;
}

function ServiceStatusRow({ name, status, detail, isLoading }: ServiceStatusRowProps) {
  const statusConfig = {
    operational: { color: "bg-green-500", label: "Operational" },
    warning: { color: "bg-yellow-500", label: "Warning" },
    critical: { color: "bg-red-500", label: "Critical" },
    unknown: { color: "bg-gray-400", label: "Unknown" },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {isLoading ? (
          <Skeleton className="h-3 w-3 rounded-full" />
        ) : (
          <div className={`h-3 w-3 rounded-full ${config.color}`} />
        )}
        <span className="text-sm font-medium">{name}</span>
      </div>
      <div className="text-right">
        {isLoading ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <span className="text-sm text-muted-foreground">{detail}</span>
        )}
      </div>
    </div>
  );
}
