import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export type PermissionStatus = "granted" | "denied" | "prompt" | "unknown";

export interface DevicePermissions {
  microphone: PermissionStatus;
  location: PermissionStatus;
  camera: PermissionStatus;
  notifications: PermissionStatus;
}

export function useDevicePermissions() {
  const [permissions, setPermissions] = useState<DevicePermissions>({
    microphone: "unknown",
    location: "unknown",
    camera: "unknown",
    notifications: "unknown",
  });
  const [loading, setLoading] = useState(true);

  const checkAllPermissions = useCallback(async () => {
    setLoading(true);
    
    const newPermissions: DevicePermissions = {
      microphone: "unknown",
      location: "unknown",
      camera: "unknown",
      notifications: "unknown",
    };

    // Check microphone
    try {
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
        newPermissions.microphone = result.state as PermissionStatus;
      }
    } catch (e) {
      // Safari doesn't support microphone permission query
      newPermissions.microphone = "unknown";
    }

    // Check location
    try {
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: "geolocation" });
        newPermissions.location = result.state as PermissionStatus;
      }
    } catch (e) {
      newPermissions.location = "unknown";
    }

    // Check camera
    try {
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: "camera" as PermissionName });
        newPermissions.camera = result.state as PermissionStatus;
      }
    } catch (e) {
      newPermissions.camera = "unknown";
    }

    // Check notifications
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await LocalNotifications.checkPermissions();
        newPermissions.notifications = result.display as PermissionStatus;
      } else if ("Notification" in window) {
        newPermissions.notifications = Notification.permission as PermissionStatus;
      }
    } catch (e) {
      newPermissions.notifications = "unknown";
    }

    setPermissions(newPermissions);
    setLoading(false);
    
    return newPermissions;
  }, []);

  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setPermissions(prev => ({ ...prev, microphone: "granted" }));
      return true;
    } catch (e) {
      setPermissions(prev => ({ ...prev, microphone: "denied" }));
      return false;
    }
  }, []);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          setPermissions(prev => ({ ...prev, location: "granted" }));
          resolve(true);
        },
        () => {
          setPermissions(prev => ({ ...prev, location: "denied" }));
          resolve(false);
        }
      );
    });
  }, []);

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setPermissions(prev => ({ ...prev, camera: "granted" }));
      return true;
    } catch (e) {
      setPermissions(prev => ({ ...prev, camera: "denied" }));
      return false;
    }
  }, []);

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await LocalNotifications.requestPermissions();
        const granted = result.display === "granted";
        setPermissions(prev => ({ ...prev, notifications: granted ? "granted" : "denied" }));
        return granted;
      } else if ("Notification" in window) {
        const result = await Notification.requestPermission();
        const granted = result === "granted";
        setPermissions(prev => ({ ...prev, notifications: granted ? "granted" : "denied" }));
        return granted;
      }
      return false;
    } catch (e) {
      setPermissions(prev => ({ ...prev, notifications: "denied" }));
      return false;
    }
  }, []);

  const allPermissionsGranted = 
    permissions.microphone === "granted" &&
    permissions.location === "granted" &&
    permissions.camera === "granted" &&
    permissions.notifications === "granted";

  const grantedCount = [
    permissions.microphone,
    permissions.location,
    permissions.camera,
    permissions.notifications,
  ].filter(p => p === "granted").length;

  useEffect(() => {
    checkAllPermissions();
  }, [checkAllPermissions]);

  return {
    permissions,
    loading,
    checkAllPermissions,
    requestMicrophonePermission,
    requestLocationPermission,
    requestCameraPermission,
    requestNotificationPermission,
    allPermissionsGranted,
    grantedCount,
  };
}
