import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { addToQueue, getAllPending, getPendingCount, clearCompleted } from '../offlineQueue';
import { generateClientId } from '../syncCheckpoint';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
    })),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { transcription: 'test transcription' }, error: null }),
    },
  },
}));

// Mock swBridge to prevent background sync during tests
vi.mock('../swBridge', () => ({
  requestBackgroundSync: vi.fn().mockResolvedValue(true),
}));

describe('Offline Sync Integration', () => {
  beforeEach(async () => {
    await clearCompleted();
  });

  afterEach(async () => {
    await clearCompleted();
  });

  describe('Queue Operations', () => {
    it('should add items to queue with correct structure', async () => {
      const testItem = {
        id: crypto.randomUUID(),
        type: 'animal_form' as const,
        payload: {
          formData: {
            name: 'Test Animal',
            livestock_type: 'cattle',
            farm_id: 'test-farm',
          },
        },
        createdAt: Date.now(),
      };

      await addToQueue(testItem);
      const pending = await getAllPending();

      expect(pending.length).toBeGreaterThanOrEqual(1);
      const addedItem = pending.find(p => p.id === testItem.id);
      expect(addedItem).toBeDefined();
      expect(addedItem?.type).toBe('animal_form');
      expect(addedItem?.status).toBe('pending');
      expect(addedItem?.retries).toBe(0);
    });

    it('should track pending count correctly', async () => {
      const initialCount = await getPendingCount();

      await addToQueue({
        id: crypto.randomUUID(),
        type: 'bulk_milk' as const,
        payload: { milkRecords: [] },
        createdAt: Date.now(),
      });

      expect(await getPendingCount()).toBe(initialCount + 1);

      await addToQueue({
        id: crypto.randomUUID(),
        type: 'bulk_feed' as const,
        payload: { feedRecords: [] },
        createdAt: Date.now(),
      });

      expect(await getPendingCount()).toBe(initialCount + 2);
    });
  });

  describe('Client ID Generation', () => {
    it('should generate unique client IDs', () => {
      const id1 = generateClientId();
      const id2 = generateClientId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^client_\d+_[a-f0-9]+$/);
    });

    it('should include timestamp in client ID', () => {
      const before = Date.now();
      const id = generateClientId();
      const after = Date.now();

      const timestamp = parseInt(id.split('_')[1]);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('Optimistic Updates', () => {
    it('should store optimistic data with pending status', async () => {
      const clientId = generateClientId();
      const itemId = crypto.randomUUID();
      
      await addToQueue({
        id: itemId,
        type: 'animal_form' as const,
        payload: {
          formData: {
            client_generated_id: clientId,
            name: 'Optimistic Animal',
          },
        },
        createdAt: Date.now(),
      });

      const items = await getAllPending();
      const addedItem = items.find(i => i.id === itemId);
      expect(addedItem?.payload.formData.client_generated_id).toBe(clientId);
    });
  });

  describe('Queue Item Types', () => {
    it('should handle voice_activity type', async () => {
      const itemId = crypto.randomUUID();
      
      await addToQueue({
        id: itemId,
        type: 'voice_activity' as const,
        payload: {
          audioBlob: new Blob(['test'], { type: 'audio/webm' }),
          farmId: 'test-farm',
        },
        createdAt: Date.now(),
      });

      const items = await getAllPending();
      const addedItem = items.find(i => i.id === itemId);
      expect(addedItem?.type).toBe('voice_activity');
    });

    it('should handle bulk_milk type', async () => {
      const itemId = crypto.randomUUID();
      
      await addToQueue({
        id: itemId,
        type: 'bulk_milk' as const,
        payload: {
          milkRecords: [
            { animalId: 'a1', animalName: 'Cow1', liters: 5, recordDate: '2024-01-01', session: 'AM' as const },
            { animalId: 'a2', animalName: 'Cow2', liters: 7, recordDate: '2024-01-01', session: 'AM' as const },
          ],
        },
        createdAt: Date.now(),
      });

      const items = await getAllPending();
      const addedItem = items.find(i => i.id === itemId);
      expect(addedItem?.type).toBe('bulk_milk');
      expect(addedItem?.payload.milkRecords).toHaveLength(2);
    });

    it('should handle bulk_feed type', async () => {
      const itemId = crypto.randomUUID();
      
      await addToQueue({
        id: itemId,
        type: 'bulk_feed' as const,
        payload: {
          feedRecords: [{ animalId: 'a1', animalName: 'Cow1', kilograms: 10 }],
          feedType: 'hay',
        },
        createdAt: Date.now(),
      });

      const items = await getAllPending();
      const addedItem = items.find(i => i.id === itemId);
      expect(addedItem?.type).toBe('bulk_feed');
    });

    it('should handle bulk_health type', async () => {
      const itemId = crypto.randomUUID();
      
      await addToQueue({
        id: itemId,
        type: 'bulk_health' as const,
        payload: {
          healthRecords: [{ animalId: 'a1', animalName: 'Cow1' }],
          treatment: 'vaccination',
          diagnosis: 'healthy',
        },
        createdAt: Date.now(),
      });

      const items = await getAllPending();
      const addedItem = items.find(i => i.id === itemId);
      expect(addedItem?.type).toBe('bulk_health');
    });
  });
});
