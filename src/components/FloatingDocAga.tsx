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
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg",
          "transition-all duration-300 hover:scale-110",
          "bg-primary hover:bg-primary/90",
          isOpen && "scale-0 opacity-0"
        )}
        size="icon"
      >
        <Stethoscope className="h-6 w-6" />
      </Button>

      {/* Floating Chat Interface */}
      <Card
        className={cn(
          "fixed bottom-6 right-6 z-50 flex flex-col",
          "w-[400px] h-[600px] shadow-2xl transition-all duration-300",
          "md:w-[450px] md:h-[650px]",
          isOpen ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 bg-primary text-primary-foreground rounded-t-lg">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            <h2 className="font-semibold">Doc Aga</h2>
          </div>
          <Button
            onClick={() => setIsOpen(false)}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Chat Content */}
        <div className="flex-1 overflow-hidden">
          <DocAga />
        </div>
      </Card>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
