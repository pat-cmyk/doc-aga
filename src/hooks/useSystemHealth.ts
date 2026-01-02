import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemHealthMetrics {
  users: {
    total: number;
    new_24h: number;
    new_7d: number;
    new_30d: number;
    active_24h: number;
    disabled: number;
  };
  farms: {
    total: number;
    new_7d: number;
    new_30d: number;
  };
  animals: {
    total: number;
    new_7d: number;
    exits_30d: number;
  };
  doc_aga: {
    total_queries: number;
    queries_7d: number;
    queries_24h: number;
  };
  stt: {
    total_requests: number;
    requests_24h: number;
    success_rate: number;
    avg_latency_ms: number;
    failed_24h: number;
  };
  approvals: {
    pending: number;
    approved_7d: number;
    rejected_7d: number;
    auto_approved_7d: number;
  };
  support: {
    open: number;
    in_progress: number;
    urgent: number;
    resolved_7d: number;
  };
  feedback: {
    pending: number;
    acknowledged: number;
    under_review: number;
    total: number;
  };
  sync: {
    total_syncs_24h: number;
    success_rate: number;
    avg_duration_ms: number;
    failed_24h: number;
  };
  activity_trend: Array<{
    date: string;
    logins: number;
  }>;
  last_updated: string;
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ["admin-system-health"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_system_health_metrics");
      if (error) throw error;
      return data as unknown as SystemHealthMetrics;
    },
    refetchInterval: 60000, // Auto-refresh every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });
}

// Helper to calculate health score (0-100)
export function calculateHealthScore(metrics: SystemHealthMetrics | undefined): number {
  if (!metrics) return 0;

  let score = 100;
  const deductions: { reason: string; points: number }[] = [];

  // STT success rate impact
  if (metrics.stt.total_requests > 0) {
    if (metrics.stt.success_rate < 95) {
      const penalty = Math.min(20, (95 - metrics.stt.success_rate) * 2);
      score -= penalty;
      deductions.push({ reason: "STT success rate below 95%", points: penalty });
    }
  }

  // Urgent support tickets
  if (metrics.support.urgent > 0) {
    const penalty = Math.min(15, metrics.support.urgent * 5);
    score -= penalty;
    deductions.push({ reason: `${metrics.support.urgent} urgent tickets`, points: penalty });
  }

  // Open support tickets backlog
  if (metrics.support.open > 5) {
    const penalty = Math.min(10, (metrics.support.open - 5) * 2);
    score -= penalty;
    deductions.push({ reason: "Support ticket backlog", points: penalty });
  }

  // Pending approvals backlog
  if (metrics.approvals.pending > 10) {
    const penalty = Math.min(10, (metrics.approvals.pending - 10));
    score -= penalty;
    deductions.push({ reason: "Approval queue backlog", points: penalty });
  }

  // Pending feedback backlog
  if (metrics.feedback.pending > 20) {
    const penalty = Math.min(15, Math.floor((metrics.feedback.pending - 20) / 5));
    score -= penalty;
    deductions.push({ reason: "Farmer feedback backlog", points: penalty });
  }

  // Failed STT in last 24h
  if (metrics.stt.failed_24h > 0) {
    const penalty = Math.min(10, metrics.stt.failed_24h * 2);
    score -= penalty;
    deductions.push({ reason: "Recent STT failures", points: penalty });
  }

  // Sync health (if available)
  if (metrics.sync) {
    if (metrics.sync.success_rate < 95) {
      const penalty = Math.min(15, (95 - metrics.sync.success_rate) * 1.5);
      score -= penalty;
      deductions.push({ reason: "Sync success rate below 95%", points: penalty });
    }
    if (metrics.sync.failed_24h > 0) {
      const penalty = Math.min(10, metrics.sync.failed_24h * 2);
      score -= penalty;
      deductions.push({ reason: "Recent sync failures", points: penalty });
    }
  }

  return Math.max(0, Math.round(score));
}

// Get health status color
export function getHealthStatus(score: number): {
  color: string;
  label: string;
  bgClass: string;
  textClass: string;
} {
  if (score >= 90) {
    return {
      color: "green",
      label: "Healthy",
      bgClass: "bg-green-500/10",
      textClass: "text-green-600",
    };
  } else if (score >= 70) {
    return {
      color: "yellow",
      label: "Warning",
      bgClass: "bg-yellow-500/10",
      textClass: "text-yellow-600",
    };
  } else {
    return {
      color: "red",
      label: "Critical",
      bgClass: "bg-red-500/10",
      textClass: "text-red-600",
    };
  }
}

// Get trend indicator
export function getTrendIndicator(current: number, previous: number): {
  direction: "up" | "down" | "stable";
  icon: string;
  colorClass: string;
} {
  if (current > previous) {
    return { direction: "up", icon: "↑", colorClass: "text-green-600" };
  } else if (current < previous) {
    return { direction: "down", icon: "↓", colorClass: "text-red-600" };
  }
  return { direction: "stable", icon: "→", colorClass: "text-muted-foreground" };
}
