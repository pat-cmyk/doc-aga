/**
 * Farm shell route metadata (UX redesign Phase 2).
 *
 * SSOT for the bottom nav / desktop nav items and for which paths count as
 * "root tabs" (hardware back on a root tab asks to exit instead of going back).
 */
import { Home, Beef, Settings2, Wallet, MoreHorizontal, type LucideIcon } from "lucide-react";

export interface FarmNavItem {
  to: string;
  /** Path prefix that marks this item active (defaults to `to`). */
  activePrefix?: string;
  icon: LucideIcon;
  label: string;
  /** Shows the pending-approvals badge. */
  badge?: boolean;
  /** Hidden for farmhands (money/finance is owner-manager only). */
  requiresManage?: boolean;
}

export const FARM_NAV_ITEMS: FarmNavItem[] = [
  { to: "/home", icon: Home, label: "Home" },
  { to: "/animals", icon: Beef, label: "Animals" },
  { to: "/operations/milk", activePrefix: "/operations", icon: Settings2, label: "Ops" },
  { to: "/money", icon: Wallet, label: "Money", requiresManage: true },
  { to: "/more", icon: MoreHorizontal, label: "More", badge: true },
];

export function navItemsForRole(options: { isFarmhand: boolean }): FarmNavItem[] {
  return FARM_NAV_ITEMS.filter((item) => !(item.requiresManage && options.isFarmhand));
}

export function isNavItemActive(pathname: string, item: FarmNavItem): boolean {
  // Sub-pages (Marketplace, Orders, …) live under the More hub conceptually,
  // so More stays highlighted there for orientation.
  if (item.to === "/more" && subPageFor(pathname)) return true;
  const prefix = item.activePrefix ?? item.to;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Shell sub-pages (UX redesign Phase 6): render with a back-titled PageHeader
 * instead of the farm root header, keep the persistent nav, no FAB.
 */
export interface SubPageMeta {
  title: string;
  subtitle?: string;
}

export const SUB_PAGES: Record<string, SubPageMeta> = {
  "/marketplace": { title: "Marketplace", subtitle: "Palengke" },
  "/orders": { title: "My Orders", subtitle: "Mga order" },
  "/messages": { title: "Messages", subtitle: "Mga mensahe" },
  "/distributors": { title: "Find Distributors", subtitle: "Mga distributor" },
  "/profile": { title: "Profile" },
};

export function subPageFor(pathname: string): SubPageMeta | null {
  for (const [prefix, meta] of Object.entries(SUB_PAGES)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return meta;
  }
  return null;
}

/** Root tabs: hardware back here confirms exit instead of navigating. */
const ROOT_TAB_PREFIXES = ["/home", "/animals", "/operations", "/money", "/more"];

export function isRootTab(pathname: string): boolean {
  // /animals/:id (Phase 3) is NOT a root tab — only the top-level lists are.
  if (pathname === "/animals" || pathname === "/home" || pathname === "/money" || pathname === "/more") {
    return true;
  }
  return ROOT_TAB_PREFIXES.some((p) => p === "/operations" && (pathname === p || pathname.startsWith(`${p}/`)));
}

/**
 * Focused flows: full-screen pages inside the shell that hide the app chrome
 * (header/nav/FAB) so a stray tap can't abandon the form mid-fill.
 */
export function isFocusedRoute(pathname: string): boolean {
  return pathname === "/animals/new" || /^\/animals\/[^/]+\/edit$/.test(pathname);
}

/** Farmhands only get the feed segment of Operations. */
export const OPERATIONS_SUBTABS = ["milk", "feed", "breeding"] as const;
export type OperationsSubtab = (typeof OPERATIONS_SUBTABS)[number];

export function allowedOperationsSubtabs(options: { isFarmhand: boolean }): OperationsSubtab[] {
  return options.isFarmhand ? ["feed"] : [...OPERATIONS_SUBTABS];
}
