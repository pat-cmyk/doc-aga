import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useFeedbackNotifications = (farmId?: string) => {
  useEffect(() => {
    if (!farmId) return;

    // Subscribe to feedback status changes for this farm
    const channel = supabase
      .channel(`feedback-${farmId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "farmer_feedback",
          filter: `farm_id=eq.${farmId}`,
        },
        (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;

          // Notify farmer when status changes
          if (newData.status !== oldData.status) {
            const statusMessages: Record<string, string> = {
              acknowledged: "✅ Ang inyong feedback ay natanggap na ng gobyerno",
              under_review: "🔍 Sinusuri na ang inyong concern",
              action_taken: "⚡ May aksyon na ang gobyerno sa inyong feedback",
              resolved: "🎉 Nasolusyunan na ang inyong concern",
              closed: "📋 Sarado na ang inyong feedback case",
            };

            const message = statusMessages[newData.status] || "Status ng feedback ay nag-update";
            toast.success(message, {
              description: newData.government_notes || "Tingnan ang My Submissions para sa detalye",
              duration: 10000,
            });
          }

          // Notify when government adds notes
          if (newData.government_notes && newData.government_notes !== oldData.government_notes) {
            toast.info("💬 May mensahe ang gobyerno para sa inyo", {
              description: newData.government_notes.slice(0, 100),
              duration: 8000,
            });
          }

          // Notify when action is taken
          if (newData.action_taken && newData.action_taken !== oldData.action_taken) {
            toast.success("✅ Aksyon na ang ginawa ng gobyerno", {
              description: newData.action_taken.slice(0, 100),
              duration: 10000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [farmId]);
};
