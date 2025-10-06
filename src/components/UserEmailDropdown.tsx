import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
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
import { ChevronDown, User, LogOut, LayoutDashboard, Store, Shield } from "lucide-react";
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

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "merchant":
        return "default";
      default:
        return "secondary";
    }
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
        <Button variant="outline" size="sm" className="gap-2">
          <User className="h-4 w-4" />
          <span className="max-w-[150px] truncate">{userEmail}</span>
          <ChevronDown className="h-4 w-4" />
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
                  {role.replace("_", " ")}
                </Badge>
              ))}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {roles.includes("farmer_owner") || roles.includes("farmer_staff") ? (
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
        
        {roles.includes("admin") ? (
          <DropdownMenuItem onClick={() => navigate("/admin")}>
            <Shield className="mr-2 h-4 w-4" />
            <span>Admin Panel</span>
          </DropdownMenuItem>
        ) : null}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
