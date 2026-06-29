import { useUnifiedPermissions } from "@/contexts/PermissionsContext";

/**
 * Returns whether the current user has the `government` global role.
 *
 * This used to be a standalone hook that issued its own `user_roles` query
 * on every mount. That meant every remount of `GovernmentDashboard` (e.g.
 * triggered by a permissions reload on tab focus) re-ran the query and
 * showed the "verifying access" spinner. It is now a thin wrapper over
 * `useUnifiedPermissions` (the SSOT for roles), so access state is shared
 * with the rest of the app and never re-queried for this hook alone.
 *
 * The tri-state contract (`null | boolean`) is preserved on purpose:
 * - `null` while permissions are still loading (so callers don't trigger
 *   redirects or disable downstream queries prematurely)
 * - `true` / `false` once permissions are resolved
 */
export const useGovernmentAccess = () => {
  const { hasGovernmentAccess, isLoading } = useUnifiedPermissions();
  return {
    hasAccess: isLoading ? null : hasGovernmentAccess,
    isLoading,
  };
};
