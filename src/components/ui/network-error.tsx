import { WifiOff, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface NetworkErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  variant?: "network" | "auth" | "generic";
  className?: string;
}

const errorConfig = {
  network: {
    icon: WifiOff,
    defaultTitle: "Connection Problem",
    defaultMessage: "Hindi ma-load ang data. Subukan ulit. (Unable to load data. Please try again.)",
  },
  auth: {
    icon: AlertCircle,
    defaultTitle: "Authentication Error",
    defaultMessage: "Please sign in again to continue.",
  },
  generic: {
    icon: AlertCircle,
    defaultTitle: "Something Went Wrong",
    defaultMessage: "May problema sa pag-load. Subukan ulit. (There was a problem loading. Please try again.)",
  },
};

export function NetworkError({
  title,
  message,
  onRetry,
  isRetrying = false,
  variant = "network",
  className,
}: NetworkErrorProps) {
  const config = errorConfig[variant];
  const Icon = config.icon;

  return (
    <Card className={cn("border-destructive/50 bg-destructive/5", className)}>
      <CardContent className="flex flex-col items-center justify-center py-8 px-4 text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <Icon className="h-6 w-6 text-destructive" />
        </div>
        
        <div className="space-y-2">
          <h3 className="font-semibold text-foreground">
            {title || config.defaultTitle}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {message || config.defaultMessage}
          </p>
        </div>

        {onRetry && (
          <Button
            variant="outline"
            onClick={onRetry}
            disabled={isRetrying}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isRetrying && "animate-spin")} />
            {isRetrying ? "Retrying..." : "Try Again"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
