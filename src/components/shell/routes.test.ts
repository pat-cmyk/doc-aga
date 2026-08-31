import { describe, it, expect } from "vitest";
import {
  FARM_NAV_ITEMS,
  navItemsForRole,
  isNavItemActive,
  isRootTab,
  allowedOperationsSubtabs,
} from "./routes";

describe("navItemsForRole", () => {
  it("farmers get all five items", () => {
    expect(navItemsForRole({ isFarmhand: false }).map((i) => i.label)).toEqual([
      "Home",
      "Animals",
      "Ops",
      "Money",
      "More",
    ]);
  });

  it("farmhands do not get Money", () => {
    expect(navItemsForRole({ isFarmhand: true }).map((i) => i.label)).toEqual([
      "Home",
      "Animals",
      "Ops",
      "More",
    ]);
  });
});

describe("isNavItemActive", () => {
  const byLabel = (label: string) => FARM_NAV_ITEMS.find((i) => i.label === label)!;

  it("matches exact paths", () => {
    expect(isNavItemActive("/home", byLabel("Home"))).toBe(true);
    expect(isNavItemActive("/money", byLabel("Money"))).toBe(true);
    expect(isNavItemActive("/home", byLabel("Animals"))).toBe(false);
  });

  it("Ops is active on every operations subtab", () => {
    expect(isNavItemActive("/operations/milk", byLabel("Ops"))).toBe(true);
    expect(isNavItemActive("/operations/feed", byLabel("Ops"))).toBe(true);
    expect(isNavItemActive("/operations/breeding", byLabel("Ops"))).toBe(true);
  });

  it("Animals stays active on nested animal routes (Phase 3)", () => {
    expect(isNavItemActive("/animals/abc-123", byLabel("Animals"))).toBe(true);
  });
});

describe("isRootTab", () => {
  it("top-level tabs are roots", () => {
    for (const p of ["/home", "/animals", "/operations/milk", "/operations/feed", "/money", "/more"]) {
      expect(isRootTab(p)).toBe(true);
    }
  });

  it("nested detail routes are not roots", () => {
    expect(isRootTab("/animals/abc-123")).toBe(false);
    expect(isRootTab("/animals/new")).toBe(false);
    expect(isRootTab("/profile")).toBe(false);
  });
});

describe("allowedOperationsSubtabs", () => {
  it("farmhands only get feed", () => {
    expect(allowedOperationsSubtabs({ isFarmhand: true })).toEqual(["feed"]);
    expect(allowedOperationsSubtabs({ isFarmhand: false })).toEqual(["milk", "feed", "breeding"]);
  });
});
