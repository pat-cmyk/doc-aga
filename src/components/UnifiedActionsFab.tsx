import { useState, useEffect, useRef, lazy, Suspense, useMemo } from "react";
import { Stethoscope, X, Milk, Heart, PawPrint, Wheat, Scale, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { shouldShowTooltip, incrementTooltipView, shouldShowOnboarding, completeOnboarding } from "@/lib/localStorage";
import { RecordBulkMilkDialog } from "@/components/milk-recording/RecordBulkMilkDialog";
import { RecordBulkFeedDialog } from "@/components/feed-recording/RecordBulkFeedDialog";
import { RecordBulkHealthDialog } from "@/components/health-recording/RecordBulkHealthDialog";
import { RecordBulkBCSDialog } from "@/components/body-condition/RecordBulkBCSDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import AnimalForm from "@/components/AnimalForm";
import { useFarm } from "@/contexts/FarmContext";
import { useUnifiedPermissions } from "@/contexts/PermissionsContext";
import { useQueueStatus } from "@/hooks/useQueueStatus";
import { useToast } from "@/hooks/use-toast";
import { onQueueCapacityWarning } from "@/lib/offlineQueue";

// Lazy load DocAga only when chat is opened to reduce initial bundle
const DocAga = lazy(() => import("./DocAga"));

interface UnifiedActionsFabProps {
  onRecordMilk?: () => void;
  onRecordHealth?: () => void;
  onAddAnimal?: () => void;
  onRecordFeed?: () => void;
  onRecordBCS?: () => void;
}

const quickActions = [
  { id: 'doc-aga', label: 'Ask Doc Aga', icon: Stethoscope, color: 'bg-primary text-primary-foreground', isPrimary: true },
  { id: 'milk', label: 'Record Milk', icon: Milk, color: 'text-blue-500' },
  { id: 'feed', label: 'Record Feed', icon: Wheat, color: 'text-orange-500' },
  { id: 'health', label: 'Record Health', icon: Heart, color: 'text-red-500' },
  { id: 'bcs', label: 'Record BCS', icon: Scale, color: 'text-purple-500' },
  { id: 'add-animal', label: 'Add Animal', icon: PawPrint, color: 'text-green-500' },
];

export function UnifiedActionsFab({ 
  onRecordMilk, 
  onRecordHealth, 
  onAddAnimal,
  onRecordFeed,
  onRecordBCS
}: UnifiedActionsFabProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDocAgaOpen, setIsDocAgaOpen] = useState(false);
  const [isRecordMilkOpen, setIsRecordMilkOpen] = useState(false);
  const [isRecordFeedOpen, setIsRecordFeedOpen] = useState(false);
  const [isRecordHealthOpen, setIsRecordHealthOpen] = useState(false);
  const [isRecordBCSOpen, setIsRecordBCSOpen] = useState(false);
  const [isAddAnimalOpen, setIsAddAnimalOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get current farm ID from context
  const { farmId } = useFarm();
  const { toast } = useToast();
  
  // Get queue status for failed sync indicator
  const { counts: queueCounts, hasIssues: hasQueueIssues } = useQueueStatus();
  
  // Get permissions from unified context
  const { canAddAnimals, canCreateRecords, hasFarmAccess, isLoading: permissionsLoading } = useUnifiedPermissions();
  
  // Subscribe to queue capacity warnings
  useEffect(() => {
    const unsubscribe = onQueueCapacityWarning((current, max) => {
      hapticNotification('warning');
      toast({
        title: "Offline Queue Nearing Capacity",
        description: `${current}/${max} items queued. Oldest entries will be removed to make room for new ones.`,
        variant: "destructive",
      });
    });
    return unsubscribe;
  }, [toast]);

  // Filter quick actions based on permissions
  const filteredQuickActions = useMemo(() => {
    // While loading, show all actions to prevent flicker
    if (permissionsLoading) return quickActions;
    
    return quickActions.filter(action => {
      // Doc Aga is available to all farm roles
      if (action.id === 'doc-aga') return true;
      
      // Add Animal only for those with permission (owners, managers, admins)
      if (action.id === 'add-animal') return canAddAnimals;
      
      // Recording actions for all farm members with record permission
      if (['milk', 'feed', 'health', 'bcs'].includes(action.id)) return canCreateRecords;
      
      return true;
    });
  }, [canAddAnimals, canCreateRecords, permissionsLoading]);

  useEffect(() => {
    // Check if onboarding should be shown when Doc Aga opens
    setShowOnboarding(shouldShowOnboarding());
  }, []);

  // Increment tooltip view after showing
  useEffect(() => {
    if (shouldShowTooltip() && !isExpanded && !isDocAgaOpen) {
      const timer = setTimeout(() => {
        incrementTooltipView();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isExpanded, isDocAgaOpen]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  const handleToggle = () => {
    hapticImpact('light');
    setIsExpanded(!isExpanded);
  };

  const handleAction = (actionId: string) => {
    hapticImpact('medium');
    setIsExpanded(false);
    
    // Doc Aga doesn't require farmId
    if (actionId === 'doc-aga') {
      setIsDocAgaOpen(true);
      if (showOnboarding) {
        setOnboardingStep(0);
      }
      return;
    }
    
    // All other actions require a farm to be selected
    if (!farmId) {
      hapticNotification('error');
      toast({
        title: "No Farm Selected",
        description: "Please select a farm first before recording data.",
        variant: "destructive",
      });
      return;
    }
    
    switch (actionId) {
      case 'milk':
        if (onRecordMilk) {
          onRecordMilk();
        } else {
          setIsRecordMilkOpen(true);
        }
        break;
      case 'health':
        if (onRecordHealth) {
          onRecordHealth();
        } else {
          setIsRecordHealthOpen(true);
        }
        break;
      case 'add-animal':
        if (onAddAnimal) {
          onAddAnimal();
        } else {
          setIsAddAnimalOpen(true);
        }
        break;
      case 'feed':
        if (onRecordFeed) {
          onRecordFeed();
        } else {
          setIsRecordFeedOpen(true);
        }
        break;
      case 'bcs':
        if (onRecordBCS) {
          onRecordBCS();
        } else {
          setIsRecordBCSOpen(true);
        }
        break;
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
      {/* FAB Container */}
      <div 
        ref={containerRef}
        className="fixed bottom-24 right-2 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end"
      >
        {/* Action buttons - Only render when expanded to prevent click blocking */}
        {isExpanded && (
          <div className="flex flex-col-reverse items-end gap-2 mb-3">
            {filteredQuickActions.map((action, index) => (
              <Button
                key={action.id}
                onClick={() => handleAction(action.id)}
                variant={action.isPrimary ? "default" : "secondary"}
                className={cn(
                  "h-12 gap-2 shadow-lg justify-start pl-3 pr-4 min-w-[160px] animate-slide-up",
                  action.isPrimary && "bg-primary hover:bg-primary/90"
                )}
                style={{
                  animationDelay: `${index * 50}ms`,
                  animationFillMode: 'backwards'
                }}
              >
                <action.icon className={cn("h-4 w-4", !action.isPrimary && action.color)} />
                <span className="text-sm font-medium">{action.label}</span>
              </Button>
            ))}
          </div>
        )}

        {/* Main FAB button */}
        <div className="relative">
          <Button
            onClick={handleToggle}
            size="lg"
            className={cn(
              "h-16 w-16 rounded-full shadow-lg",
              "bg-primary hover:bg-primary/90",
              "transition-transform duration-200",
              isExpanded ? "rotate-45" : "rotate-0",
              (isDocAgaOpen) && "scale-0 opacity-0"
            )}
            aria-label={isExpanded ? 'Close quick actions' : 'Open quick actions'}
            aria-expanded={isExpanded}
            data-doc-aga-trigger
          >
            {isExpanded ? (
              <X className="h-7 w-7" />
            ) : (
              <Stethoscope className="h-7 w-7" />
            )}
          </Button>
          
          {/* Failed sync indicator badge */}
          {!isExpanded && !isDocAgaOpen && queueCounts.failed > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs animate-pulse"
            >
              {queueCounts.failed}
            </Badge>
          )}
          
          {/* Awaiting confirmation indicator */}
          {!isExpanded && !isDocAgaOpen && queueCounts.failed === 0 && queueCounts.awaiting > 0 && (
            <Badge 
              variant="outline" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-yellow-500 text-white border-yellow-600"
            >
              {queueCounts.awaiting}
            </Badge>
          )}
        </div>
      </div>

      {/* Backdrop when expanded */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-background/20 backdrop-blur-[2px] z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Onboarding Overlay */}
      {isDocAgaOpen && showOnboarding && (
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

      {/* Floating Chat Interface - Only render when open to prevent click blocking */}
      {isDocAgaOpen && (
        <Card
          className="fixed z-50 flex flex-col shadow-2xl inset-0 rounded-none sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[450px] sm:h-[650px] sm:rounded-lg lg:w-[500px] lg:h-[700px] animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b p-3 sm:p-4 bg-primary text-primary-foreground rounded-t-none sm:rounded-t-lg">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              <h2 className="font-semibold text-base sm:text-lg">Doc Aga</h2>
            </div>
            <Button
              onClick={() => setIsDocAgaOpen(false)}
              variant="ghost"
              size="icon"
              className="h-10 w-10 sm:h-8 sm:w-8 text-primary-foreground hover:bg-primary-foreground/20"
            >
              <X className="h-5 w-5 sm:h-4 sm:w-4" />
            </Button>
          </div>

          {/* Chat Content - lazy loaded */}
          <div className="flex-1 overflow-hidden">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-muted-foreground">Loading Doc Aga...</div>
              </div>
            }>
              <DocAga />
            </Suspense>
          </div>
        </Card>
      )}

      {/* Desktop backdrop for Doc Aga chat */}
      {isDocAgaOpen && (
        <div
          className="hidden sm:block fixed inset-0 bg-background/20 backdrop-blur-[2px] z-40"
          onClick={() => setIsDocAgaOpen(false)}
        />
      )}

      {/* Record Bulk Milk Dialog */}
      <RecordBulkMilkDialog
        open={isRecordMilkOpen}
        onOpenChange={setIsRecordMilkOpen}
        farmId={farmId}
      />

      {/* Record Bulk Feed Dialog */}
      <RecordBulkFeedDialog
        open={isRecordFeedOpen}
        onOpenChange={setIsRecordFeedOpen}
        farmId={farmId}
      />

      {/* Record Bulk Health Dialog */}
      <RecordBulkHealthDialog
        open={isRecordHealthOpen}
        onOpenChange={setIsRecordHealthOpen}
        farmId={farmId}
      />

      {/* Record Bulk BCS Dialog */}
      <RecordBulkBCSDialog
        open={isRecordBCSOpen}
        onOpenChange={setIsRecordBCSOpen}
        farmId={farmId}
      />

      {/* Add Animal Sheet */}
      <Sheet open={isAddAnimalOpen} onOpenChange={setIsAddAnimalOpen}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <PawPrint className="h-5 w-5" />
              Quick Add Animal
              <span className="text-xs text-muted-foreground ml-1">Mabilis na Pagdagdag</span>
            </SheetTitle>
          </SheetHeader>
          <div className="py-4">
            {farmId && (
              <AnimalForm 
                farmId={farmId} 
                onSuccess={() => setIsAddAnimalOpen(false)}
                onCancel={() => setIsAddAnimalOpen(false)}
                defaultQuickMode={true}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
