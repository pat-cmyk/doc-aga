import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, HelpCircle, Apple, ExternalLink } from "lucide-react";
import { InstallInstructionsDialog } from "./InstallInstructionsDialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const FALLBACK_APK_URL = "https://github.com/pat-cmyk/doc-aga/releases/download/Beta_Launch/app-release.apk";
const FALLBACK_VERSION = "1.0.0";

interface VersionInfo {
  version: string;
  versionCode: number;
  downloadUrl: string;
  size: string;
  sha256?: string;
  releaseDate: string;
  releaseNotes?: string;
}

interface AppDownloadSectionProps {
  className?: string;
}

type Platform = "android" | "ios" | "desktop" | "native";

function getPlatform(): Platform {
  // Check if running inside Capacitor native app
  if (
    typeof window !== "undefined" &&
    (window as any).Capacitor?.isNativePlatform?.()
  ) {
    return "native";
  }

  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

export function AppDownloadSection({ className }: AppDownloadSectionProps) {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    setPlatform(getPlatform());
    fetchVersionInfo();
  }, []);

  const fetchVersionInfo = async () => {
    try {
      setIsLoading(true);
      setDownloadError(null);

      // Try to fetch version.json from storage
      const { data } = supabase.storage
        .from("app-releases")
        .getPublicUrl("android/version.json");

      if (data?.publicUrl) {
        const response = await fetch(data.publicUrl, {
          cache: "no-store",
        });
        
        if (response.ok) {
          const info = await response.json();
          setVersionInfo(info);
        } else {
          // No version file yet - show placeholder
          setVersionInfo(null);
        }
      }
    } catch (error) {
      console.error("Error fetching version info:", error);
      setVersionInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    const downloadUrl = versionInfo?.downloadUrl || FALLBACK_APK_URL;
    
    try {
      window.open(downloadUrl, "_blank");
    } catch (error) {
      console.error("Download error:", error);
      setDownloadError("Failed to start download. Please try again.");
    }
  };

  // Don't show anything if running inside native app
  if (platform === "native") {
    return null;
  }

  return (
    <div className={cn("mt-4 pt-4 border-t border-border", className)}>
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-2 text-sm font-medium">
          <Smartphone className="h-4 w-4" />
          <span>Get Doc Aga on your device</span>
        </div>

        {/* Android Download Section */}
        {(platform === "android" || platform === "desktop") && (
          <div className="space-y-2">
            {isLoading ? (
              <div className="h-10 bg-muted animate-pulse rounded-md" />
            ) : (
              <>
                <Button
                  onClick={handleDownload}
                  className="w-full gap-2"
                  variant="default"
                >
                  <Download className="h-4 w-4" />
                  Download APK {versionInfo?.version ? `(v${versionInfo.version})` : `(v${FALLBACK_VERSION})`}
                </Button>
                {versionInfo?.size && (
                  <p className="text-xs text-muted-foreground">
                    {versionInfo.size} • Android 7.0+
                  </p>
                )}
              </>
            )}

            {downloadError && (
              <p className="text-xs text-destructive">{downloadError}</p>
            )}

            <button
              onClick={() => setShowInstructions(true)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <HelpCircle className="h-3 w-3" />
              How to install?
            </button>
          </div>
        )}

        {/* iOS Section */}
        {(platform === "ios" || platform === "desktop") && (
          <div className="flex items-center justify-center gap-2 py-2 px-4 bg-muted/50 rounded-md">
            <Apple className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              iOS App Store coming soon
            </span>
          </div>
        )}

        {/* Desktop notice */}
        {platform === "desktop" && (
          <p className="text-xs text-muted-foreground">
            Visit this page on your mobile device to download
          </p>
        )}
      </div>

      <InstallInstructionsDialog
        open={showInstructions}
        onOpenChange={setShowInstructions}
        version={versionInfo?.version}
      />
    </div>
  );
}
