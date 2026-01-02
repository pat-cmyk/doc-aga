import { cn } from "@/lib/utils";
import { DocAgaLogo } from "@/components/DocAgaLogo";

interface LoadingScreenProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { logo: "md" as const, text: "text-sm" },
  md: { logo: "lg" as const, text: "text-base" },
  lg: { logo: "xl" as const, text: "text-lg" },
};

export const LoadingScreen = ({ 
  message = "Loading...",
  size = "md",
  fullScreen = true,
  className
}: LoadingScreenProps) => {
  const config = sizeConfig[size];
  
  return (
    <div 
      className={cn(
        "flex items-center justify-center",
        fullScreen && "min-h-screen",
        className
      )}
    >
      <div className="text-center space-y-4">
        <DocAgaLogo 
          size={config.logo} 
          className="animate-pulse mx-auto" 
        />
        {message && (
          <p className={cn("text-muted-foreground", config.text)}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
};
