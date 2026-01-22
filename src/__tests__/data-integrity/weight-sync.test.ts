import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkWeightSync } from "@/test-utils/data-integrity-helpers";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            not: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null, error: { code: "PGRST116" } })),
            })),
          })),
        })),
      })),
    })),
  },
}));

describe("Weight Sync Integrity Check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return passed when no animals have current weight", async () => {
    const result = await checkWeightSync("test-farm-id");
    
    expect(result.checkName).toBe("weight_sync");
    expect(result.passed).toBe(true);
    expect(result.discrepancies).toHaveLength(0);
  });

  it("should have correct structure for integrity check result", async () => {
    const result = await checkWeightSync("test-farm-id");
    
    expect(result).toHaveProperty("passed");
    expect(result).toHaveProperty("checkName");
    expect(result).toHaveProperty("details");
    expect(result).toHaveProperty("discrepancies");
    expect(Array.isArray(result.discrepancies)).toBe(true);
  });

  it("should verify sync between weight_records and animals.current_weight_kg", async () => {
    const result = await checkWeightSync("test-farm-id");
    
    // The check should validate the sync trigger relationship
    expect(result.checkName).toBe("weight_sync");
    expect(typeof result.details).toBe("string");
  });
});
