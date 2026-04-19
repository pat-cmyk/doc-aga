import { describe, expect, it } from "vitest";
import { resolveInviteRedirect } from "./inviteRedirects";

describe("resolveInviteRedirect", () => {
  it("routes admin user invites to /admin", () => {
    expect(resolveInviteRedirect({ type: "user", role: "admin" })).toBe("/admin");
  });
  it("routes government user invites to /government", () => {
    expect(resolveInviteRedirect({ type: "user", role: "government" })).toBe("/government");
  });
  it("routes merchant user invites to /merchant", () => {
    expect(resolveInviteRedirect({ type: "user", role: "merchant" })).toBe("/merchant");
  });
  it("routes distributor user invites to /distributor", () => {
    expect(resolveInviteRedirect({ type: "user", role: "distributor" })).toBe("/distributor");
  });
  it("routes cooperative user invites to /cooperative", () => {
    expect(resolveInviteRedirect({ type: "user", role: "cooperative" })).toBe("/cooperative");
  });
  it("routes farmhand farm invites to /farmhand", () => {
    expect(resolveInviteRedirect({ type: "farm", role: "farmhand" })).toBe("/farmhand");
  });
  it("routes farmer_owner farm invites to /", () => {
    expect(resolveInviteRedirect({ type: "farm", role: "farmer_owner" })).toBe("/");
  });
  it("routes coop invites to /", () => {
    expect(resolveInviteRedirect({ type: "coop", role: "farmer_owner" })).toBe("/");
  });
  it("falls back to / for unknown user role", () => {
    expect(resolveInviteRedirect({ type: "user", role: "unknown" })).toBe("/");
  });
});
