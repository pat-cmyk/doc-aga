/**
 * Farm app shell (UX redesign Phase 2).
 *
 * Layout route for every farmer/farmhand screen: unified header, persistent
 * bottom nav, floating widgets, Android hardware-back handling, pull-to-
 * refresh, and farm bootstrap — all owned once here instead of per-page.
 * Route content renders through <Outlet/> with a shared context.
 */
import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useOutletContext } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { useFarm } from "@/contexts/FarmContext";
import { useUnifiedPermissions } from "@/contexts/PermissionsContext";
import { useFarmBootstrap } from "@/hooks/useFarmBootstrap";
import { useAndroidBackButton } from "@/hooks/useAndroidBackButton";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { usePendingActivities } from "@/hooks/usePendingActivities";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { syncQueue } from "@/lib/syncService";
import { preloadAllData } from "@/lib/dataCache";
import { roleTargetPath } from "@/lib/roleResolution";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { OfflineOnboarding } from "@/components/OfflineOnboarding";
import { AppHeader } from "./AppHeader";
import { AppBottomNav } from "./AppBottomNav";
import { FloatingDock } from "./FloatingDock";
import { isFocusedRoute } from "./routes";

export interface FarmShellContext {
  farmId: string;
  user: User | null;
  isFarmhand: boolean;
  canManageFarm: boolean;
  voiceTrainingCompleted: boolean;
}

export function useFarmShellContext() {
  return useOutletContext<FarmShellContext>();
}

export function FarmShell() {
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const { pathname } = useLocation();
  const { farmId } = useFarm();
  const { isFarmhand, canManageFarm } = useUnifiedPermissions();
  const bootstrap = useFarmBootstrap();
  useAndroidBackButton();

  const { pendingCount } = usePendingActivities(farmId || undefined, undefined);
  const badgeCount = canManageFarm ? pendingCount : 0;

  const handleRefresh = async () => {
    await syncQueue();
    if (farmId) {
      await preloadAllData(farmId, isOnline);
    }
    toast({ title: "Refreshed", description: "Data synced successfully" });
  };

  const { containerRef, PullToRefreshIndicator } = usePullToRefresh({ onRefresh: handleRefresh });

  // Preload critical offline data whenever the active farm changes.
  useEffect(() => {
    if (farmId) {
      preloadAllData(farmId, isOnline);
    }
  }, [farmId, isOnline]);

  if (bootstrap.loading) {
    return <DashboardSkeleton />;
  }

  if (bootstrap.target === "auth") {
    return <Navigate to="/auth" replace />;
  }

  // A non-farm user (admin/government/merchant) deep-linked into the shell —
  // send them to their own portal; a user without any farm goes to setup.
  if (bootstrap.target && bootstrap.target !== "farmer" && bootstrap.target !== "farmhand") {
    return <Navigate to={roleTargetPath(bootstrap.target)} replace />;
  }

  if (!farmId) {
    return <Navigate to="/setup" replace />;
  }

  const context: FarmShellContext = {
    farmId,
    user: bootstrap.user,
    isFarmhand,
    canManageFarm,
    voiceTrainingCompleted: bootstrap.voiceTrainingCompleted,
  };

  // Focused flows (/animals/new, edit) render full-bleed with their own
  // page header — no nav/FAB/pull-to-refresh to interfere with the form.
  if (isFocusedRoute(pathname)) {
    return <Outlet context={context} />;
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background overflow-y-auto overflow-x-hidden max-w-full"
    >
      <PullToRefreshIndicator />
      <AppHeader pendingCount={badgeCount} />
      <OfflineOnboarding farmId={farmId} />
      <main className="container mx-auto px-4 py-4 sm:py-6 max-w-7xl pb-24 md:pb-safe">
        <Outlet context={context} />
      </main>
      <AppBottomNav pendingCount={badgeCount} />
      <FloatingDock />
    </div>
  );
}
