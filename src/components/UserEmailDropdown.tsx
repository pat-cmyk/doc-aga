import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole, type UserRole } from "@/hooks/useRole";
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
import { ChevronDown, User, LogOut, LayoutDashboard, Store, Shield, BarChart3, Settings } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const UserEmailDropdown = () => {
  const [userEmail, setUserEmail] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const { roles, isLoading } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || "");
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        
        if (profile?.full_name) {
          setFullName(profile.full_name);
        }
      }
    };
    
    fetchUserInfo();
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    if (role === 'admin') return 'destructive';
    if (role === 'government') return 'default';
    if (role === 'merchant') return 'default';
    if (role === 'farmhand') return 'outline';
    return 'secondary';
  };

  const getRoleLabel = (role: UserRole) => {
    if (role === 'government') return 'Government';
    if (role === 'farmhand') return 'Farmhand';
    if (role === 'farmer_owner') return 'Farm Owner';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  if (isLoading || !userEmail) {
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
          <ChevronDown className="h-3 w-3 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-background border-border z-50">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <p className="text-sm font-medium leading-none">{fullName || "User"}</p>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {userEmail}
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {roles.map((role) => (
                <Badge key={role} variant={getRoleBadgeVariant(role)} className="text-xs">
                  {getRoleLabel(role)}
                </Badge>
              ))}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {roles.includes("farmer_owner") || roles.includes("farmhand") ? (
          <DropdownMenuItem onClick={() => navigate("/")}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Farm Dashboard</span>
          </DropdownMenuItem>
        ) : null}
        
        {roles.includes("merchant") ? (
          <DropdownMenuItem onClick={() => navigate("/merchant")}>
            <Store className="mr-2 h-4 w-4" />
            <span>Merchant Portal</span>
          </DropdownMenuItem>
        ) : null}
        
        {roles.includes("government") && (
          <DropdownMenuItem onClick={() => navigate("/government")}>
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>Government Portal</span>
          </DropdownMenuItem>
        )}
        
        {roles.includes("admin") ? (
          <DropdownMenuItem onClick={() => navigate("/admin")}>
            <Shield className="mr-2 h-4 w-4" />
            <span>Admin Panel</span>
          </DropdownMenuItem>
        ) : null}
        
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
