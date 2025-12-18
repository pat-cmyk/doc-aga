import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MapPin, Camera, Bell, CheckCircle, XCircle, HelpCircle, Loader2, RefreshCw, Settings } from "lucide-react";
import { useDevicePermissions, PermissionStatus } from "@/hooks/useDevicePermissions";
import { MicrophonePermissionDialog } from "@/components/MicrophonePermissionDialog";
import { LocationPermissionDialog } from "./LocationPermissionDialog";
import { CameraPermissionDialog } from "./CameraPermissionDialog";
import { NotificationPermissionDialog } from "./NotificationPermissionDialog";

interface PermissionItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: PermissionStatus;
  onRequest: () => Promise<boolean>;
  onShowHelp: () => void;
}

function PermissionItem({ icon, title, description, status, onRequest, onShowHelp }: PermissionItemProps) {
  const [requesting, setRequesting] = useState(false);

  const handleRequest = async () => {
    setRequesting(true);
    const granted = await onRequest();
    setRequesting(false);
    if (!granted) {
      onShowHelp();
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case "granted":
        return (
          <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Enabled
          </Badge>
        );
      case "denied":
        return (
          <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
            <XCircle className="h-3 w-3 mr-1" />
            Denied
          </Badge>
        );
      case "prompt":
        return (
          <Badge variant="secondary">
            <HelpCircle className="h-3 w-3 mr-1" />
            Not Set
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <HelpCircle className="h-3 w-3 mr-1" />
            Unknown
          </Badge>
        );
    }
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          {icon}
        </div>
        <div>
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {getStatusBadge()}
        {status !== "granted" && (
          <Button
            size="sm"
            variant="outline"
            onClick={status === "denied" ? onShowHelp : handleRequest}
            disabled={requesting}
          >
            {requesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : status === "denied" ? (
              <Settings className="h-4 w-4" />
            ) : (
              "Enable"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export function DevicePermissionHub() {
  const {
    permissions,
    loading,
    checkAllPermissions,
    requestMicrophonePermission,
    requestLocationPermission,
    requestCameraPermission,
    requestNotificationPermission,
    grantedCount,
  } = useDevicePermissions();

  const [showMicDialog, setShowMicDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Device Permissions
              </CardTitle>
              <CardDescription>
                {grantedCount}/4 permissions enabled
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={checkAllPermissions}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <PermissionItem
            icon={<Mic className="h-5 w-5 text-primary" />}
            title="Microphone"
            description="Voice commands and Doc Aga consultation"
            status={permissions.microphone}
            onRequest={requestMicrophonePermission}
            onShowHelp={() => setShowMicDialog(true)}
          />
          <PermissionItem
            icon={<MapPin className="h-5 w-5 text-primary" />}
            title="Location"
            description="Farm location and regional data"
            status={permissions.location}
            onRequest={requestLocationPermission}
            onShowHelp={() => setShowLocationDialog(true)}
          />
          <PermissionItem
            icon={<Camera className="h-5 w-5 text-primary" />}
            title="Camera & Photos"
            description="Animal photos and health records"
            status={permissions.camera}
            onRequest={requestCameraPermission}
            onShowHelp={() => setShowCameraDialog(true)}
          />
          <PermissionItem
            icon={<Bell className="h-5 w-5 text-primary" />}
            title="Notifications"
            description="Reminders and sync alerts"
            status={permissions.notifications}
            onRequest={requestNotificationPermission}
            onShowHelp={() => setShowNotificationDialog(true)}
          />
        </CardContent>
      </Card>

      <MicrophonePermissionDialog
        open={showMicDialog}
        onOpenChange={setShowMicDialog}
        onRetry={() => {
          requestMicrophonePermission();
        }}
      />
      <LocationPermissionDialog
        open={showLocationDialog}
        onOpenChange={setShowLocationDialog}
        onRetry={() => {
          requestLocationPermission();
        }}
      />
      <CameraPermissionDialog
        open={showCameraDialog}
        onOpenChange={setShowCameraDialog}
        onRetry={() => {
          requestCameraPermission();
        }}
      />
      <NotificationPermissionDialog
        open={showNotificationDialog}
        onOpenChange={setShowNotificationDialog}
        onRetry={() => {
          requestNotificationPermission();
        }}
      />
    </>
  );
}
