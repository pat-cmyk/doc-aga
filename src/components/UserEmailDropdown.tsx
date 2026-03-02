import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUnifiedPermissions } from "@/contexts/PermissionsContext";
import { getCachedUserProfile, setCachedUserProfile } from "@/lib/localStorage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, LogOut, LayoutDashboard, Store, Shield, BarChart3, Settings } from "lucide-react";
import { showErrorToast } from "@/lib/errorHandling";

export const UserEmailDropdown = () => {
  // Load from localStorage cache immediately for instant render
  const cachedProfile = getCachedUserProfile();
  const [userEmail, setUserEmail] = useState<string>(cachedProfile?.email || "");
  const [fullName, setFullName] = useState<string>(cachedProfile?.fullName || "");
  const { globalRoles, primaryFarmRole, hasAnyOwnerRole, isOnlyFarmhand, isLoading } = useUnifiedPermissions();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserInfo = async () => {
      // If offline and we have cached data, skip fetch
      if (!navigator.onLine && cachedProfile) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const email = user.email || "";
          setUserEmail(email);
          
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single();
          
          const name = profile?.full_name || "";
          if (name) setFullName(name);

          // Update cache for offline use
          setCachedUserProfile(email, name);
        }
      } catch (error) {
        // Offline or network error — keep cached values
        console.warn('[UserEmailDropdown] Failed to fetch profile, using cache:', error);
      }
    };
    
    fetchUserInfo();
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showErrorToast(error, "signing out");
    } else {
      navigate("/auth");
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    if (role === 'admin') return 'destructive';
    if (role === 'government') return 'default';
    if (role === 'merchant') return 'default';
    if (role === 'farmhand') return 'outline';
    return 'secondary';
  };

  const getRoleLabel = (role: string) => {
    if (role === 'government') return 'Government';
    if (role === 'farmhand') return 'Farmhand';
    if (role === 'farmer_owner') return 'Farm Owner';
    if (role === 'admin') return 'Admin';
    if (role === 'merchant') return 'Merchant';
    if (role === 'distributor') return 'Distributor';
    if (role === 'vet') return 'Veterinarian';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  // Combine global roles with farm-specific role for display
  const displayRoles: string[] = [...globalRoles];
  if (primaryFarmRole) {
    displayRoles.push(primaryFarmRole.roleInFarm);
  }

  // Show cached data even when permissions are loading; only show loading if no data at all
  const hasProfileData = !!userEmail || !!cachedProfile;
  if (isLoading && !hasProfileData) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <User className="h-4 w-4 mr-2" />
        Loading...
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9">
          <User className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-background border-border z-50">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <p className="text-sm font-medium leading-none">{fullName || "User"}</p>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {userEmail || "Offline"}
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {displayRoles.map((role) => (
                <Badge key={role} variant={getRoleBadgeVariant(role)} className="text-xs">
                  {getRoleLabel(role)}
                </Badge>
              ))}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Show Farm Dashboard for farm owners/managers */}
        {hasAnyOwnerRole && (
          <DropdownMenuItem onClick={() => navigate("/")}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Farm Dashboard</span>
          </DropdownMenuItem>
        )}
        
        {/* Show Farmhand Dashboard for farmhands */}
        {isOnlyFarmhand && (
          <DropdownMenuItem onClick={() => navigate("/farmhand")}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Farmhand Dashboard</span>
          </DropdownMenuItem>
        )}
        
        {globalRoles.includes("merchant") && (
          <DropdownMenuItem onClick={() => navigate("/merchant")}>
            <Store className="mr-2 h-4 w-4" />
            <span>Merchant Portal</span>
          </DropdownMenuItem>
        )}
        
        {globalRoles.includes("government") && (
          <DropdownMenuItem onClick={() => navigate("/government")}>
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>Government Portal</span>
          </DropdownMenuItem>
        )}
        
        {globalRoles.includes("admin") && (
          <DropdownMenuItem onClick={() => navigate("/admin")}>
            <Shield className="mr-2 h-4 w-4" />
            <span>Admin Panel</span>
          </DropdownMenuItem>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/profile")}>
          <Settings className="mr-2 h-4 w-4" />
          <span>My Profile</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
