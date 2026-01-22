import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkStatsConsistency } from "@/test-utils/data-integrity-helpers";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
  },
}));

describe("Stats Consistency Integrity Check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return passed when RPC returns empty consistent results", async () => {
    const result = await checkStatsConsistency("test-farm-id", "2026-01-22");
    
    expect(result.checkName).toBe("stats_consistency");
    expect(result.passed).toBe(true);
    expect(result.discrepancies).toHaveLength(0);
  });

  it("should have correct structure for integrity check result", async () => {
    const result = await checkStatsConsistency("test-farm-id", "2026-01-22");
    
    expect(result).toHaveProperty("passed");
    expect(result).toHaveProperty("checkName");
    expect(result).toHaveProperty("details");
    expect(result).toHaveProperty("discrepancies");
    expect(Array.isArray(result.discrepancies)).toBe(true);
  });

  it("should use check_data_consistency RPC function", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    
    await checkStatsConsistency("test-farm-id", "2026-01-22");
    
    expect(supabase.rpc).toHaveBeenCalledWith("check_data_consistency", {
      p_farm_id: "test-farm-id",
      p_date: "2026-01-22",
    });
  });

  it("should include date in the details message", async () => {
    const testDate = "2026-01-22";
    const result = await checkStatsConsistency("test-farm-id", testDate);
    
    expect(result.details).toContain(testDate);
  });
});
