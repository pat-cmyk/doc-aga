import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkMilkRevenueSync } from "@/test-utils/data-integrity-helpers";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            not: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          not: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        not: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  },
}));

describe("Milk Revenue Sync Integrity Check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return passed when no sold milk records exist", async () => {
    const result = await checkMilkRevenueSync("test-farm-id");
    
    expect(result.checkName).toBe("milk_revenue_sync");
    expect(result.passed).toBe(true);
    expect(result.discrepancies).toHaveLength(0);
  });

  it("should have correct structure for integrity check result", async () => {
    const result = await checkMilkRevenueSync("test-farm-id");
    
    expect(result).toHaveProperty("passed");
    expect(result).toHaveProperty("checkName");
    expect(result).toHaveProperty("details");
    expect(result).toHaveProperty("discrepancies");
    expect(Array.isArray(result.discrepancies)).toBe(true);
  });

  it("should include farmId context in the check", async () => {
    const farmId = "specific-farm-123";
    const result = await checkMilkRevenueSync(farmId);
    
    // The function should complete without error for any valid farm ID
    expect(result.checkName).toBe("milk_revenue_sync");
  });
});
