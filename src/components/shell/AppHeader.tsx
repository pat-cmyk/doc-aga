/**
 * Unified shell header (UX redesign Phase 2).
 *
 * Root-mode header for all farm-shell routes: farm identity + status cluster,
 * lifted from the old pages/Dashboard.tsx header. One responsive DOM tree —
 * the status cluster wraps to a second row below `sm` via CSS instead of the
 * old isMobile ternaries (which flashed desktop layout on first mobile render).
 * Desktop (md+) also gets the horizontal nav row that replaces the old TabsList.
 */
import { NavLink, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Sprout } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserEmailDropdown } from "@/components/UserEmailDropdown";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { FarmSwitcher } from "@/components/FarmSwitcher";
import { SyncStatusSheet } from "@/components/sync";
import { PhilippineTimeBanner } from "@/components/ui/PhilippineTimeBanner";
import { useFarm } from "@/contexts/FarmContext";
import { useUnifiedPermissions } from "@/contexts/PermissionsContext";
import { navItemsForRole, isNavItemActive } from "./routes";

interface AppHeaderProps {
  pendingCount: number;
}

/** Desktop (md+) horizontal nav — used by AppHeader and shell sub-pages. */
export function DesktopNavRow({ pendingCount }: { pendingCount: number }) {
  const { isFarmhand } = useUnifiedPermissions();
  const { pathname } = useLocation();
  const navItems = navItemsForRole({ isFarmhand });

  return (
    <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1 pt-3">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            isNavItemActive(pathname, item)
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
          {item.badge && pendingCount > 0 && (
            <Badge
              variant="destructive"
              className="h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {pendingCount > 9 ? "9+" : pendingCount}
            </Badge>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppHeader({ pendingCount }: AppHeaderProps) {
  const { farmId, farmName, farmLogoUrl, setFarmId, setFarmDetails } = useFarm();

  const handleFarmChange = async (newFarmId: string) => {
    setFarmId(newFarmId);
    const { data: farmData } = await supabase
      .from("farms")
      .select("name, logo_url, owner_id")
      .eq("id", newFarmId)
      .single();
    if (farmData) {
      const { data: { user } } = await supabase.auth.getUser();
      setFarmDetails({
        name: farmData.name || "My Farm",
        logoUrl: farmData.logo_url || null,
        canManage: farmData.owner_id === user?.id,
      });
    }
  };

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 pt-safe">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {farmLogoUrl ? (
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={farmLogoUrl} alt={farmName} />
                <AvatarFallback className="bg-primary/10">
                  <Sprout className="h-5 w-5 text-primary" />
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                <Sprout className="h-5 w-5 text-primary" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-xl font-bold truncate">{farmName}</h1>
              <PhilippineTimeBanner compact />
            </div>
          </div>
          <FarmSwitcher currentFarmId={farmId} onFarmChange={handleFarmChange} />
          {/* Status cluster: own row (right-aligned) on phones, inline on sm+ */}
          <div className="flex items-center justify-end gap-2 w-full sm:w-auto sm:ml-auto">
            <SyncStatusSheet />
            <NetworkStatusIndicator />
            <NotificationBell />
            <UserEmailDropdown />
          </div>
        </div>

        {/* Desktop nav row — replaces the old desktop TabsList */}
        <DesktopNavRow pendingCount={pendingCount} />
      </div>
    </header>
  );
}
