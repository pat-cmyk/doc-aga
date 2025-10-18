import { describe, it, expect } from 'vitest';
import {
  calculateStockoutDate,
  compareInventoryToForecast,
  calculateInventoryValue,
  getStatusColor,
  type FeedInventoryItem,
} from './feedInventory';
import type { MonthlyFeedForecast } from './feedForecast';

describe('feedInventory', () => {
  describe('calculateStockoutDate', () => {
    it('should calculate days remaining correctly', () => {
      const result = calculateStockoutDate(1000, 10);
      expect(result.daysRemaining).toBe(100);
      expect(result.status).toBe('healthy');
    });

    it('should return warning status for 30-60 days', () => {
      const result = calculateStockoutDate(500, 10);
      expect(result.daysRemaining).toBe(50);
      expect(result.status).toBe('warning');
    });

    it('should return critical status for less than 30 days', () => {
      const result = calculateStockoutDate(200, 10);
      expect(result.daysRemaining).toBe(20);
      expect(result.status).toBe('critical');
    });

    it('should handle zero consumption gracefully', () => {
      const result = calculateStockoutDate(1000, 0);
      expect(result.daysRemaining).toBe(Infinity);
      expect(result.stockoutDate).toBe(null);
      expect(result.status).toBe('healthy');
    });

    it('should handle negative consumption gracefully', () => {
      const result = calculateStockoutDate(1000, -10);
      expect(result.daysRemaining).toBe(Infinity);
      expect(result.status).toBe('healthy');
    });
  });

  describe('compareInventoryToForecast', () => {
    const mockInventory: FeedInventoryItem[] = [
      {
        id: '1',
        farm_id: 'farm1',
        feed_type: 'hay',
        quantity_kg: 5000,
        unit: 'bales',
        last_updated: '2025-01-01',
        created_at: '2025-01-01',
      },
    ];

    const mockForecast: MonthlyFeedForecast[] = [
      {
        month: 'January 2025',
        monthDate: new Date('2025-01-01'),
        totalFeedKgPerDay: 33.33,
        totalFeedKgPerMonth: 1000,
        totalFreshForageKgPerDay: 33.33,
        totalFreshForageKgPerMonth: 1000,
        breakdownByStage: {},
      },
      {
        month: 'February 2025',
        monthDate: new Date('2025-02-01'),
        totalFeedKgPerDay: 33.33,
        totalFeedKgPerMonth: 1000,
        totalFreshForageKgPerDay: 33.33,
        totalFreshForageKgPerMonth: 1000,
        breakdownByStage: {},
      },
    ];

    it('should return empty array for empty forecast', () => {
      const result = compareInventoryToForecast(mockInventory, []);
      expect(result).toEqual([]);
    });

    it('should calculate surplus correctly', () => {
      const result = compareInventoryToForecast(mockInventory, mockForecast);
      expect(result[0].feedType).toBe('hay');
      expect(result[0].currentStock).toBe(5000);
      expect(result[0].status).toBe('surplus');
    });

    it('should calculate deficit correctly', () => {
      const smallInventory: FeedInventoryItem[] = [
        {
          ...mockInventory[0],
          quantity_kg: 500,
        },
      ];
      const result = compareInventoryToForecast(smallInventory, mockForecast);
      expect(result[0].status).toBe('deficit');
    });
  });

  describe('calculateInventoryValue', () => {
    it('should calculate total value correctly', () => {
      const inventory: FeedInventoryItem[] = [
        {
          id: '1',
          farm_id: 'farm1',
          feed_type: 'hay',
          quantity_kg: 100,
          unit: 'bales',
          cost_per_unit: 5,
          last_updated: '2025-01-01',
          created_at: '2025-01-01',
        },
        {
          id: '2',
          farm_id: 'farm1',
          feed_type: 'concentrates',
          quantity_kg: 50,
          unit: 'bags',
          cost_per_unit: 10,
          last_updated: '2025-01-01',
          created_at: '2025-01-01',
        },
      ];

      const total = calculateInventoryValue(inventory);
      expect(total).toBe(1000);
    });

    it('should handle missing cost_per_unit', () => {
      const inventory: FeedInventoryItem[] = [
        {
          id: '1',
          farm_id: 'farm1',
          feed_type: 'hay',
          quantity_kg: 100,
          unit: 'bales',
          last_updated: '2025-01-01',
          created_at: '2025-01-01',
        },
      ];

      const total = calculateInventoryValue(inventory);
      expect(total).toBe(0);
    });
  });

  describe('getStatusColor', () => {
    it('should return correct colors for each status', () => {
      expect(getStatusColor('healthy')).toContain('green');
      expect(getStatusColor('warning')).toContain('yellow');
      expect(getStatusColor('critical')).toContain('red');
      expect(getStatusColor('surplus')).toContain('green');
      expect(getStatusColor('sufficient')).toContain('yellow');
      expect(getStatusColor('deficit')).toContain('red');
    });
  });
});
