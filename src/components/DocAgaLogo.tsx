import { cn } from "@/lib/utils";
import docAgaLogo from "@/assets/doc-aga-logo.png";

interface DocAgaLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  className?: string;
  rounded?: boolean;
}

const sizeMap = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-16 w-16",
  xl: "h-24 w-24",
};

export const DocAgaLogo = ({ 
  size = "md", 
  className,
  rounded = true 
}: DocAgaLogoProps) => {
  const sizeClass = typeof size === "number" 
    ? undefined 
    : sizeMap[size];
  
  const sizeStyle = typeof size === "number" 
    ? { width: size, height: size } 
    : undefined;

  return (
    <div 
      className={cn(
        "overflow-hidden shrink-0",
        rounded && "rounded-full",
        sizeClass,
        className
      )}
      style={sizeStyle}
    >
      <img 
        src={docAgaLogo} 
        alt="Doc Aga Logo" 
        className="h-full w-full object-cover"
      />
    </div>
  );
};
