import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StageBadge } from "@/components/ui/stage-badge";
import { Camera, Loader2, Database, Globe, Copy, Baby, Home, ShoppingCart, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { formatDistanceToNow } from "date-fns";
import type { Animal } from "./hooks/useAnimalDetails";

// Helper to determine origin badge info
const getOriginBadgeInfo = (animal: Animal): { label: string; icon: React.ReactNode; className: string } | null => {
  const isFarmBorn = animal.farm_entry_date === null;
  
  if (isFarmBorn) {
    return {
      label: "Farm Born",
      icon: <Home className="h-3 w-3 mr-1" />,
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
    };
  }
  
  // Acquired animal
  if (animal.acquisition_type === "grant") {
    return {
      label: "Grant",
      icon: <Gift className="h-3 w-3 mr-1" />,
      className: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30"
    };
  }
  
  // Default to purchased for acquired animals
  return {
    label: "Purchased",
    icon: <ShoppingCart className="h-3 w-3 mr-1" />,
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"
  };
};

interface AnimalProfileProps {
  animal: Animal;
  computedLifeStage: string | null;
  computedMilkingStage: string | null;
  expectedDeliveryDate: string | null;
  lifeStageDefinition: string;
  milkingStageDefinition: string;
  lifeStageBadgeColor: string;
  milkingStageBadgeColor: string;
  isCached: boolean;
  caching: boolean;
  onReload: () => void;
}

export const AnimalProfile = ({
  animal,
  computedLifeStage,
  computedMilkingStage,
  expectedDeliveryDate,
  lifeStageDefinition,
  milkingStageDefinition,
  lifeStageBadgeColor,
  milkingStageBadgeColor,
  isCached,
  caching
}: AnimalProfileProps) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${animal.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('animal-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('animal-photos')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('animals')
        .update({ avatar_url: publicUrl })
        .eq('id', animal.id);

      if (updateError) throw updateError;

      toast({
        title: "Success!",
        description: "Avatar updated successfully"
      });

      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const getCacheIcon = () => {
    if (caching) {
      return (
        <span title="Downloading for offline use...">
          <Database className="h-3.5 w-3.5 text-yellow-500 animate-pulse inline-block ml-2" />
        </span>
      );
    }
    
    if (isCached) {
      return (
        <span title="Available offline">
          <Database className="h-3.5 w-3.5 text-green-500 inline-block ml-2" />
        </span>
      );
    }
    
    return (
      <span title="Not cached offline">
        <Database className="h-3.5 w-3.5 text-gray-400 inline-block ml-2" />
      </span>
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Unique code copied to clipboard"
    });
  };

  return (
    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
      <div className="relative">
        <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
          <AvatarImage 
            src={animal.avatar_url ? `${animal.avatar_url}?t=${new Date().getTime()}` : undefined} 
            alt={animal.name || "Animal"} 
            key={animal.avatar_url}
          />
          <AvatarFallback className="text-lg sm:text-xl">{animal.name?.[0] || animal.ear_tag?.[0] || "A"}</AvatarFallback>
        </Avatar>
        <Button
          size="icon"
          variant="secondary"
          className="absolute -bottom-1 -right-1 h-7 w-7 sm:h-8 sm:w-8 rounded-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !isOnline}
          title={!isOnline ? "Available when online" : ""}
        >
          {uploading ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <Camera className="h-3 w-3 sm:h-4 sm:w-4" />}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarUpload}
        />
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <CardTitle className="text-lg sm:text-2xl truncate">{animal.name}</CardTitle>
          {(() => {
            const originInfo = getOriginBadgeInfo(animal);
            return originInfo ? (
              <Badge variant="outline" className={`text-xs border ${originInfo.className}`}>
                {originInfo.icon}
                {originInfo.label}
              </Badge>
            ) : null;
          })()}
          {computedLifeStage && (
            <StageBadge 
              stage={computedLifeStage}
              definition={lifeStageDefinition}
              colorClass={lifeStageBadgeColor}
            />
          )}
          {computedMilkingStage && (
            <StageBadge 
              stage={computedMilkingStage}
              definition={milkingStageDefinition}
              colorClass={milkingStageBadgeColor}
            />
          )}
          {expectedDeliveryDate && (
            <Badge className="bg-green-500 hover:bg-green-600 text-xs">
              <Baby className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Due: </span>
              {formatDistanceToNow(new Date(expectedDeliveryDate), { addSuffix: true })}
            </Badge>
          )}
        </div>
        <CardDescription className="space-y-1 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="truncate">{animal.breed} • Tag: {animal.ear_tag}</span>
            {getCacheIcon()}
          </div>
          {animal.unique_code && (
            <div className="flex items-center gap-1.5">
              <Globe className="h-3 w-3 flex-shrink-0" />
              <code className="text-[10px] sm:text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{animal.unique_code}</code>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={() => copyToClipboard(animal.unique_code!)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardDescription>
      </div>
    </div>
  );
};
