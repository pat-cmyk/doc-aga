import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { 
  CheckCheck, 
  Download, 
  Wifi, 
  WifiOff, 
  MessageSquare, 
  Bell,
  AlertCircle,
  Trash2
} from "lucide-react";
import { useFarm } from "@/contexts/FarmContext";
import { useUnifiedPermissions } from "@/contexts/PermissionsContext";

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "cache_success":
      return <Download className="h-4 w-4 text-green-500" />;
    case "cache_failed":
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    case "sync_success":
      return <Wifi className="h-4 w-4 text-green-500" />;
    case "sync_failed":
      return <WifiOff className="h-4 w-4 text-destructive" />;
    case "feedback_response":
      return <MessageSquare className="h-4 w-4 text-primary" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
};

export const NotificationDropdown = () => {
  const { farmId } = useFarm();
  const { isAdmin, hasGovernmentAccess } = useUnifiedPermissions();
  
  // Admin/government users see all notifications, others see farm-scoped
  const { notifications, markAsRead, markAllAsRead, clearAll } = useNotifications(farmId, { 
    showAll: isAdmin || hasGovernmentAccess 
  });

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Notifications</h3>
        <div className="flex gap-1">
          {notifications.some((n) => !n.read) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead()}
              className="h-8 text-xs"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => clearAll()}
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="h-[300px]">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-accent cursor-pointer transition-colors ${
                  !notification.read ? "bg-accent/50" : ""
                }`}
                onClick={() => {
                  if (!notification.read) {
                    markAsRead(notification.id);
                  }
                }}
              >
                <div className="flex gap-3">
                  <div className="mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    {notification.title && (
                      <p className="font-medium text-sm mb-0.5">
                        {notification.title}
                      </p>
                    )}
                    {notification.body && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {notification.body}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
