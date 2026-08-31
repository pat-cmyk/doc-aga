import { describe, it, expect } from "vitest";
import { mapLegacyDashboardUrl } from "./legacyRedirects";

describe("mapLegacyDashboardUrl", () => {
  // The exact URL shapes produced by the pre-shell app (Dashboard.tsx query
  // parsing, notification targets, OnboardingChecklist, alert widgets).
  const table: Array<[legacy: string, expected: string | null]> = [
    ["", null],
    ["?utm_source=x", null],
    ["?animalId=abc-123", "/animals?animalId=abc-123"],
    ["?animalId=abc-123&editWeight=true", "/animals?editWeight=true&animalId=abc-123"],
    ["?tab=animals&animalId=abc-123", "/animals?animalId=abc-123"],
    ["?tab=animals", "/animals"],
    ["?tab=animals&filter=missing-weight", "/animals?filter=missing-weight"],
    ["?filter=missing-weight", "/animals?filter=missing-weight"],
    ["?tab=operations", "/operations/milk"],
    ["?tab=operations&subtab=milk", "/operations/milk"],
    ["?tab=operations&subtab=feed", "/operations/feed"],
    ["?tab=operations&subtab=breeding", "/operations/breeding"],
    ["?tab=feed", "/operations/feed"],
    ["?tab=milk", "/operations/milk"],
    ["?tab=operations&subtab=milk&highlight=milk-species", "/operations/milk?highlight=milk-species"],
    ["?prefillFeedType=Napier", "/operations/feed?prefillFeedType=Napier"],
    ["?tab=operations&subtab=feed&prefillFeedType=Napier", "/operations/feed?prefillFeedType=Napier"],
    ["?tab=finance", "/money"],
    ["?tab=approvals", "/more?tab=approvals"],
    ["?tab=government", "/more?tab=government"],
  ];

  it.each(table)("maps %s → %s", (legacy, expected) => {
    expect(mapLegacyDashboardUrl(legacy)).toBe(expected);
  });

  it("prefers animalId over other params (matches old Dashboard precedence)", () => {
    expect(mapLegacyDashboardUrl("?tab=finance&animalId=a1")).toBe("/animals?animalId=a1");
  });
});
