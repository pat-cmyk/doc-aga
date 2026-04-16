import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFarm } from "./FarmContext";

// Type definitions
export type GlobalRole = "admin" | "merchant" | "distributor" | "government" | "cooperative";
export type FarmRoleInFarm = "farmer_owner" | "farmhand" | "vet";
export type UserRole = GlobalRole | FarmRoleInFarm;

const GLOBAL_ROLES: GlobalRole[] = ["admin", "merchant", "distributor", "government", "cooperative"];

// Offline permission cache (localStorage) — 7-day expiry matching OFFLINE_GRACE_PERIOD
const PERMISSIONS_CACHE_KEY = 'cached_permissions';
const PERMISSIONS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

interface CachedPermissions {
  allRoles: UserRole[];
  farmRoles: FarmRoleResult[];
  userId: string;
  cachedAt: number;
}

function getCachedPermissions(): CachedPermissions | null {
  try {
    const stored = localStorage.getItem(PERMISSIONS_CACHE_KEY);
    if (!stored) return null;
    const parsed: CachedPermissions = JSON.parse(stored);
    if (Date.now() - parsed.cachedAt > PERMISSIONS_CACHE_TTL) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setCachedPermissions(userId: string, allRoles: UserRole[], farmRoles: FarmRoleResult[]): void {
  try {
    localStorage.setItem(PERMISSIONS_CACHE_KEY, JSON.stringify({
      userId, allRoles, farmRoles, cachedAt: Date.now(),
    } satisfies CachedPermissions));
  } catch { /* localStorage full — non-critical */ }
}

interface FarmRoleResult {
  farmId: string;
  roleInFarm: FarmRoleInFarm;
  farmName: string;
  isOwner: boolean;
}

interface PermissionsContextType {
  // Loading state
  isLoading: boolean;

  // User info
  userId: string | null;

  // Global roles (from user_roles table)
  globalRoles: GlobalRole[];
  allRoles: UserRole[];
  isAdmin: boolean;
  isMerchant: boolean;
  isGovernment: boolean;
  isDistributor: boolean;
  hasGovernmentAccess: boolean;

  // Farm roles (from farm_memberships + ownership)
  farmRoles: FarmRoleResult[];
  currentFarmRole: FarmRoleResult | null;
  primaryFarmRole: FarmRoleResult | null;
  hasAnyOwnerRole: boolean;
  isOnlyFarmhand: boolean;
  hasFarmAccess: boolean;
  isFarmhand: boolean;

  // Farm-specific permissions (for current farm)
  isOwner: boolean;
  isManager: boolean;
  canManageTeam: boolean;
  canManageFarm: boolean;
  canAddAnimals: boolean;
  canEditAnimals: boolean;
  canDeleteAnimals: boolean;
  canViewAnimals: boolean;
  canCreateRecords: boolean;

  // Helpers
  hasRole: (role: UserRole) => boolean;
  hasGlobalRole: (role: GlobalRole) => boolean;
  hasOnlyGlobalRoles: boolean;
  isFarmer: boolean;

  // Actions
  refetch: () => Promise<void>;
}

const initialContextValue: PermissionsContextType = {
  isLoading: true,
  userId: null,
  globalRoles: [],
  allRoles: [],
  isAdmin: false,
  isMerchant: false,
  isGovernment: false,
  isDistributor: false,
  hasGovernmentAccess: false,
  farmRoles: [],
  currentFarmRole: null,
  primaryFarmRole: null,
  hasAnyOwnerRole: false,
  isOnlyFarmhand: false,
  hasFarmAccess: false,
  isFarmhand: false,
  isOwner: false,
  isManager: false,
  canManageTeam: false,
  canManageFarm: false,
  canAddAnimals: false,
  canEditAnimals: false,
  canDeleteAnimals: false,
  canViewAnimals: true,
  canCreateRecords: false,
  hasRole: () => false,
  hasGlobalRole: () => false,
  hasOnlyGlobalRoles: false,
  isFarmer: false,
  refetch: async () => {},
};

const PermissionsContext = createContext<PermissionsContextType>(initialContextValue);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { farmId } = useFarm();

  // Initialize from localStorage cache to avoid flash of empty permissions offline
  const cachedPerms = useMemo(() => getCachedPermissions(), []);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(cachedPerms?.userId ?? null);
  const [allRoles, setAllRoles] = useState<UserRole[]>(cachedPerms?.allRoles ?? []);
  const [farmRoles, setFarmRoles] = useState<FarmRoleResult[]>(cachedPerms?.farmRoles ?? []);

  // Track in-flight fetches so we can drop stale results when a newer fetch
  // (e.g. triggered by SIGNED_OUT) lands first. Without this, two parallel
  // fetches can overwrite each other in arbitrary order.
  const fetchSeqRef = useRef(0);
  // Tracks whether we've completed at least one fetch since the provider mounted.
  // Used to decide whether a refetch should silently revalidate (no spinner)
  // or block the UI with isLoading=true.
  const hasInitializedRef = useRef(false);
  // Track the last user id we observed so we can distinguish a real sign-in
  // (new user) from a Supabase-internal SIGNED_IN re-broadcast on tab focus
  // or cross-tab session sync (same user). Initialized from localStorage
  // cache so session recovery on cold load doesn't look like a new login.
  const lastUserIdRef = useRef<string | null>(cachedPerms?.userId ?? null);

  const arraysShallowEqual = <T,>(a: T[], b: T[], keyFn: (x: T) => string): boolean => {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    const aKeys = a.map(keyFn).sort();
    const bKeys = b.map(keyFn).sort();
    for (let i = 0; i < aKeys.length; i++) {
      if (aKeys[i] !== bKeys[i]) return false;
    }
    return true;
  };

  const fetchAllPermissions = useCallback(async (options?: { silent?: boolean }) => {
    const seq = ++fetchSeqRef.current;
    // Silent revalidation skips the loading flag so the UI doesn't blank out
    // when a background event (e.g. tab visibility change → TOKEN_REFRESHED)
    // triggers a refetch. Initial mount always blocks.
    const silent = options?.silent === true && hasInitializedRef.current;
    if (!silent) setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // If a newer fetch has started, discard this stale result entirely.
      if (seq !== fetchSeqRef.current) return;

      if (!user) {
        setUserId(null);
        setAllRoles([]);
        setFarmRoles([]);
        lastUserIdRef.current = null;
        try { localStorage.removeItem(PERMISSIONS_CACHE_KEY); } catch { /* ignore */ }
        return;
      }

      setUserId(user.id);
      lastUserIdRef.current = user.id;

      // Fetch all permission data in parallel
      const [rolesResult, membershipsResult, ownedFarmsResult] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase
          .from("farm_memberships")
          .select(`
            farm_id,
            role_in_farm,
            farms!inner (
              id,
              name,
              owner_id
            )
          `)
          .eq("user_id", user.id)
          .eq("invitation_status", "accepted"),
        supabase
          .from("farms")
          .select("id, name, owner_id")
          .eq("owner_id", user.id)
          .eq("is_deleted", false),
      ]);

      // If a newer fetch has started, discard this stale result entirely.
      if (seq !== fetchSeqRef.current) return;

      // Process user roles
      const roles = (rolesResult.data || []).map(r => r.role as UserRole);

      // Process farm roles
      const processedFarmRoles: FarmRoleResult[] = [];
      const memberships = membershipsResult.data || [];
      const ownedFarms = ownedFarmsResult.data || [];

      // Add owned farms first
      for (const farm of ownedFarms) {
        const existingMembership = memberships.find(m => m.farm_id === farm.id);
        if (!existingMembership) {
          processedFarmRoles.push({
            farmId: farm.id,
            roleInFarm: "farmer_owner",
            farmName: farm.name,
            isOwner: true,
          });
        }
      }

      // Add memberships
      for (const membership of memberships) {
        const farm = membership.farms as unknown as { id: string; name: string; owner_id: string };
        processedFarmRoles.push({
          farmId: membership.farm_id,
          roleInFarm: membership.role_in_farm as FarmRoleInFarm,
          farmName: farm.name,
          isOwner: farm.owner_id === user.id,
        });
      }

      // Only update state if data actually changed. This prevents downstream
      // re-renders during silent revalidation when nothing has changed,
      // which is the common case for TOKEN_REFRESHED on tab focus.
      setAllRoles(prev => arraysShallowEqual(prev, roles, r => r) ? prev : roles);
      setFarmRoles(prev =>
        arraysShallowEqual(
          prev,
          processedFarmRoles,
          r => `${r.farmId}|${r.roleInFarm}|${r.isOwner ? '1' : '0'}|${r.farmName}`,
        ) ? prev : processedFarmRoles
      );

      // Cache for offline fallback
      setCachedPermissions(user.id, roles, processedFarmRoles);
    } catch (error) {
      // Drop stale errors too.
      if (seq !== fetchSeqRef.current) return;
      console.error("Error fetching permissions:", error);
      // Offline fallback: restore from cached permissions instead of clearing
      const cached = getCachedPermissions();
      if (cached) {
        console.log('[Permissions] Using cached permissions (offline fallback)');
        setUserId(cached.userId);
        setAllRoles(cached.allRoles);
        setFarmRoles(cached.farmRoles);
      }
      // If no cache, keep whatever state we already have (may be from initial cache load)
    } finally {
      if (seq === fetchSeqRef.current) {
        hasInitializedRef.current = true;
        if (!silent) setIsLoading(false);
      }
    }
  }, []);

  // Subscribe to auth state changes
  useEffect(() => {
    fetchAllPermissions();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id ?? null;
      const userChanged = newUserId !== lastUserIdRef.current;

      // SIGNED_OUT: blocking refetch so UI gates immediately.
      // SIGNED_IN with new user: blocking refetch (real login).
      // SIGNED_IN with same user: silent revalidation — Supabase re-emits
      //   SIGNED_IN on tab focus / cross-tab sync; do not blank the UI.
      // TOKEN_REFRESHED / USER_UPDATED: silent revalidation.
      // INITIAL_SESSION: ignored — initial fetch already runs above.
      if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && userChanged)) {
        lastUserIdRef.current = newUserId;
        fetchAllPermissions();
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        lastUserIdRef.current = newUserId;
        fetchAllPermissions({ silent: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchAllPermissions]);

  // Derived global role states
  const globalRoles = useMemo(() => 
    allRoles.filter(role => GLOBAL_ROLES.includes(role as GlobalRole)) as GlobalRole[],
    [allRoles]
  );

  const isAdmin = useMemo(() => allRoles.includes("admin"), [allRoles]);
  const isMerchant = useMemo(() => allRoles.includes("merchant"), [allRoles]);
  const isGovernment = useMemo(() => allRoles.includes("government"), [allRoles]);
  const isDistributor = useMemo(() => allRoles.includes("distributor"), [allRoles]);
  const hasGovernmentAccess = isGovernment;
  const isFarmer = useMemo(() => 
    allRoles.includes("farmer_owner") || allRoles.includes("farmhand"),
    [allRoles]
  );
  const hasOnlyGlobalRoles = useMemo(() => 
    allRoles.every(role => GLOBAL_ROLES.includes(role as GlobalRole)),
    [allRoles]
  );

  // Derived farm role states
  const primaryFarmRole = useMemo(() => 
    farmRoles.length > 0 ? farmRoles[0] : null,
    [farmRoles]
  );

  const currentFarmRole = useMemo(() => 
    farmRoles.find(r => r.farmId === farmId) || null,
    [farmRoles, farmId]
  );

  const hasAnyOwnerRole = useMemo(() => 
    farmRoles.some(r => r.isOwner || r.roleInFarm === "farmer_owner"),
    [farmRoles]
  );

  const isOnlyFarmhand = useMemo(() => 
    farmRoles.length > 0 && farmRoles.every(r => r.roleInFarm === "farmhand" && !r.isOwner),
    [farmRoles]
  );

  const hasFarmAccess = useMemo(() => farmRoles.length > 0, [farmRoles]);
  
  const isFarmhand = useMemo(() => 
    currentFarmRole?.roleInFarm === "farmhand",
    [currentFarmRole]
  );

  // Farm-specific permissions (for current farm)
  const farmPermissions = useMemo(() => {
    const isOwner = currentFarmRole?.isOwner ?? false;
    const isManager = currentFarmRole?.roleInFarm === "farmer_owner";
    const isFarmhandRole = currentFarmRole?.roleInFarm === "farmhand";

    return {
      isOwner,
      isManager,
      canManageTeam: isOwner || isAdmin,
      canManageFarm: isOwner || isManager || isAdmin,
      canAddAnimals: isOwner || isManager || isAdmin,
      canEditAnimals: isOwner || isManager || isAdmin,
      canDeleteAnimals: isOwner || isAdmin,
      canViewAnimals: true,
      canCreateRecords: isOwner || isManager || isFarmhandRole || isAdmin,
    };
  }, [currentFarmRole, isAdmin]);

  // Helper functions
  const hasRole = useCallback((role: UserRole) => allRoles.includes(role), [allRoles]);
  const hasGlobalRole = useCallback((role: GlobalRole) => globalRoles.includes(role), [globalRoles]);

  const contextValue = useMemo<PermissionsContextType>(() => ({
    isLoading,
    userId,
    globalRoles,
    allRoles,
    isAdmin,
    isMerchant,
    isGovernment,
    isDistributor,
    hasGovernmentAccess,
    farmRoles,
    currentFarmRole,
    primaryFarmRole,
    hasAnyOwnerRole,
    isOnlyFarmhand,
    hasFarmAccess,
    isFarmhand,
    ...farmPermissions,
    hasRole,
    hasGlobalRole,
    hasOnlyGlobalRoles,
    isFarmer,
    refetch: fetchAllPermissions,
  }), [
    isLoading,
    userId,
    globalRoles,
    allRoles,
    isAdmin,
    isMerchant,
    isGovernment,
    isDistributor,
    hasGovernmentAccess,
    farmRoles,
    currentFarmRole,
    primaryFarmRole,
    hasAnyOwnerRole,
    isOnlyFarmhand,
    hasFarmAccess,
    isFarmhand,
    farmPermissions,
    hasRole,
    hasGlobalRole,
    hasOnlyGlobalRoles,
    isFarmer,
    fetchAllPermissions,
  ]);

  return (
    <PermissionsContext.Provider value={contextValue}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function useUnifiedPermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('useUnifiedPermissions must be used within PermissionsProvider');
  }
  return context;
}

// Backward-compatible alias
export const usePermissionsContext = useUnifiedPermissions;
