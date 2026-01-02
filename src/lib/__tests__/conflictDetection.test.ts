import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({
      data: {
        has_conflict: false,
        server_version: null,
        server_timestamp: null,
      },
      error: null,
    }),
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'conflict-123' }, error: null }),
      order: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
    },
  },
}));

describe('Conflict Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectConflict', () => {
    it('should return no conflict when versions match', async () => {
      const { detectConflict } = await import('../conflictDetection');

      const result = await detectConflict(
        'animals',
        'record-123',
        '2024-01-01T00:00:00Z',
        { name: 'Test Animal' }
      );

      expect(result.hasConflict).toBe(false);
    });
  });

  describe('mergeRecords', () => {
    it('should prefer newer client changes', async () => {
      const { mergeRecords } = await import('../conflictDetection');

      const clientData = { name: 'Updated Name', weight: 500 };
      const serverData = { name: 'Old Name', weight: 450, breed: 'Holstein' };
      const clientTimestamp = '2024-01-02T00:00:00Z';
      const serverTimestamp = '2024-01-01T00:00:00Z';

      const merged = mergeRecords(clientData, serverData, clientTimestamp, serverTimestamp);

      // Client is newer, so client values win for conflicting fields
      expect(merged.name).toBe('Updated Name');
      expect(merged.weight).toBe(500);
      // Server-only fields are preserved
      expect(merged.breed).toBe('Holstein');
    });

    it('should prefer newer server changes', async () => {
      const { mergeRecords } = await import('../conflictDetection');

      const clientData = { name: 'Client Name', weight: 500 };
      const serverData = { name: 'Server Name', weight: 550, breed: 'Angus' };
      const clientTimestamp = '2024-01-01T00:00:00Z';
      const serverTimestamp = '2024-01-02T00:00:00Z';

      const merged = mergeRecords(clientData, serverData, clientTimestamp, serverTimestamp);

      // Server is newer, so server values win for conflicting fields
      expect(merged.name).toBe('Server Name');
      expect(merged.weight).toBe(550);
      expect(merged.breed).toBe('Angus');
    });

    it('should combine fields from both when neither conflicts', async () => {
      const { mergeRecords } = await import('../conflictDetection');

      const clientData = { notes: 'Client notes' };
      const serverData = { breed: 'Holstein' };
      const clientTimestamp = '2024-01-01T00:00:00Z';
      const serverTimestamp = '2024-01-01T00:00:00Z';

      const merged = mergeRecords(clientData, serverData, clientTimestamp, serverTimestamp);

      expect(merged.notes).toBe('Client notes');
      expect(merged.breed).toBe('Holstein');
    });
  });

  describe('recordConflict', () => {
    it('should create conflict record in database', async () => {
      const { recordConflict } = await import('../conflictDetection');

      const conflictId = await recordConflict(
        'farm-123',
        'animals',
        'record-123',
        { name: 'Client Version' },
        { name: 'Server Version' }
      );

      expect(conflictId).toBe('conflict-123');
    });
  });

  describe('resolveConflict', () => {
    it('should update conflict with client_wins resolution strategy', async () => {
      const { resolveConflict } = await import('../conflictDetection');

      const result = await resolveConflict(
        'conflict-123',
        'client_wins'
      );

      expect(result).toBe(true);
    });

    it('should include resolved data for merge strategy', async () => {
      const { resolveConflict } = await import('../conflictDetection');

      const mergedData = { name: 'Merged Name', weight: 500 };
      const result = await resolveConflict(
        'conflict-123',
        'merged',
        mergedData
      );

      expect(result).toBe(true);
    });
  });

  describe('getUnresolvedConflicts', () => {
    it('should return empty array when no conflicts', async () => {
      const { getUnresolvedConflicts } = await import('../conflictDetection');

      const conflicts = await getUnresolvedConflicts('farm-123');

      expect(conflicts).toEqual([]);
    });
  });

  describe('getConflictCount', () => {
    it('should return zero when no conflicts', async () => {
      vi.doMock('@/integrations/supabase/client', () => ({
        supabase: {
          from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [],
              count: 0,
              error: null,
            }),
          })),
        },
      }));

      const { getConflictCount } = await import('../conflictDetection');

      const count = await getConflictCount('farm-123');

      expect(count).toBe(0);
    });
  });
});
