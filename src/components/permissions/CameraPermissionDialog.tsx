import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Settings, ExternalLink, RefreshCw } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { openAppSettings } from "@/lib/openAppSettings";
import { toast } from "sonner";

interface CameraPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
}

export function CameraPermissionDialog({
  open,
  onOpenChange,
  onRetry,
}: CameraPermissionDialogProps) {
  const [isOpeningSettings, setIsOpeningSettings] = useState(false);

  const isAndroid = /android/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isCapacitor = Capacitor.isNativePlatform();

  const handleOpenSettings = async () => {
    setIsOpeningSettings(true);
    
    try {
      if (isCapacitor) {
        const opened = await openAppSettings();
        if (!opened) {
          toast.error('Could not open settings', {
            description: 'Please go to Settings > Apps > Doc Aga manually.',
          });
        }
      } else {
        window.open('https://support.google.com/chrome/answer/2693767', '_blank');
      }
    } catch (error) {
      console.error('Error opening settings:', error);
      toast.error('Could not open settings', {
        description: 'Please go to Settings > Apps > Doc Aga manually.',
      });
    } finally {
      setIsOpeningSettings(false);
    }
  };

  const handleRetry = () => {
    onOpenChange(false);
    onRetry();
  };

  const getPlatformInstructions = () => {
    if (isCapacitor && isAndroid) {
      return (
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>Tap <strong>"Open Settings"</strong> below</li>
          <li>Find <strong>"Permissions"</strong> or <strong>"App permissions"</strong></li>
          <li>Tap <strong>"Camera"</strong> and <strong>"Photos"</strong></li>
          <li>Select <strong>"Allow"</strong> for both</li>
          <li>Return to Doc Aga and tap <strong>"Try Again"</strong></li>
        </ol>
      );
    }
    
    if (isCapacitor && isIOS) {
      return (
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>Tap <strong>"Open Settings"</strong> below</li>
          <li>Enable <strong>"Camera"</strong> access</li>
          <li>Enable <strong>"Photos"</strong> access (select "All Photos")</li>
          <li>Return to Doc Aga and tap <strong>"Try Again"</strong></li>
        </ol>
      );
    }

    return (
      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
        <li>Click the <strong>lock/info icon</strong> in your browser's address bar</li>
        <li>Find <strong>"Camera"</strong> in the permissions</li>
        <li>Change it to <strong>"Allow"</strong></li>
        <li>Refresh the page or tap <strong>"Try Again"</strong></li>
      </ol>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Camera className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">Camera Permission Needed</DialogTitle>
          </div>
          <DialogDescription className="pt-4 space-y-4">
            <p>
              Doc Aga needs camera/photo access for:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Documenting animal health conditions</li>
              <li>Adding photos to animal profiles</li>
              <li>Uploading farm logo and branding</li>
              <li>Recording visual health records</li>
            </ul>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm font-medium">How to enable:</p>
          {getPlatformInstructions()}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          
          {isCapacitor ? (
            <Button
              onClick={handleOpenSettings}
              disabled={isOpeningSettings}
              className="w-full sm:w-auto gap-2"
            >
              <Settings className="h-4 w-4" />
              Open Settings
            </Button>
          ) : (
            <Button
              onClick={handleOpenSettings}
              className="w-full sm:w-auto gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Learn How
            </Button>
          )}
          
          <Button
            onClick={handleRetry}
            variant="secondary"
            className="w-full sm:w-auto gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
