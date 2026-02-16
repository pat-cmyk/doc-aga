import { useState, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { Camera, Upload, ImageIcon, Loader2 } from 'lucide-react';
import { useNativeCamera } from '@/hooks/useNativeCamera';
import { CameraPermissionDialog } from '@/components/permissions/CameraPermissionDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
 * - Native (Android/iOS): Uses Capacitor Camera with CameraSource.Prompt (camera + gallery)
 * - Mobile web: Shows popover with "Take Photo" (capture) and "Choose from Library"
 * - Desktop web: Standard file picker
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
  const [popoverOpen, setPopoverOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);

  const { captureOrPick, isCapturing, checkPermissions, requestPermissions, isNative } = useNativeCamera();

  const isMobileWeb = !isNative && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

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
   * Handle file input change (shared for all web inputs)
   */
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onPhotoSelected(file);
    }
    event.target.value = '';
  }, [onPhotoSelected]);

  /**
   * Handle button click
   */
  const handleClick = useCallback(() => {
    if (isNative) {
      handleNativeCapture();
    } else if (isMobileWeb) {
      // Mobile web: show popover with options
      setPopoverOpen(true);
    } else {
      // Desktop: direct file picker
      desktopInputRef.current?.click();
    }
  }, [isNative, isMobileWeb, handleNativeCapture]);

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
      {isMobileWeb ? (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant={variant}
              size={size}
              className={cn('gap-2', className)}
              disabled={disabled || isCapturing}
            >
              {isCapturing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : showIcon ? (
                <Upload className="h-4 w-4" />
              ) : null}
              {label}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start gap-2"
                onClick={() => {
                  setPopoverOpen(false);
                  cameraInputRef.current?.click();
                }}
              >
                <Camera className="h-4 w-4" />
                Take Photo
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start gap-2"
                onClick={() => {
                  setPopoverOpen(false);
                  libraryInputRef.current?.click();
                }}
              >
                <ImageIcon className="h-4 w-4" />
                Choose from Library
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      ) : (
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
      )}

      {/* Hidden file input for mobile web - camera capture */}
      <input
        ref={cameraInputRef}
        type="file"
        accept={accept}
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Hidden file input for mobile web - photo library */}
      <input
        ref={libraryInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Hidden file input for desktop web */}
      <input
        ref={desktopInputRef}
        type="file"
        accept={accept}
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
