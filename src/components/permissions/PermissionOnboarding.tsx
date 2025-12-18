import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Mic, MapPin, Camera, Bell, CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { useDevicePermissions } from "@/hooks/useDevicePermissions";
import { MicrophonePermissionDialog } from "@/components/MicrophonePermissionDialog";
import { LocationPermissionDialog } from "./LocationPermissionDialog";
import { CameraPermissionDialog } from "./CameraPermissionDialog";
import { NotificationPermissionDialog } from "./NotificationPermissionDialog";

interface PermissionOnboardingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

type PermissionStep = "microphone" | "location" | "camera" | "notifications" | "complete";

const PERMISSION_STEPS: PermissionStep[] = ["microphone", "location", "camera", "notifications"];

export function PermissionOnboarding({
  open,
  onOpenChange,
  onComplete,
}: PermissionOnboardingProps) {
  const [currentStep, setCurrentStep] = useState<PermissionStep>("microphone");
  const [requesting, setRequesting] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState<PermissionStep | null>(null);
  
  const {
    permissions,
    requestMicrophonePermission,
    requestLocationPermission,
    requestCameraPermission,
    requestNotificationPermission,
    grantedCount,
    checkAllPermissions,
  } = useDevicePermissions();

  useEffect(() => {
    if (open) {
      checkAllPermissions();
    }
  }, [open, checkAllPermissions]);

  const stepIndex = PERMISSION_STEPS.indexOf(currentStep as PermissionStep);
  const progress = currentStep === "complete" ? 100 : ((stepIndex + 1) / PERMISSION_STEPS.length) * 100;

  const stepConfig = {
    microphone: {
      icon: <Mic className="h-8 w-8" />,
      title: "Microphone Access",
      description: "Para sa voice commands at Doc Aga consultation",
      benefits: [
        "Voice training para mas maintindihan ka ni Doc Aga",
        "Mag-record ng farm activities hands-free",
        "Makipag-usap kay Doc Aga para sa veterinary advice",
      ],
      request: requestMicrophonePermission,
      status: permissions.microphone,
    },
    location: {
      icon: <MapPin className="h-8 w-8" />,
      title: "Location Access",
      description: "Para sa accurate na farm location",
      benefits: [
        "Accurate farm location para sa government reporting",
        "Maghanap ng malapit na distributors at suppliers",
        "Regional weather at market data",
      ],
      request: requestLocationPermission,
      status: permissions.location,
    },
    camera: {
      icon: <Camera className="h-8 w-8" />,
      title: "Camera & Photos Access",
      description: "Para sa animal photos at records",
      benefits: [
        "I-document ang health condition ng mga hayop",
        "Mag-upload ng photos sa animal profiles",
        "Mag-record ng visual health observations",
      ],
      request: requestCameraPermission,
      status: permissions.camera,
    },
    notifications: {
      icon: <Bell className="h-8 w-8" />,
      title: "Notification Access",
      description: "Para sa reminders at updates",
      benefits: [
        "Sync alerts kapag na-upload na ang offline data",
        "Vaccination at deworming reminders",
        "Breeding schedule notifications",
      ],
      request: requestNotificationPermission,
      status: permissions.notifications,
    },
  };

  const handleRequestPermission = async () => {
    if (currentStep === "complete") return;
    
    const config = stepConfig[currentStep];
    setRequesting(true);
    
    const granted = await config.request();
    setRequesting(false);
    
    if (granted) {
      moveToNextStep();
    } else {
      setShowHelpDialog(currentStep);
    }
  };

  const moveToNextStep = () => {
    const currentIndex = PERMISSION_STEPS.indexOf(currentStep);
    if (currentIndex < PERMISSION_STEPS.length - 1) {
      setCurrentStep(PERMISSION_STEPS[currentIndex + 1]);
    } else {
      setCurrentStep("complete");
    }
  };

  const handleSkipStep = () => {
    moveToNextStep();
  };

  const handleComplete = () => {
    localStorage.setItem("permission_onboarding_completed", "true");
    onComplete();
    onOpenChange(false);
  };

  const handleSkipAll = () => {
    localStorage.setItem("permission_onboarding_completed", "true");
    onOpenChange(false);
  };

  if (currentStep === "complete") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-xl">Setup Complete!</DialogTitle>
            <DialogDescription className="pt-2">
              {grantedCount === 4 
                ? "Lahat ng permissions ay enabled na. Ready ka nang gamitin ang Doc Aga!"
                : `${grantedCount}/4 permissions enabled. Pwede mo pa rin gamitin ang Doc Aga, pero may limitasyon sa ibang features.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleComplete} className="w-full">
              Start Using Doc Aga
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const config = stepConfig[currentStep];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Step {stepIndex + 1} of {PERMISSION_STEPS.length}</span>
                <Button variant="ghost" size="sm" onClick={handleSkipAll} className="text-xs h-auto py-1">
                  Skip All
                </Button>
              </div>
              <Progress value={progress} className="h-2" />
              
              <div className="flex justify-center pt-4">
                <div className={`flex h-16 w-16 items-center justify-center rounded-full ${
                  config.status === "granted" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {config.icon}
                </div>
              </div>
              
              <DialogTitle className="text-xl text-center">{config.title}</DialogTitle>
              <DialogDescription className="text-center">
                {config.description}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm font-medium mb-3">Benefits:</p>
            <ul className="space-y-2">
              {config.benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={handleSkipStep}
              className="w-full sm:w-auto"
              disabled={requesting}
            >
              Skip
            </Button>
            
            {config.status === "granted" ? (
              <Button
                onClick={moveToNextStep}
                className="w-full sm:w-auto gap-2"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleRequestPermission}
                disabled={requesting}
                className="w-full sm:w-auto gap-2"
              >
                {requesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Enable {currentStep.charAt(0).toUpperCase() + currentStep.slice(1)}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MicrophonePermissionDialog
        open={showHelpDialog === "microphone"}
        onOpenChange={(open) => !open && setShowHelpDialog(null)}
        onRetry={() => {
          setShowHelpDialog(null);
          handleRequestPermission();
        }}
      />
      <LocationPermissionDialog
        open={showHelpDialog === "location"}
        onOpenChange={(open) => !open && setShowHelpDialog(null)}
        onRetry={() => {
          setShowHelpDialog(null);
          handleRequestPermission();
        }}
      />
      <CameraPermissionDialog
        open={showHelpDialog === "camera"}
        onOpenChange={(open) => !open && setShowHelpDialog(null)}
        onRetry={() => {
          setShowHelpDialog(null);
          handleRequestPermission();
        }}
      />
      <NotificationPermissionDialog
        open={showHelpDialog === "notifications"}
        onOpenChange={(open) => !open && setShowHelpDialog(null)}
        onRetry={() => {
          setShowHelpDialog(null);
          handleRequestPermission();
        }}
      />
    </>
  );
}
