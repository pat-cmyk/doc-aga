import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import type { Photo } from '@capacitor/camera';

export interface UseNativeCameraOptions {
  /** Image quality (1-100). Default: 90 */
  quality?: number;
  /** Allow user to edit image before returning. Default: false */
  allowEditing?: boolean;
  /** Default source selection. Default: 'prompt' (show camera/photos picker) */
  source?: 'camera' | 'photos' | 'prompt';
}

export interface UseNativeCameraReturn {
  /** Take a photo using the device camera */
  takePhoto: () => Promise<Photo | null>;
  /** Pick a photo from the device gallery */
  pickPhoto: () => Promise<Photo | null>;
  /** Show prompt to choose camera or gallery */
  captureOrPick: () => Promise<Photo | null>;
  /** Whether a capture operation is in progress */
  isCapturing: boolean;
  /** Last error that occurred */
  error: Error | null;
  /** Whether running on native platform */
  isNative: boolean;
  /** Check current camera permissions */
  checkPermissions: () => Promise<'granted' | 'denied' | 'prompt'>;
  /** Request camera permissions */
  requestPermissions: () => Promise<boolean>;
}

// Dynamic import helper for native camera
async function getNativeCamera() {
  const module = await import(/* @vite-ignore */ '@capacitor/camera');
  return {
    Camera: module.Camera,
    CameraResultType: module.CameraResultType,
    CameraSource: module.CameraSource,
  };
}

export function useNativeCamera(options: UseNativeCameraOptions = {}): UseNativeCameraReturn {
  const { quality = 90, allowEditing = false } = options;
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isNative = Capacitor.isNativePlatform();

  /**
   * Check current camera permissions status
   */
  const checkPermissions = useCallback(async (): Promise<'granted' | 'denied' | 'prompt'> => {
    if (!isNative) {
      // Web - check via navigator.permissions if available
      try {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        return result.state as 'granted' | 'denied' | 'prompt';
      } catch {
        return 'prompt';
      }
    }
    
    try {
      const { Camera } = await getNativeCamera();
      const status = await Camera.checkPermissions();
      // Both camera and photos need to be granted for full functionality
      if (status.camera === 'granted' && status.photos === 'granted') {
        return 'granted';
      }
      if (status.camera === 'denied' || status.photos === 'denied') {
        return 'denied';
      }
      return 'prompt';
    } catch {
      return 'prompt';
    }
  }, [isNative]);

  /**
   * Request camera and photos permissions
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      // Web - permissions are requested when getUserMedia is called
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch {
        return false;
      }
    }

    try {
      const { Camera } = await getNativeCamera();
      const result = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
      return result.camera === 'granted' && result.photos === 'granted';
    } catch {
      return false;
    }
  }, [isNative]);

  /**
   * Capture a photo from the specified source
   */
  const capturePhoto = useCallback(async (sourceType: 'camera' | 'photos' | 'prompt'): Promise<Photo | null> => {
    setIsCapturing(true);
    setError(null);
    
    try {
      // Check and request permissions if needed
      const permStatus = await checkPermissions();
      if (permStatus === 'denied') {
        throw new Error('Camera permission denied');
      }
      
      if (permStatus === 'prompt') {
        const granted = await requestPermissions();
        if (!granted) {
          throw new Error('Camera permission denied');
        }
      }

      const { Camera, CameraResultType, CameraSource } = await getNativeCamera();
      
      // Map source type to CameraSource enum
      const cameraSource = sourceType === 'camera' 
        ? CameraSource.Camera 
        : sourceType === 'photos' 
          ? CameraSource.Photos 
          : CameraSource.Prompt;

      const photo = await Camera.getPhoto({
        quality,
        allowEditing,
        resultType: CameraResultType.Uri,
        source: cameraSource,
        saveToGallery: false,
        correctOrientation: true,
      });

      return photo;
    } catch (err: any) {
      // User cancelled is not an error
      if (err.message?.includes('cancelled') || err.message?.includes('canceled') || err.message?.includes('User cancelled')) {
        return null;
      }
      const captureError = err instanceof Error ? err : new Error(err.message || 'Camera capture failed');
      setError(captureError);
      throw captureError;
    } finally {
      setIsCapturing(false);
    }
  }, [quality, allowEditing, checkPermissions, requestPermissions]);

  const takePhoto = useCallback(() => 
    capturePhoto('camera'), [capturePhoto]);

  const pickPhoto = useCallback(() => 
    capturePhoto('photos'), [capturePhoto]);

  const captureOrPick = useCallback(() => 
    capturePhoto('prompt'), [capturePhoto]);

  return {
    takePhoto,
    pickPhoto,
    captureOrPick,
    isCapturing,
    error,
    isNative,
    checkPermissions,
    requestPermissions,
  };
}
