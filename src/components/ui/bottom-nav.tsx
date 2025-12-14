import { cn } from "@/lib/utils";
import { Home, Beef, Settings2, Wallet, MoreHorizontal } from "lucide-react";
import { hapticImpact } from "@/lib/haptics";
import { Badge } from "@/components/ui/badge";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingCount?: number;
  disabled?: boolean;
}

const navItems = [
  { id: "dashboard", icon: Home, label: "Home" },
  { id: "animals", icon: Beef, label: "Animals" },
  { id: "operations", icon: Settings2, label: "Ops" },
  { id: "finance", icon: Wallet, label: "Money" },
  { id: "more", icon: MoreHorizontal, label: "More" },
];

export function BottomNav({ activeTab, onTabChange, pendingCount = 0, disabled = false }: BottomNavProps) {
  const handleTabChange = (tabId: string) => {
    if (disabled) return;
    hapticImpact("light");
    onTabChange(tabId);
  };

  return (
    <nav 
      role="navigation" 
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border pb-safe"
    >
      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-card via-card to-card/95 backdrop-blur-md" />
      
      <div className="relative flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          const showBadge = item.id === "more" && pendingCount > 0;

          return (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              disabled={disabled}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-16 h-14 rounded-xl",
                "transition-colors duration-200 touch-manipulation",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground active:scale-95",
                disabled && "opacity-50 cursor-not-allowed pointer-events-none"
              )}
            >
              <div className="relative">
                <div
                  className={cn(
                    "p-1.5 rounded-lg transition-all duration-200",
                    isActive && "bg-primary/10 animate-scale-in shadow-sm"
                  )}
                >
                  <Icon 
                    className={cn(
                      "h-5 w-5 transition-all duration-200",
                      isActive && "stroke-[2.5]"
                    )} 
                  />
                </div>
                {showBadge && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] animate-scale-in"
                  >
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </Badge>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium",
                  isActive 
                    ? "opacity-100 animate-slide-up" 
                    : "opacity-0 h-0 overflow-hidden"
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
