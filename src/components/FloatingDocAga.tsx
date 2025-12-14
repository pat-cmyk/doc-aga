import { useState, useEffect, lazy, Suspense } from "react";
import { Stethoscope, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { shouldShowTooltip, incrementTooltipView, shouldShowOnboarding, completeOnboarding } from "@/lib/localStorage";

// Lazy load DocAga only when chat is opened to reduce initial bundle
const DocAga = lazy(() => import("./DocAga"));

export function FloatingDocAga() {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  useEffect(() => {
    // Check if tooltip should be shown
    setShowTooltip(shouldShowTooltip());
    
    // Check if onboarding should be shown
    setShowOnboarding(shouldShowOnboarding());
  }, []);

  useEffect(() => {
    if (showTooltip && !isOpen) {
      // Increment view count after showing
      const timer = setTimeout(() => {
        incrementTooltipView();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showTooltip, isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    setShowTooltip(false);
    
    // Show onboarding if it's the first time
    if (showOnboarding) {
      setOnboardingStep(0);
    }
  };

  const handleOnboardingNext = () => {
    if (onboardingStep < 2) {
      setOnboardingStep(onboardingStep + 1);
    } else {
      setShowOnboarding(false);
      completeOnboarding();
    }
  };

  const handleOnboardingSkip = () => {
    setShowOnboarding(false);
    completeOnboarding();
  };

  const onboardingContent = [
    {
      title: "Welcome to Doc Aga! 🩺",
      description: "Ask questions or give instructions in Tagalog or English"
    },
    {
      title: "Multiple Input Methods 🎤",
      description: "Use voice, text, or upload images to communicate"
    },
    {
      title: "Farm Data Access 📊",
      description: "I can access your farm data and help you log activities"
    }
  ];

  return (
    <>
      {/* Floating Button with Tooltip */}
      <TooltipProvider>
        <Tooltip open={showTooltip && !isOpen}>
          <TooltipTrigger asChild>
            <Button
              onClick={handleOpen}
              className={cn(
                "fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-50",
                "h-16 w-16 sm:h-18 sm:w-18 rounded-full shadow-lg",
                "transition-all duration-300 hover:scale-110",
                "bg-primary hover:bg-primary/90",
                "animate-[pulse_2s_ease-in-out_3]",
                isOpen && "scale-0 opacity-0"
              )}
              size="icon"
            >
              <Stethoscope className="h-7 w-7 sm:h-8 sm:w-8" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[200px] text-center">
            <p className="font-medium">🎤 Voice, 💬 Chat, or 📸 Image</p>
            <p className="text-xs text-muted-foreground mt-1">with Doc Aga</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Onboarding Overlay */}
      {isOpen && showOnboarding && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4">
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold">
                {onboardingContent[onboardingStep].title}
              </h3>
              <p className="text-muted-foreground">
                {onboardingContent[onboardingStep].description}
              </p>
            </div>
            <div className="flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-2 w-2 rounded-full transition-all",
                    i === onboardingStep ? "bg-primary w-6" : "bg-muted"
                  )}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleOnboardingSkip}
                className="flex-1"
              >
                Skip
              </Button>
              <Button onClick={handleOnboardingNext} className="flex-1">
                {onboardingStep === 2 ? "Got it!" : "Next"}
              </Button>
            </div>
          </Card>
        </div>
      )}

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

        {/* Chat Content - lazy loaded */}
        <div className="flex-1 overflow-hidden">
          {isOpen && (
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-muted-foreground">Loading Doc Aga...</div>
              </div>
            }>
              <DocAga />
            </Suspense>
          )}
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
