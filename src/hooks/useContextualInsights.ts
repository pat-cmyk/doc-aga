import { useMemo } from "react";
import { useFinancialHealth } from "./useFinancialHealth";
import { useRevenueExpenseComparison } from "./useRevenueExpenseComparison";
import { useMilkSpoilageReport } from "./useMilkSpoilageReport";

export interface Insight {
  id: string;
  type: 'success' | 'warning' | 'info' | 'critical';
  title: string;
  description: string;
  priority: number;
}

interface DateRange {
  start: Date;
  end: Date;
}

export function useContextualInsights(farmId: string, dateRange?: DateRange) {
  const { data: healthData, isLoading: healthLoading } = useFinancialHealth(farmId, dateRange);
  const { data: comparisonData, isLoading: comparisonLoading } = useRevenueExpenseComparison(farmId, dateRange);
  const { data: spoilageData, isLoading: spoilageLoading } = useMilkSpoilageReport(farmId, dateRange);

  const insights = useMemo(() => {
    if (!healthData || !comparisonData) return [];

    const allInsights: Insight[] = [];
    const today = new Date();
    const dayOfMonth = today.getDate();

    // Critical: Status is critical
    if (healthData.status === 'critical') {
      allInsights.push({
        id: 'critical_status',
        type: 'critical',
        title: 'Expenses exceeding income significantly',
        description: 'Review your spending and look for ways to reduce costs or increase sales.',
        priority: 100,
      });
    }

    // Warning: Feed costs spike (if feed is in top categories and increased significantly)
    const feedCategory = comparisonData.topExpenseCategories?.find(
      c => c.category.toLowerCase().includes('feed')
    );
    if (feedCategory && feedCategory.percentage > 40) {
      allInsights.push({
        id: 'feed_cost_high',
        type: 'warning',
        title: `Feed costs are ${feedCategory.percentage.toFixed(0)}% of expenses`,
        description: 'Consider bulk buying or checking for alternative suppliers.',
        priority: 80,
      });
    }

    // Warning: Expense increase > 30%
    if (healthData.spentChange > 30) {
      allInsights.push({
        id: 'expense_spike',
        type: 'warning',
        title: `Spending up ${healthData.spentChange.toFixed(0)}% from previous period`,
        description: 'Check which categories increased and if it was planned.',
        priority: 75,
      });
    }

    // Warning: Revenue drop > 20%
    if (healthData.earnedChange < -20) {
      allInsights.push({
        id: 'revenue_drop',
        type: 'warning',
        title: `Income dropped ${Math.abs(healthData.earnedChange).toFixed(0)}%`,
        description: 'Review if sales or milk production decreased.',
        priority: 78,
      });
    }

    // Warning: Late in month but not at breakeven (only for current month view)
    if (!dateRange && dayOfMonth > 20 && healthData.breakevenProgress < 100) {
      allInsights.push({
        id: 'breakeven_behind',
        type: 'warning',
        title: 'Still working toward breakeven',
        description: `You're at ${healthData.breakevenProgress.toFixed(0)}% with ${30 - dayOfMonth} days left.`,
        priority: 70,
      });
    }

    // Success: Excellent status
    if (healthData.status === 'excellent') {
      allInsights.push({
        id: 'excellent_month',
        type: 'success',
        title: 'Excellent period! Profits are strong',
        description: 'Keep up the great work managing your farm finances.',
        priority: 60,
      });
    }

    // Success: Hit breakeven early (only for current month view)
    if (!dateRange && dayOfMonth <= 20 && healthData.breakevenProgress >= 100) {
      allInsights.push({
        id: 'breakeven_early',
        type: 'success',
        title: `Hit breakeven ${20 - dayOfMonth} days early!`,
        description: 'Great job - everything from here is profit.',
        priority: 65,
      });
    }

    // Success: Expenses down significantly
    if (healthData.spentChange < -15) {
      allInsights.push({
        id: 'expense_down',
        type: 'success',
        title: `Spending down ${Math.abs(healthData.spentChange).toFixed(0)}%`,
        description: 'Good cost control this period!',
        priority: 55,
      });
    }

    // Info: Top revenue source dominance
    const topSource = comparisonData.topRevenueSources?.[0];
    if (topSource && topSource.percentage > 50) {
      allInsights.push({
        id: 'top_source_dominant',
        type: 'info',
        title: `${topSource.source} is ${topSource.percentage.toFixed(0)}% of income`,
        description: 'This is your main earner - keep tracking it closely!',
        priority: 40,
      });
    }

    // Info: No revenue recorded yet
    if (comparisonData.revenueThisMonth === 0) {
      allInsights.push({
        id: 'no_revenue',
        type: 'info',
        title: 'No income recorded for this period yet',
        description: 'Add your milk sales and other revenue to track progress.',
        priority: 45,
      });
    }

    // Milk rejection insights
    if (spoilageData && spoilageData.totalLiters > 0) {
      const topReason = spoilageData.reasonBreakdown[0];
      const topReasonLabel = topReason ? topReason.label.split(' / ')[0] : '';

      if (spoilageData.rejectionRate > 5) {
        allInsights.push({
          id: 'milk_rejection_critical',
          type: 'critical',
          title: `${spoilageData.rejectionRate.toFixed(1)}% of milk was rejected`,
          description: `Check herd health${topReasonLabel ? `, especially for ${topReasonLabel}` : ''}. Industry benchmark is below 2%.`,
          priority: 90,
        });
      } else if (spoilageData.rejectionRate > 2) {
        allInsights.push({
          id: 'milk_rejection_warning',
          type: 'warning',
          title: `Milk rejection rate is ${spoilageData.rejectionRate.toFixed(1)}%`,
          description: `Top reason: ${topReasonLabel || 'Unknown'}. Target below 2% for best results.`,
          priority: 72,
        });
      }

      if (spoilageData.previousRejectionRate > 0 && spoilageData.rejectionRate < spoilageData.previousRejectionRate * 0.7) {
        allInsights.push({
          id: 'milk_rejection_improved',
          type: 'success',
          title: `Milk rejection rate improved`,
          description: `Down from ${spoilageData.previousRejectionRate.toFixed(1)}% to ${spoilageData.rejectionRate.toFixed(1)}%. Great progress!`,
          priority: 58,
        });
      }
    }

    // Sort by priority (highest first) and return top 3
    return allInsights
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3);
  }, [healthData, comparisonData, spoilageData, dateRange]);

  return {
    insights,
    isLoading: healthLoading || comparisonLoading || spoilageLoading,
  };
}
