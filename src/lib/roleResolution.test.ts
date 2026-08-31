import { describe, it, expect } from "vitest";
import { resolveRoleTarget, roleTargetPath } from "./roleResolution";

describe("resolveRoleTarget", () => {
  const base = { userRoles: [] as string[], ownsFarm: false, membershipRole: null as string | null, hasMembership: false };

  it("routes global roles by precedence: admin > government > merchant", () => {
    expect(resolveRoleTarget({ ...base, userRoles: ["admin", "government"] })).toBe("admin");
    expect(resolveRoleTarget({ ...base, userRoles: ["government", "merchant"] })).toBe("government");
    expect(resolveRoleTarget({ ...base, userRoles: ["merchant"] })).toBe("merchant");
  });

  it("routes a pure farmhand (no owned farm, farmhand membership, no roles)", () => {
    expect(
      resolveRoleTarget({ ...base, membershipRole: "farmhand", hasMembership: true }),
    ).toBe("farmhand");
  });

  it("a farm owner is a farmer even with a farmhand membership elsewhere", () => {
    expect(
      resolveRoleTarget({ ...base, ownsFarm: true, membershipRole: "farmhand", hasMembership: true }),
    ).toBe("farmer");
  });

  it("a farmer_owner role blocks the farmhand branch (matches old Dashboard logic)", () => {
    expect(
      resolveRoleTarget({
        ...base,
        userRoles: ["farmer_owner"],
        membershipRole: "farmhand",
        hasMembership: true,
      }),
    ).toBe("farmer");
  });

  it("a manager membership (farmer_owner role_in_farm) is a farmer", () => {
    expect(
      resolveRoleTarget({ ...base, membershipRole: "farmer_owner", hasMembership: true }),
    ).toBe("farmer");
  });

  it("no farm and no membership → setup", () => {
    expect(resolveRoleTarget(base)).toBe("setup");
  });

  it("maps every target to a path", () => {
    expect(roleTargetPath("admin")).toBe("/admin");
    expect(roleTargetPath("government")).toBe("/government");
    expect(roleTargetPath("merchant")).toBe("/merchant");
    expect(roleTargetPath("farmhand")).toBe("/home");
    expect(roleTargetPath("farmer")).toBe("/home");
    expect(roleTargetPath("setup")).toBe("/setup");
  });
});
