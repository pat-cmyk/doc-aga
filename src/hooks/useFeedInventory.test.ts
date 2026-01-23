import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeFeedSummary,
  calculateTotalDailyConsumption,
} from "@/hooks/useFeedInventory";
import type { FeedInventoryItem } from "@/lib/feedInventory";
import type { AnimalForConsumption } from "@/lib/feedConsumption";

// Mock dependencies
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn(),
      })),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
}));

vi.mock("@/lib/dataCache", () => ({
  getCachedFeedInventory: vi.fn(() => Promise.resolve(null)),
  updateFeedInventoryCache: vi.fn(() => Promise.resolve([])),
}));

describe("useFeedInventory Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("computeFeedSummary", () => {
    it("should categorize items by explicit category field", () => {
      const items: FeedInventoryItem[] = [
        {
          id: "1",
          farm_id: "farm1",
          feed_type: "Hay",
          category: "roughage",
          quantity_kg: 1000,
          unit: "kg",
          last_updated: "2026-01-01",
          created_at: "2026-01-01",
        },
        {
          id: "2",
          farm_id: "farm1",
          feed_type: "Corn",
          category: "concentrates",
          quantity_kg: 500,
          unit: "kg",
          last_updated: "2026-01-01",
          created_at: "2026-01-01",
        },
      ];

      const summary = computeFeedSummary(items, 100);

      expect(summary.roughageKg).toBe(1000);
      expect(summary.concentrateKg).toBe(500);
    });

    it("should calculate roughage days correctly", () => {
      const items: FeedInventoryItem[] = [
        {
          id: "1",
          farm_id: "farm1",
          feed_type: "Hay",
          category: "roughage",
          quantity_kg: 700,
          unit: "kg",
          last_updated: "2026-01-01",
          created_at: "2026-01-01",
        },
      ];

      const summary = computeFeedSummary(items, 100); // 100 * 0.7 = 70 kg/day roughage

      expect(summary.roughageDays).toBe(10); // 700 / 70 = 10
    });

    it("should calculate concentrate days correctly", () => {
      const items: FeedInventoryItem[] = [
        {
          id: "1",
          farm_id: "farm1",
          feed_type: "Corn",
          category: "concentrates",
          quantity_kg: 300,
          unit: "kg",
          last_updated: "2026-01-01",
          created_at: "2026-01-01",
        },
      ];

      const summary = computeFeedSummary(items, 100); // 100 * 0.3 = 30 kg/day concentrate

      expect(summary.concentrateDays).toBe(10); // 300 / 30 = 10
    });

    it("should use roughage for feedStockDays", () => {
      const items: FeedInventoryItem[] = [
        {
          id: "1",
          farm_id: "farm1",
          feed_type: "Hay",
          category: "roughage",
          quantity_kg: 1400,
          unit: "kg",
          last_updated: "2026-01-01",
          created_at: "2026-01-01",
        },
        {
          id: "2",
          farm_id: "farm1",
          feed_type: "Corn",
          category: "concentrates",
          quantity_kg: 300,
          unit: "kg",
          last_updated: "2026-01-01",
          created_at: "2026-01-01",
        },
      ];

      const summary = computeFeedSummary(items, 100);

      // feedStockDays should equal roughageDays (survival buffer concept)
      expect(summary.feedStockDays).toBe(summary.roughageDays);
      expect(summary.feedStockDays).toBe(20); // 1400 / 70 = 20
    });

    it("should count expiring items within 30 days", () => {
      const now = new Date();
      const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
      const in45Days = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

      const items: FeedInventoryItem[] = [
        {
          id: "1",
          farm_id: "farm1",
          feed_type: "Hay",
          category: "roughage",
          quantity_kg: 500,
          unit: "kg",
          expiry_date: in15Days.toISOString(),
          last_updated: "2026-01-01",
          created_at: "2026-01-01",
        },
        {
          id: "2",
          farm_id: "farm1",
          feed_type: "Corn",
          category: "concentrates",
          quantity_kg: 300,
          unit: "kg",
          expiry_date: in45Days.toISOString(),
          last_updated: "2026-01-01",
          created_at: "2026-01-01",
        },
      ];

      const summary = computeFeedSummary(items, 100);

      expect(summary.expiringCount).toBe(1);
    });

    it("should count low stock items below threshold", () => {
      const items: FeedInventoryItem[] = [
        {
          id: "1",
          farm_id: "farm1",
          feed_type: "Hay",
          category: "roughage",
          quantity_kg: 50,
          unit: "kg",
          reorder_threshold: 100,
          last_updated: "2026-01-01",
          created_at: "2026-01-01",
        },
        {
          id: "2",
          farm_id: "farm1",
          feed_type: "Corn",
          category: "concentrates",
          quantity_kg: 200,
          unit: "kg",
          reorder_threshold: 100,
          last_updated: "2026-01-01",
          created_at: "2026-01-01",
        },
      ];

      const summary = computeFeedSummary(items, 100);

      expect(summary.lowStockCount).toBe(1);
    });

    it("should handle zero consumption gracefully", () => {
      const items: FeedInventoryItem[] = [
        {
          id: "1",
          farm_id: "farm1",
          feed_type: "Hay",
          category: "roughage",
          quantity_kg: 1000,
          unit: "kg",
          last_updated: "2026-01-01",
          created_at: "2026-01-01",
        },
      ];

      const summary = computeFeedSummary(items, 0);

      expect(summary.roughageDays).toBeNull();
      expect(summary.concentrateDays).toBeNull();
      expect(summary.feedStockDays).toBeNull();
    });

    it("should handle empty inventory", () => {
      const summary = computeFeedSummary([], 100);

      expect(summary.totalKg).toBe(0);
      expect(summary.roughageKg).toBe(0);
      expect(summary.concentrateKg).toBe(0);
    });

    it("should default uncategorized items to roughage", () => {
      const items: FeedInventoryItem[] = [
        {
          id: "1",
          farm_id: "farm1",
          feed_type: "Mixed Feed",
          quantity_kg: 500,
          unit: "kg",
          last_updated: "2026-01-01",
          created_at: "2026-01-01",
          // No category specified
        },
      ];

      const summary = computeFeedSummary(items, 100);

      expect(summary.roughageKg).toBe(500);
      expect(summary.concentrateKg).toBe(0);
    });
  });

  describe("calculateTotalDailyConsumption", () => {
    // Helper to create a minimal animal for consumption testing
    const makeAnimal = (overrides: Partial<AnimalForConsumption> = {}): AnimalForConsumption => ({
      id: "test-animal",
      livestock_type: "cattle",
      life_stage: null,
      milking_stage: null,
      current_weight_kg: null,
      entry_weight_kg: null,
      birth_weight_kg: null,
      gender: null,
      ...overrides,
    });

    it("should calculate consumption for cattle with default weight", () => {
      const consumption = calculateTotalDailyConsumption([
        makeAnimal({ livestock_type: "cattle" }),
      ]);
      // Default cattle weight: 400kg, maintenance DM: 2.0%, fresh = DM / 0.30
      // 400 * 0.02 = 8 kg DM, 8 / 0.30 = 26.67 kg fresh
      expect(consumption).toBeCloseTo(26.67, 1);
    });

    it("should calculate consumption for goat with default weight", () => {
      const consumption = calculateTotalDailyConsumption([
        makeAnimal({ livestock_type: "goat" }),
      ]);
      // Default goat weight: 40kg, maintenance DM: 2.0%, fresh = DM / 0.30
      // 40 * 0.02 = 0.8 kg DM, 0.8 / 0.30 = 2.67 kg fresh
      expect(consumption).toBeCloseTo(2.67, 1);
    });

    it("should use higher DM% for lactating animals", () => {
      const consumption = calculateTotalDailyConsumption([
        makeAnimal({ livestock_type: "cattle", milking_stage: "peak" }),
      ]);
      // Default cattle weight: 400kg, lactating DM: 3.5%, fresh = DM / 0.30
      // 400 * 0.035 = 14 kg DM, 14 / 0.30 = 46.67 kg fresh
      expect(consumption).toBeCloseTo(46.67, 1);
    });

    it("should use actual weight when provided", () => {
      const consumption = calculateTotalDailyConsumption([
        makeAnimal({ livestock_type: "cattle", current_weight_kg: 500 }),
      ]);
      // 500kg, maintenance DM: 2.0%, fresh = DM / 0.30
      // 500 * 0.02 = 10 kg DM, 10 / 0.30 = 33.33 kg fresh
      expect(consumption).toBeCloseTo(33.33, 1);
    });

    it("should sum across multiple animals", () => {
      const consumption = calculateTotalDailyConsumption([
        makeAnimal({ livestock_type: "cattle" }),
        makeAnimal({ livestock_type: "cattle" }),
        makeAnimal({ livestock_type: "goat" }),
      ]);
      // 2 cattle (26.67 each) + 1 goat (2.67) = 56.01
      expect(consumption).toBeCloseTo(56.01, 0);
    });

    it("should handle empty array", () => {
      const consumption = calculateTotalDailyConsumption([]);
      expect(consumption).toBe(0);
    });
  });
});
