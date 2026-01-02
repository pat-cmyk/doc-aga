import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock offlineQueue
vi.mock('../offlineQueue', () => ({
  getAll: vi.fn(),
}));

import { getAll } from '../offlineQueue';
import {
  checkStuckItems,
  getStuckItemsCount,
  generateSyncAlerts,
  hasActiveAlerts,
  getAlertSeverityColor,
} from '../syncAlerts';

describe('syncAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkStuckItems', () => {
    it('should return empty array when no items in queue', async () => {
      vi.mocked(getAll).mockResolvedValue([]);
      
      const stuckItems = await checkStuckItems();
      expect(stuckItems).toEqual([]);
    });

    it('should identify items stuck for over an hour', async () => {
      const oneHourAgo = Date.now() - (61 * 60 * 1000); // 61 minutes ago
      
      vi.mocked(getAll).mockResolvedValue([
        {
          id: 'stuck-1',
          type: 'bulk_milk',
          status: 'pending',
          createdAt: oneHourAgo,
          retries: 0,
          payload: { farmId: 'farm-123' },
          optimisticId: 'opt-1',
        },
      ] as any);
      
      const stuckItems = await checkStuckItems();
      expect(stuckItems).toHaveLength(1);
      expect(stuckItems[0].id).toBe('stuck-1');
      expect(stuckItems[0].ageMinutes).toBeGreaterThan(60);
    });

    it('should identify failed items with max retries', async () => {
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      
      vi.mocked(getAll).mockResolvedValue([
        {
          id: 'failed-1',
          type: 'animal_form',
          status: 'failed',
          createdAt: fiveMinutesAgo,
          retries: 3,
          error: 'Network error',
          payload: { farmId: 'farm-456' },
          optimisticId: 'opt-2',
        },
      ] as any);
      
      const stuckItems = await checkStuckItems();
      expect(stuckItems).toHaveLength(1);
      expect(stuckItems[0].error).toBe('Network error');
    });

    it('should filter by farmId when provided', async () => {
      const oneHourAgo = Date.now() - (61 * 60 * 1000);
      
      vi.mocked(getAll).mockResolvedValue([
        {
          id: 'stuck-farm1',
          type: 'bulk_milk',
          status: 'pending',
          createdAt: oneHourAgo,
          retries: 0,
          payload: { farmId: 'farm-123' },
          optimisticId: 'opt-1',
        },
        {
          id: 'stuck-farm2',
          type: 'bulk_feed',
          status: 'pending',
          createdAt: oneHourAgo,
          retries: 0,
          payload: { farmId: 'farm-456' },
          optimisticId: 'opt-2',
        },
      ] as any);
      
      const stuckItems = await checkStuckItems('farm-123');
      expect(stuckItems).toHaveLength(1);
      expect(stuckItems[0].id).toBe('stuck-farm1');
    });

    it('should not flag recent pending items as stuck', async () => {
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      
      vi.mocked(getAll).mockResolvedValue([
        {
          id: 'recent-1',
          type: 'bulk_milk',
          status: 'pending',
          createdAt: fiveMinutesAgo,
          retries: 0,
          payload: { farmId: 'farm-123' },
          optimisticId: 'opt-1',
        },
      ] as any);
      
      const stuckItems = await checkStuckItems();
      expect(stuckItems).toHaveLength(0);
    });
  });

  describe('getStuckItemsCount', () => {
    it('should return count of stuck items', async () => {
      const oneHourAgo = Date.now() - (61 * 60 * 1000);
      
      vi.mocked(getAll).mockResolvedValue([
        { id: '1', type: 'bulk_milk', status: 'pending', createdAt: oneHourAgo, retries: 0, payload: {}, optimisticId: 'o1' },
        { id: '2', type: 'bulk_feed', status: 'pending', createdAt: oneHourAgo, retries: 0, payload: {}, optimisticId: 'o2' },
      ] as any);
      
      const count = await getStuckItemsCount();
      expect(count).toBe(2);
    });
  });

  describe('generateSyncAlerts', () => {
    it('should return empty array when no stuck items', async () => {
      vi.mocked(getAll).mockResolvedValue([]);
      
      const alerts = await generateSyncAlerts();
      expect(alerts).toEqual([]);
    });

    it('should generate warning alert for few stuck items', async () => {
      const oneHourAgo = Date.now() - (61 * 60 * 1000);
      
      vi.mocked(getAll).mockResolvedValue([
        { id: '1', type: 'bulk_milk', status: 'pending', createdAt: oneHourAgo, retries: 0, payload: {}, optimisticId: 'o1' },
        { id: '2', type: 'bulk_feed', status: 'pending', createdAt: oneHourAgo, retries: 0, payload: {}, optimisticId: 'o2' },
      ] as any);
      
      const alerts = await generateSyncAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe('warning');
      expect(alerts[0].type).toBe('stuck_items');
    });

    it('should generate critical alert for many stuck items', async () => {
      const oneHourAgo = Date.now() - (61 * 60 * 1000);
      const items = Array.from({ length: 6 }, (_, i) => ({
        id: `stuck-${i}`,
        type: 'bulk_milk',
        status: 'pending',
        createdAt: oneHourAgo,
        retries: 0,
        payload: {},
        optimisticId: `o${i}`,
      }));
      
      vi.mocked(getAll).mockResolvedValue(items as any);
      
      const alerts = await generateSyncAlerts();
      expect(alerts.some(a => a.severity === 'critical')).toBe(true);
    });
  });

  describe('hasActiveAlerts', () => {
    it('should return false when no alerts', async () => {
      vi.mocked(getAll).mockResolvedValue([]);
      
      const hasAlerts = await hasActiveAlerts();
      expect(hasAlerts).toBe(false);
    });

    it('should return true when there are alerts', async () => {
      const oneHourAgo = Date.now() - (61 * 60 * 1000);
      
      vi.mocked(getAll).mockResolvedValue([
        { id: '1', type: 'bulk_milk', status: 'pending', createdAt: oneHourAgo, retries: 0, payload: {}, optimisticId: 'o1' },
      ] as any);
      
      const hasAlerts = await hasActiveAlerts();
      expect(hasAlerts).toBe(true);
    });
  });

  describe('getAlertSeverityColor', () => {
    it('should return red colors for critical', () => {
      const colors = getAlertSeverityColor('critical');
      expect(colors.text).toContain('destructive');
    });

    it('should return yellow colors for warning', () => {
      const colors = getAlertSeverityColor('warning');
      expect(colors.text).toContain('yellow');
    });
  });
});
