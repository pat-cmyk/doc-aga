import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [{ id: 'test-id' }], error: null }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          gt: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
    }),
  },
}));

// Import after mocking
import {
  startSyncSession,
  completeSyncSession,
  recordSyncError,
  getSyncStats,
  getRecentFailures,
  getActiveSession,
} from '../syncTelemetry';

describe('syncTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startSyncSession', () => {
    it('should return a session ID', async () => {
      const sessionId = await startSyncSession('farm-123', 'manual');
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
    });

    it('should set the active session', async () => {
      await startSyncSession('farm-456', 'background');
      const session = getActiveSession();
      expect(session).toBeDefined();
      expect(session?.farmId).toBe('farm-456');
      expect(session?.syncType).toBe('background');
    });
  });

  describe('completeSyncSession', () => {
    it('should complete without errors', async () => {
      const sessionId = await startSyncSession('farm-789', 'manual');
      
      await expect(completeSyncSession(sessionId, {
        itemsProcessed: 10,
        itemsSucceeded: 9,
        itemsFailed: 1,
        durationMs: 1500,
      })).resolves.not.toThrow();
    });

    it('should clear active session', async () => {
      const sessionId = await startSyncSession('farm-abc', 'periodic');
      expect(getActiveSession()).toBeDefined();
      
      await completeSyncSession(sessionId, {
        itemsProcessed: 5,
        itemsSucceeded: 5,
        itemsFailed: 0,
        durationMs: 500,
      });
      
      expect(getActiveSession()).toBeNull();
    });
  });

  describe('recordSyncError', () => {
    it('should record string errors', async () => {
      const sessionId = await startSyncSession('farm-err', 'manual');
      
      await expect(recordSyncError(sessionId, 'Network timeout')).resolves.not.toThrow();
    });

    it('should record Error objects', async () => {
      const sessionId = await startSyncSession('farm-err2', 'background');
      
      await expect(recordSyncError(sessionId, new Error('Connection refused'))).resolves.not.toThrow();
    });
  });

  describe('getSyncStats', () => {
    it('should return default stats when no data', async () => {
      const stats = await getSyncStats('farm-empty');
      
      expect(stats).toEqual({
        totalSyncs: 0,
        successRate: 100,
        avgDurationMs: 0,
        failedSyncs: 0,
        lastSync: null,
      });
    });
  });

  describe('getRecentFailures', () => {
    it('should return empty array when no failures', async () => {
      const failures = await getRecentFailures('farm-success');
      expect(failures).toEqual([]);
    });
  });
});
