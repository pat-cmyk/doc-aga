import { addDays, format } from "date-fns";
import type { MonthlyFeedForecast } from "./feedForecast";

export interface FeedInventoryItem {
  id: string;
  farm_id: string;
  feed_type: string;
  quantity_kg: number;
  unit: string;
  cost_per_unit?: number;
  reorder_threshold?: number;
  supplier?: string;
  notes?: string;
  last_updated: string;
  created_at: string;
  created_by?: string;
}

export interface FeedStockTransaction {
  id: string;
  feed_inventory_id: string;
  transaction_type: 'addition' | 'consumption' | 'adjustment';
  quantity_change_kg: number;
  balance_after: number;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface StockoutCalculation {
  daysRemaining: number;
  stockoutDate: Date | null;
  status: 'healthy' | 'warning' | 'critical';
}

export interface ComparisonResult {
  feedType: string;
  currentStock: number;
  nextMonthRequirement: number;
  sixMonthRequirement: number;
  surplusDeficit: number;
  daysOfCoverage: number;
  status: 'surplus' | 'sufficient' | 'deficit';
}

/**
 * Calculate days until stock-out based on daily consumption
 */
export function calculateStockoutDate(
  currentStock: number,
  dailyConsumption: number
): StockoutCalculation {
  if (dailyConsumption <= 0) {
    return {
      daysRemaining: Infinity,
      stockoutDate: null,
      status: 'healthy'
    };
  }

  const daysRemaining = Math.floor(currentStock / dailyConsumption);
  const stockoutDate = addDays(new Date(), daysRemaining);

  let status: 'healthy' | 'warning' | 'critical';
  if (daysRemaining > 60) {
    status = 'healthy';
  } else if (daysRemaining > 30) {
    status = 'warning';
  } else {
    status = 'critical';
  }

  return {
    daysRemaining,
    stockoutDate,
    status
  };
}

/**
 * Compare inventory vs forecast requirements
 */
export function compareInventoryToForecast(
  inventory: FeedInventoryItem[],
  forecast: MonthlyFeedForecast[]
): ComparisonResult[] {
  if (forecast.length === 0) {
    return [];
  }

  const nextMonthForecast = forecast[0];
  const sixMonthTotal = forecast.reduce((sum, f) => sum + f.totalFeedKgPerMonth, 0);

  return inventory.map(item => {
    const currentStock = item.quantity_kg;
    const nextMonthReq = nextMonthForecast.totalFeedKgPerMonth;
    const sixMonthReq = sixMonthTotal;
    const surplusDeficit = currentStock - sixMonthReq;
    const daysOfCoverage = Math.floor((currentStock / nextMonthReq) * 30);

    let status: 'surplus' | 'sufficient' | 'deficit';
    if (surplusDeficit > nextMonthReq) {
      status = 'surplus';
    } else if (surplusDeficit >= 0) {
      status = 'sufficient';
    } else {
      status = 'deficit';
    }

    return {
      feedType: item.feed_type,
      currentStock,
      nextMonthRequirement: nextMonthReq,
      sixMonthRequirement: sixMonthReq,
      surplusDeficit,
      daysOfCoverage,
      status
    };
  });
}

/**
 * Calculate total inventory value
 */
export function calculateInventoryValue(inventory: FeedInventoryItem[]): number {
  return inventory.reduce((total, item) => {
    const costPerUnit = item.cost_per_unit || 0;
    return total + (item.quantity_kg * costPerUnit);
  }, 0);
}

/**
 * Get status badge color
 */
export function getStatusColor(status: 'healthy' | 'warning' | 'critical' | 'surplus' | 'sufficient' | 'deficit'): string {
  switch (status) {
    case 'healthy':
    case 'surplus':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'warning':
    case 'sufficient':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'critical':
    case 'deficit':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
}
