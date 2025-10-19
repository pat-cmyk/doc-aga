import { useState } from "react";
import { Stethoscope, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import DocAga from "./DocAga";
import { cn } from "@/lib/utils";

export function FloatingDocAga() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50",
          "h-14 w-14 sm:h-16 sm:w-16 rounded-full shadow-lg",
          "transition-all duration-300 hover:scale-110",
          "bg-primary hover:bg-primary/90",
          isOpen && "scale-0 opacity-0"
        )}
        size="icon"
      >
        <Stethoscope className="h-6 w-6 sm:h-7 sm:w-7" />
      </Button>

      {/* Floating Chat Interface */}
      <Card
        className={cn(
          "fixed z-50 flex flex-col shadow-2xl transition-all duration-300",
          // Mobile: Full screen
          "inset-0 rounded-none",
          // Desktop: Floating bottom-right
          "sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[450px] sm:h-[650px] sm:rounded-lg",
          "lg:w-[500px] lg:h-[700px]",
          isOpen ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-3 sm:p-4 bg-primary text-primary-foreground rounded-t-none sm:rounded-t-lg">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            <h2 className="font-semibold text-base sm:text-lg">Doc Aga</h2>
          </div>
          <Button
            onClick={() => setIsOpen(false)}
            variant="ghost"
            size="icon"
            className="h-10 w-10 sm:h-8 sm:w-8 text-primary-foreground hover:bg-primary-foreground/20"
          >
            <X className="h-5 w-5 sm:h-4 sm:w-4" />
          </Button>
        </div>

        {/* Chat Content */}
        <div className="flex-1 overflow-hidden">
          <DocAga />
        </div>
      </Card>

      {/* Desktop backdrop only */}
      {isOpen && (
        <div
          className="hidden sm:block fixed inset-0 bg-background/20 backdrop-blur-[2px] z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
