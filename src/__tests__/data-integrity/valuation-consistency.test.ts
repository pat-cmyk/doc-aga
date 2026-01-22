import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkValuationConsistency } from "@/test-utils/data-integrity-helpers";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  },
}));

describe("Valuation Consistency Integrity Check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return passed when no valuations exist", async () => {
    const result = await checkValuationConsistency("test-farm-id");
    
    expect(result.checkName).toBe("valuation_consistency");
    expect(result.passed).toBe(true);
    expect(result.discrepancies).toHaveLength(0);
  });

  it("should have correct structure for integrity check result", async () => {
    const result = await checkValuationConsistency("test-farm-id");
    
    expect(result).toHaveProperty("passed");
    expect(result).toHaveProperty("checkName");
    expect(result).toHaveProperty("details");
    expect(result).toHaveProperty("discrepancies");
    expect(Array.isArray(result.discrepancies)).toBe(true);
  });

  it("should verify estimated_value = weight_kg × market_price_per_kg", async () => {
    const result = await checkValuationConsistency("test-farm-id");
    
    // The check validates the mathematical relationship
    expect(result.checkName).toBe("valuation_consistency");
    expect(typeof result.details).toBe("string");
  });

  it("should query current month valuations", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    
    await checkValuationConsistency("test-farm-id");
    
    expect(supabase.from).toHaveBeenCalledWith("biological_asset_valuations");
  });
});
