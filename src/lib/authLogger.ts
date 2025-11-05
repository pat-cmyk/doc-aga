import { supabase } from "@/integrations/supabase/client";

interface LogAuthEventParams {
  userId: string;
  eventType: "login" | "logout" | "signup" | "password_change" | "password_reset" | "email_change";
  metadata?: Record<string, any>;
}

export const logAuthEvent = async ({ userId, eventType, metadata = {} }: LogAuthEventParams) => {
  try {
    // Get IP address and user agent (best effort)
    const ipAddress = null; // Can't reliably get in browser
    const userAgent = navigator.userAgent;

    await supabase.functions.invoke("log-auth-event", {
      body: {
        userId,
        eventType,
        ipAddress,
        userAgent,
        metadata,
      },
    });
  } catch (error) {
    console.error("Failed to log auth event:", error);
    // Don't throw - logging should not break auth flow
  }
};
