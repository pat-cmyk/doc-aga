import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StageBadgeProps {
  stage: string;
  definition: string;
  colorClass: string;
}

export function StageBadge({ stage, definition, colorClass }: StageBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Handle click for mobile devices
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          <Badge 
            className={`${colorClass} text-xs font-medium border-0 cursor-pointer select-none`}
            onClick={handleClick}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
          >
            {stage}
          </Badge>
        </TooltipTrigger>
        <TooltipContent 
          className="bg-black/80 text-white max-w-xs z-50"
          onPointerDownOutside={() => setIsOpen(false)}
        >
          <p>{definition}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}