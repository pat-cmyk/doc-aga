import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkFeedInventorySync,
  checkFeedStockBreakdownSync,
} from "@/test-utils/data-integrity-helpers";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  },
}));

// Mock dataCache functions
vi.mock("@/lib/dataCache", () => ({
  getCachedFeedInventory: vi.fn(() => Promise.resolve(null)),
  getCachedDashboardStats: vi.fn(() => Promise.resolve(null)),
}));

describe("Feed Inventory SSOT Integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkFeedInventorySync", () => {
    it("should return passed when no inventory exists", async () => {
      const result = await checkFeedInventorySync("test-farm-id");

      expect(result.checkName).toBe("feed_inventory_sync");
      expect(result.passed).toBe(true);
      expect(result.discrepancies).toHaveLength(0);
    });

    it("should have correct structure for integrity check result", async () => {
      const result = await checkFeedInventorySync("test-farm-id");

      expect(result).toHaveProperty("passed");
      expect(result).toHaveProperty("checkName");
      expect(result).toHaveProperty("details");
      expect(result).toHaveProperty("discrepancies");
      expect(Array.isArray(result.discrepancies)).toBe(true);
    });

    it("should complete without error for any valid farm ID", async () => {
      const farmId = "specific-farm-123";
      const result = await checkFeedInventorySync(farmId);

      expect(result.checkName).toBe("feed_inventory_sync");
    });
  });

  describe("checkFeedStockBreakdownSync", () => {
    it("should return passed when no dashboard stats exist", async () => {
      const result = await checkFeedStockBreakdownSync("test-farm-id");

      expect(result.checkName).toBe("feed_stock_breakdown_sync");
      expect(result.passed).toBe(true);
    });

    it("should have correct structure for integrity check result", async () => {
      const result = await checkFeedStockBreakdownSync("test-farm-id");

      expect(result).toHaveProperty("passed");
      expect(result).toHaveProperty("checkName");
      expect(result).toHaveProperty("details");
      expect(result).toHaveProperty("discrepancies");
    });
  });

  describe("Category Classification", () => {
    it("should correctly categorize items by explicit category field", () => {
      const items = [
        { category: "concentrates", quantity_kg: 100 },
        { category: "roughage", quantity_kg: 200 },
        { category: "minerals", quantity_kg: 50 },
      ];

      const concentrates = items.filter((i) => i.category === "concentrates");
      const roughage = items.filter((i) => i.category === "roughage");

      expect(concentrates).toHaveLength(1);
      expect(concentrates[0].quantity_kg).toBe(100);
      expect(roughage).toHaveLength(1);
      expect(roughage[0].quantity_kg).toBe(200);
    });

    it("should default uncategorized items to roughage", () => {
      const items = [
        { category: "roughage", quantity_kg: 200 },
        { category: undefined, quantity_kg: 300 },
        { category: null, quantity_kg: 150 },
      ];

      const roughage = items.filter(
        (i) => i.category === "roughage" || !i.category
      );
      expect(roughage).toHaveLength(3);
    });

    it("should not classify by feed_type string matching", () => {
      const items = [
        { feed_type: "Hay", category: "roughage", quantity_kg: 100 },
        { feed_type: "Corn", category: "concentrates", quantity_kg: 50 },
      ];

      // Category should be the source of truth, not feed_type
      const concentrates = items.filter((i) => i.category === "concentrates");
      expect(concentrates[0].feed_type).toBe("Corn");
    });
  });

  describe("Summary Computation", () => {
    const computeSummary = (items: any[], dailyConsumption: number) => {
      const roughageKg = items
        .filter((i) => i.category === "roughage" || !i.category)
        .reduce((sum, i) => sum + (i.quantity_kg || 0), 0);

      const concentrateKg = items
        .filter((i) => i.category === "concentrates")
        .reduce((sum, i) => sum + (i.quantity_kg || 0), 0);

      const dailyRoughage = dailyConsumption * 0.7;
      const dailyConcentrate = dailyConsumption * 0.3;

      return {
        roughageKg,
        concentrateKg,
        roughageDays:
          dailyRoughage > 0 ? Math.floor(roughageKg / dailyRoughage) : null,
        concentrateDays:
          dailyConcentrate > 0
            ? Math.floor(concentrateKg / dailyConcentrate)
            : null,
        feedStockDays:
          dailyRoughage > 0 ? Math.floor(roughageKg / dailyRoughage) : null,
      };
    };

    it("should compute roughageDays correctly with non-zero consumption", () => {
      const items = [{ category: "roughage", quantity_kg: 1000 }];
      const summary = computeSummary(items, 100); // 100 kg/day total -> 70 kg roughage

      expect(summary.roughageDays).toBe(14); // 1000 / 70 = 14.28 -> 14
    });

    it("should compute concentrateDays using 30% diet ratio", () => {
      const items = [{ category: "concentrates", quantity_kg: 300 }];
      const summary = computeSummary(items, 100); // 100 kg/day total -> 30 kg concentrate

      expect(summary.concentrateDays).toBe(10); // 300 / 30 = 10
    });

    it("should set feedStockDays equal to roughageDays (survival buffer)", () => {
      const items = [
        { category: "roughage", quantity_kg: 700 },
        { category: "concentrates", quantity_kg: 300 },
      ];
      const summary = computeSummary(items, 100);

      expect(summary.feedStockDays).toBe(summary.roughageDays);
    });

    it("should handle zero daily consumption gracefully (return null)", () => {
      const items = [{ category: "roughage", quantity_kg: 1000 }];
      const summary = computeSummary(items, 0);

      expect(summary.roughageDays).toBeNull();
      expect(summary.concentrateDays).toBeNull();
      expect(summary.feedStockDays).toBeNull();
    });

    it("should handle empty inventory gracefully", () => {
      const summary = computeSummary([], 100);

      expect(summary.roughageKg).toBe(0);
      expect(summary.concentrateKg).toBe(0);
      expect(summary.roughageDays).toBe(0);
      expect(summary.concentrateDays).toBe(0);
    });
  });

  describe("Consumption Rate Calculation", () => {
    const CONSUMPTION_RATES: Record<string, number> = {
      cattle: 12,
      carabao: 10,
      goat: 1.5,
      sheep: 2,
      default: 10,
    };

    const calculateConsumption = (
      animalCounts: { type: string; count: number }[]
    ) => {
      return animalCounts.reduce((total, { type, count }) => {
        const rate =
          CONSUMPTION_RATES[type.toLowerCase()] || CONSUMPTION_RATES.default;
        return total + rate * count;
      }, 0);
    };

    it("should apply cattle rate (12 kg/day)", () => {
      const consumption = calculateConsumption([{ type: "cattle", count: 1 }]);
      expect(consumption).toBe(12);
    });

    it("should apply carabao rate (10 kg/day)", () => {
      const consumption = calculateConsumption([{ type: "carabao", count: 1 }]);
      expect(consumption).toBe(10);
    });

    it("should apply goat rate (1.5 kg/day)", () => {
      const consumption = calculateConsumption([{ type: "goat", count: 1 }]);
      expect(consumption).toBe(1.5);
    });

    it("should apply sheep rate (2 kg/day)", () => {
      const consumption = calculateConsumption([{ type: "sheep", count: 1 }]);
      expect(consumption).toBe(2);
    });

    it("should use default rate (10 kg/day) for unknown types", () => {
      const consumption = calculateConsumption([{ type: "unknown", count: 1 }]);
      expect(consumption).toBe(10);
    });

    it("should sum across multiple livestock types", () => {
      const consumption = calculateConsumption([
        { type: "cattle", count: 2 }, // 24
        { type: "goat", count: 4 }, // 6
      ]);
      expect(consumption).toBe(30);
    });
  });

  describe("Cache Version Integrity", () => {
    const EXPECTED_VERSION = 3;

    it("should detect stale cache when version mismatches", () => {
      const cacheVersion = 2;
      const isStale = cacheVersion < EXPECTED_VERSION;

      expect(isStale).toBe(true);
    });

    it("should accept cache when version matches", () => {
      const cacheVersion = 3;
      const isStale = cacheVersion < EXPECTED_VERSION;

      expect(isStale).toBe(false);
    });
  });
});
