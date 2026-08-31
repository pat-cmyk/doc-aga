/**
 * URL-routed bottom navigation (UX redesign Phase 2).
 *
 * NavLink rewrite of the old ui/bottom-nav.tsx, which drove local tab state on
 * one page only. Now the active tab comes from the URL, the bar persists on
 * every farm-shell route, and items filter by role (farmhands see no Money).
 * Visual language (gradient bar, active pill, badge on More) is unchanged.
 */
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import { Badge } from "@/components/ui/badge";
import { useUnifiedPermissions } from "@/contexts/PermissionsContext";
import { navItemsForRole, isNavItemActive } from "./routes";

interface AppBottomNavProps {
  pendingCount?: number;
}

export function AppBottomNav({ pendingCount = 0 }: AppBottomNavProps) {
  const { isFarmhand } = useUnifiedPermissions();
  const { pathname } = useLocation();
  const items = navItemsForRole({ isFarmhand });

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border pb-safe w-full max-w-full"
    >
      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-card via-card to-card/95 backdrop-blur-md" />

      <div className="relative flex items-center justify-around h-16 max-w-lg mx-auto px-2 w-full">
        {items.map((item) => {
          const isActive = isNavItemActive(pathname, item);
          const Icon = item.icon;
          const showBadge = item.badge && pendingCount > 0;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => hapticImpact("light")}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-16 h-14 rounded-xl",
                "transition-colors duration-200 touch-manipulation",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground active:scale-95",
              )}
            >
              <div className="relative">
                <div
                  className={cn(
                    "p-1.5 rounded-lg transition-all duration-200",
                    isActive && "bg-primary/10 animate-scale-in shadow-sm",
                  )}
                >
                  <Icon className={cn("h-5 w-5 transition-all duration-200", isActive && "stroke-[2.5]")} />
                </div>
                {showBadge && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] animate-scale-in"
                  >
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </Badge>
                )}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium leading-tight",
                  isActive ? "text-primary" : "text-muted-foreground/70",
                )}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
