import { useState, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Loader2 } from 'lucide-react';
import { useNativeCamera } from '@/hooks/useNativeCamera';
import { CameraPermissionDialog } from '@/components/permissions/CameraPermissionDialog';
import { cn } from '@/lib/utils';

export interface CameraPhotoInputProps {
  /** Callback when a photo is selected/captured */
  onPhotoSelected: (file: File) => void;
  /** Optional callback when an error occurs */
  onError?: (error: Error) => void;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Custom className */
  className?: string;
  /** Button label */
  label?: string;
  /** Whether to show camera icon */
  showIcon?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Accept file types for web fallback */
  accept?: string;
}

/**
 * Cross-platform photo input component
 * Uses Capacitor Camera on native platforms, falls back to file input on web
 */
export function CameraPhotoInput({
  onPhotoSelected,
  onError,
  variant = 'outline',
  size = 'default',
  className,
  label = 'Add Photo',
  showIcon = true,
  disabled = false,
  accept = 'image/*',
}: CameraPhotoInputProps) {
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { captureOrPick, isCapturing, checkPermissions, requestPermissions, isNative } = useNativeCamera();

  /**
   * Convert a URI to a File object
   */
  const uriToFile = async (uri: string, filename: string): Promise<File> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type || 'image/jpeg' });
  };

  /**
   * Handle native camera capture
   */
  const handleNativeCapture = useCallback(async () => {
    try {
      // Check permissions first
      const status = await checkPermissions();
      
      if (status === 'denied') {
        setShowPermissionDialog(true);
        return;
      }

      const photo = await captureOrPick();
      
      if (photo?.webPath) {
        const file = await uriToFile(photo.webPath, `photo-${Date.now()}.jpg`);
        onPhotoSelected(file);
      }
    } catch (error: any) {
      if (error.message?.includes('permission denied') || error.message?.includes('Permission denied')) {
        setShowPermissionDialog(true);
      } else {
        onError?.(error);
      }
    }
  }, [captureOrPick, checkPermissions, onPhotoSelected, onError]);

  /**
   * Handle web file input change
   */
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onPhotoSelected(file);
    }
    // Reset input so same file can be selected again
    event.target.value = '';
  }, [onPhotoSelected]);

  /**
   * Handle button click
   */
  const handleClick = useCallback(() => {
    if (isNative) {
      handleNativeCapture();
    } else {
      // Web - trigger file input
      fileInputRef.current?.click();
    }
  }, [isNative, handleNativeCapture]);

  /**
   * Retry after permission dialog
   */
  const handleRetry = useCallback(async () => {
    const granted = await requestPermissions();
    if (granted) {
      handleNativeCapture();
    }
  }, [requestPermissions, handleNativeCapture]);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn('gap-2', className)}
        onClick={handleClick}
        disabled={disabled || isCapturing}
      >
        {isCapturing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : showIcon ? (
          isNative ? <Camera className="h-4 w-4" /> : <Upload className="h-4 w-4" />
        ) : null}
        {label}
      </Button>

      {/* Hidden file input for web fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Permission dialog for native */}
      <CameraPermissionDialog
        open={showPermissionDialog}
        onOpenChange={setShowPermissionDialog}
        onRetry={handleRetry}
      />
    </>
  );
}
