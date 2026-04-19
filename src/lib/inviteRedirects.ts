export type InviteType = "user" | "farm" | "coop";

export type ResolveInput = {
  type: InviteType;
  role: string;
};

const USER_ROLE_HOMES: Record<string, string> = {
  admin: "/admin",
  government: "/government",
  merchant: "/merchant",
  distributor: "/distributor",
  cooperative: "/cooperative",
};

export function resolveInviteRedirect(input: ResolveInput): string {
  if (input.type === "user") return USER_ROLE_HOMES[input.role] ?? "/";
  if (input.type === "farm") return input.role === "farmhand" ? "/farmhand" : "/";
  return "/"; // coop
}
