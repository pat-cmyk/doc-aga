import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationDropdown } from "./NotificationDropdown";
import { useFarm } from "@/contexts/FarmContext";
import { useUnifiedPermissions } from "@/contexts/PermissionsContext";

export const NotificationBell = () => {
  const { farmId } = useFarm();
  const { isAdmin, hasGovernmentAccess } = useUnifiedPermissions();
  
  // Admin/government users see all notifications, others see farm-scoped
  const { unreadCount } = useNotifications(farmId, { 
    showAll: isAdmin || hasGovernmentAccess 
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9 relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <NotificationDropdown />
      </PopoverContent>
    </Popover>
  );
};
