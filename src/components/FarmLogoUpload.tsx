import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Upload, Sprout, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface FarmLogoUploadProps {
  farmId: string;
  currentLogoUrl: string | null;
  onUploadSuccess: (newLogoUrl: string) => void;
}

export const FarmLogoUpload = ({ farmId, currentLogoUrl, onUploadSuccess }: FarmLogoUploadProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl);

  const validateFile = (file: File): boolean => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
    const maxSize = 2 * 1024 * 1024; // 2MB

    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPG, PNG, WEBP, or SVG image",
        variant: "destructive"
      });
      return false;
    }

    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 2MB",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!validateFile(file)) {
      event.target.value = '';
      return;
    }

    setUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${farmId}/${Date.now()}.${fileExt}`;

      // Delete old logo if exists
      if (currentLogoUrl) {
        const oldPath = currentLogoUrl.split('/').slice(-2).join('/');
        await supabase.storage
          .from('farm-logos')
          .remove([oldPath]);
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('farm-logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('farm-logos')
        .getPublicUrl(fileName);

      // Update farm record
      const { error: updateError } = await supabase
        .from('farms')
        .update({ logo_url: publicUrl })
        .eq('id', farmId);

      if (updateError) throw updateError;

      setPreviewUrl(publicUrl);
      onUploadSuccess(publicUrl);

      toast({
        title: "Success",
        description: "Farm logo updated successfully"
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!currentLogoUrl) return;

    setUploading(true);

    try {
      const path = currentLogoUrl.split('/').slice(-2).join('/');
      
      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('farm-logos')
        .remove([path]);

      if (deleteError) throw deleteError;

      // Update farm record
      const { error: updateError } = await supabase
        .from('farms')
        .update({ logo_url: null })
        .eq('id', farmId);

      if (updateError) throw updateError;

      setPreviewUrl(null);
      onUploadSuccess('');

      toast({
        title: "Success",
        description: "Farm logo removed successfully"
      });
    } catch (error: any) {
      toast({
        title: "Failed to remove logo",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={previewUrl || undefined} alt="Farm logo" />
          <AvatarFallback className="bg-primary/10">
            <Sprout className="h-10 w-10 text-primary" />
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 space-y-2">
          <Label htmlFor="logo-upload" className="text-sm font-medium">
            Farm Logo
          </Label>
          <p className="text-xs text-muted-foreground">
            Upload a logo for your farm (Max 2MB, JPG/PNG/WEBP/SVG)
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={uploading}
          asChild
        >
          <Label htmlFor="logo-upload" className="cursor-pointer">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {previewUrl ? 'Change Logo' : 'Upload Logo'}
          </Label>
        </Button>
        
        {previewUrl && (
          <Button
            variant="ghost"
            size="icon"
            disabled={uploading}
            onClick={handleRemoveLogo}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Input
        id="logo-upload"
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/svg+xml"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};
