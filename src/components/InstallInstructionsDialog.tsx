import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FolderOpen, FileDown, ShieldCheck, CheckCircle2 } from "lucide-react";

interface InstallInstructionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version?: string;
}

export function InstallInstructionsDialog({
  open,
  onOpenChange,
  version = "1.0.0",
}: InstallInstructionsDialogProps) {
  const steps = [
    {
      icon: Download,
      title: 'Tap "Download APK" button',
      description: "The file will start downloading to your phone",
    },
    {
      icon: FolderOpen,
      title: "Open your Downloads folder",
      description: "You can find it in your Files app or notification",
    },
    {
      icon: FileDown,
      title: "Tap the downloaded file",
      description: `Look for doc-aga-v${version}.apk`,
    },
    {
      icon: ShieldCheck,
      title: "Allow installation if prompted",
      description: 'Enable "Install from this source" in settings',
    },
    {
      icon: CheckCircle2,
      title: 'Tap "Install" when ready',
      description: "The app will be installed on your device",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How to Install Doc Aga</DialogTitle>
          <DialogDescription>
            Follow these simple steps to install the app on your Android device
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {steps.map((step, index) => (
            <div key={index} className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <step.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              <span className="flex-shrink-0 text-xs text-muted-foreground font-medium">
                {index + 1}
              </span>
            </div>
          ))}
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <strong>Note:</strong> You may need to enable "Install unknown apps" in your
            phone's Settings → Security for your browser or Files app.
          </p>
        </div>

        <Button onClick={() => onOpenChange(false)} className="w-full mt-2">
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
}
