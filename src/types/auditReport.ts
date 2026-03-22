export interface AuditFarmSummary {
  farm_name: string;
  owner_name: string;
  region: string | null;
  period_start: string;
  period_end: string;
  total_active_animals: number;
  total_users: number;
  generated_at: string;
}

export interface AuditDailyEntry {
  entry_date: string;
  user_name: string;
  role: string;
  milking_count: number;
  feeding_count: number;
  health_count: number;
  weight_count: number;
  injection_count: number;
  expense_count: number;
  revenue_count: number;
  total: number;
}

export interface AuditHourlyBucket {
  hour: number;
  count: number;
}

export interface AuditMaxBurst {
  count: number;
  user_name: string | null;
  timestamp: string | null;
}

export interface AuditTemporalIntegrity {
  backdating_ratio: Record<string, number>;
  hourly_distribution: AuditHourlyBucket[];
  continuity_scores: Record<string, number>;
  max_hourly_burst: AuditMaxBurst;
  avg_inter_record_interval_minutes: number;
}

export interface AuditTerminalDigit {
  digit: number;
  count: number | null;
  pct: number | null;
}

export interface AuditAnimalMilkStats {
  ear_tag: string;
  name: string;
  avg_liters: number;
  std_dev: number;
  cv: number;
  record_count: number;
}

export interface AuditValueDistribution {
  terminal_digits: {
    milk: AuditTerminalDigit[];
    weight: AuditTerminalDigit[];
    feed: AuditTerminalDigit[];
  };
  milk_yield_stats: {
    overall_cv: number;
    animals: AuditAnimalMilkStats[];
  };
  duplicate_ratios: {
    milk_pct: number;
    weight_pct: number;
    feed_pct: number;
  };
}

export interface AuditFeedMilkTrend {
  month: string;
  total_feed_kg: number;
  total_milk_liters: number;
}

export interface AuditCrossConsistency {
  revenue_linkage_pct: number;
  receipt_attachment_pct: number;
  feed_milk_trend: AuditFeedMilkTrend[];
}

export interface AuditUserAttribution {
  user_name: string;
  role: string;
  total_records: number;
  active_days: number;
  first_entry: string;
  last_entry: string;
  pct_of_total: number;
}

export interface AuditReportData {
  farm_summary: AuditFarmSummary;
  daily_entry_log: AuditDailyEntry[];
  temporal_integrity: AuditTemporalIntegrity;
  value_distribution: AuditValueDistribution;
  cross_dataset_consistency: AuditCrossConsistency;
  user_attribution: AuditUserAttribution[];
}
