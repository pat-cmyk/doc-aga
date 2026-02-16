import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { showErrorToastLegacy } from "@/lib/errorHandling";

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  voice_training_completed: boolean;
  voice_training_skipped: boolean;
}

export const useProfile = () => {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      showErrorToastLegacy(toast, error, "loading profile");
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: { full_name?: string; phone?: string }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully"
      });

      await fetchProfile();
      return true;
    } catch (error: any) {
      showErrorToastLegacy(toast, error, "updating profile");
      return false;
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        // Check for leaked password error
        const isLeakedPassword = error.message?.includes("password has been exposed") || 
                                 error.message?.includes("breached") || 
                                 error.message?.includes("leaked");
        
        if (isLeakedPassword) {
          showErrorToastLegacy(toast, error);
          return false;
        }
        throw error;
      }

      toast({
        title: "Success",
        description: "Password updated successfully"
      });
      return true;
    } catch (error: any) {
      showErrorToastLegacy(toast, error, "updating password");
      return false;
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return {
    profile,
    loading,
    updateProfile,
    updatePassword,
    refetch: fetchProfile
  };
};
