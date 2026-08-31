/**
 * Pure role-target resolution (UX redesign Phase 2).
 *
 * Extracted from the old pages/Dashboard.tsx role router so RoleLanding and
 * FarmShell share one testable decision. Mirrors the original precedence:
 * global roles (admin > government > merchant) win over farm roles; a user is
 * a farmhand only when they own no farm and their accepted membership says so.
 */
export interface RoleResolutionInput {
  /** Rows from user_roles for this user. */
  userRoles: string[];
  /** User owns at least one non-deleted farm. */
  ownsFarm: boolean;
  /** role_in_farm of the first accepted farm membership, if any. */
  membershipRole: string | null;
  /** User has an accepted farm membership. */
  hasMembership: boolean;
}

export type RoleTarget =
  | "admin"
  | "government"
  | "merchant"
  | "farmhand"
  | "farmer"
  | "setup";

const GLOBAL_ROLES = ["admin", "government", "merchant", "distributor"];

export function resolveRoleTarget(input: RoleResolutionInput): RoleTarget {
  const { userRoles, ownsFarm, membershipRole, hasMembership } = input;

  if (userRoles.includes("admin")) return "admin";
  if (userRoles.includes("government")) return "government";
  if (userRoles.includes("merchant")) return "merchant";

  const hasOnlyGlobalRoles = userRoles.every((role) => GLOBAL_ROLES.includes(role));
  if (
    !ownsFarm &&
    membershipRole === "farmhand" &&
    (userRoles.length === 0 || hasOnlyGlobalRoles)
  ) {
    return "farmhand";
  }

  if (ownsFarm || hasMembership) return "farmer";

  return "setup";
}

/** Route path for each role target. */
export function roleTargetPath(target: RoleTarget): string {
  switch (target) {
    case "admin":
      return "/admin";
    case "government":
      return "/government";
    case "merchant":
      return "/merchant";
    case "setup":
      return "/setup";
    // Farmhand and farmer share the shell; /home renders the right variant.
    case "farmhand":
    case "farmer":
      return "/home";
  }
}
