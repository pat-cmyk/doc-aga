import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateClientId } from '../syncCheckpoint';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          table_name: 'animals',
          last_sync_at: '2024-01-01T00:00:00Z',
          last_record_timestamp: '2024-01-01T00:00:00Z',
          records_synced: 100,
        },
        error: null,
      }),
    })),
    rpc: vi.fn().mockResolvedValue({ error: null }),
  },
}));

describe('Sync Checkpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateClientId', () => {
    it('should generate a valid client ID format', () => {
      const id = generateClientId();
      
      expect(id).toMatch(/^client_\d+_[a-f0-9]{8}$/);
    });

    it('should generate unique IDs on each call', () => {
      const ids = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        ids.add(generateClientId());
      }
      
      // All 100 IDs should be unique
      expect(ids.size).toBe(100);
    });

    it('should include current timestamp', () => {
      const before = Date.now();
      const id = generateClientId();
      const after = Date.now();

      const parts = id.split('_');
      const timestamp = parseInt(parts[1], 10);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should have 8-character hex suffix', () => {
      const id = generateClientId();
      const suffix = id.split('_')[2];

      expect(suffix).toHaveLength(8);
      expect(suffix).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('getSyncCheckpoint', () => {
    it('should return checkpoint data when exists', async () => {
      const { getSyncCheckpoint } = await import('../syncCheckpoint');
      
      const checkpoint = await getSyncCheckpoint('farm-123', 'animals');

      expect(checkpoint).toEqual({
        tableName: 'animals',
        lastSyncAt: '2024-01-01T00:00:00Z',
        lastRecordTimestamp: '2024-01-01T00:00:00Z',
        recordsSynced: 100,
      });
    });
  });

  describe('needsFullSync', () => {
    it('should return true when no checkpoint exists', async () => {
      vi.doMock('@/integrations/supabase/client', () => ({
        supabase: {
          from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        },
      }));

      const { needsFullSync } = await import('../syncCheckpoint');
      
      // This will use the mocked version that returns null
      const needs = await needsFullSync('farm-123', 'animals');

      expect(needs).toBe(true);
    });
  });

  describe('getAllSyncCheckpoints', () => {
    it('should return array of checkpoints', async () => {
      vi.doMock('@/integrations/supabase/client', () => ({
        supabase: {
          from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [
                { table_name: 'animals', last_sync_at: '2024-01-01T00:00:00Z', last_record_timestamp: null, records_synced: 50 },
                { table_name: 'milking_records', last_sync_at: '2024-01-01T00:00:00Z', last_record_timestamp: null, records_synced: 100 },
              ],
              error: null,
            }),
          })),
        },
      }));

      const { getAllSyncCheckpoints } = await import('../syncCheckpoint');
      
      const checkpoints = await getAllSyncCheckpoints('farm-123');

      expect(Array.isArray(checkpoints)).toBe(true);
    });
  });
});
