import { Card } from "@/components/ui/card";
import { useGovernmentFeedback } from "@/hooks/useGovernmentFeedback";
import { MessageSquare, AlertTriangle, Clock, TrendingUp } from "lucide-react";

export const FarmerVoiceDashboard = () => {
  const { stats, isLoading } = useGovernmentFeedback();

  if (isLoading || !stats) {
    return <div className="text-center py-8">Loading farmer feedback statistics...</div>;
  }

  const topCategories = Object.entries(stats.categoryCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const categoryLabels: Record<string, string> = {
    policy_concern: "Policy Concerns",
    market_access: "Market Access",
    veterinary_support: "Veterinary Support",
    training_request: "Training Requests",
    infrastructure: "Infrastructure",
    financial_assistance: "Financial Assistance",
    emergency_support: "Emergency Support",
    disease_outbreak: "Disease Outbreaks",
    feed_shortage: "Feed Shortage",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Boses ng Magsasaka Dashboard</h2>
        <p className="text-muted-foreground">
          Real-time insights from farmer feedback across the Philippines
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Submissions</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-500/10">
              <Clock className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Review</p>
              <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-red-500/10">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Critical Cases</p>
              <p className="text-2xl font-bold">{stats.critical}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-emerald-500/10">
              <TrendingUp className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last 7 Days</p>
              <p className="text-2xl font-bold">{stats.recent}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Top Concerns</h3>
        <div className="space-y-3">
          {topCategories.map(([category, count]) => {
            const percentage = Math.round((count / stats.total) * 100);
            return (
              <div key={category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">
                    {categoryLabels[category] || category}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {count} ({percentage}%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
