/**
 * Role landing at "/" (UX redesign Phase 2).
 *
 * Replaces the old pages/Dashboard.tsx double duty of auth-gate + role router.
 * Resolves the session's role target and redirects to the right surface,
 * mapping legacy pre-shell URLs (/?tab=..., /?animalId=...) onto the new
 * route tree first — those URLs live on in notifications and bookmarks.
 */
import { Navigate, useLocation } from "react-router-dom";
import { useFarmBootstrap } from "@/hooks/useFarmBootstrap";
import { mapLegacyDashboardUrl } from "@/lib/legacyRedirects";
import { roleTargetPath } from "@/lib/roleResolution";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

export function RoleLanding() {
  const location = useLocation();
  const bootstrap = useFarmBootstrap();

  if (bootstrap.loading) {
    return <DashboardSkeleton />;
  }

  if (bootstrap.target === "auth" || bootstrap.target === null) {
    return <Navigate to="/auth" replace />;
  }

  // Legacy deep links only make sense inside the farm shell.
  if (bootstrap.target === "farmer" || bootstrap.target === "farmhand") {
    const legacy = mapLegacyDashboardUrl(location.search);
    if (legacy) {
      return <Navigate to={legacy} replace />;
    }
  }

  return <Navigate to={roleTargetPath(bootstrap.target)} replace />;
}
