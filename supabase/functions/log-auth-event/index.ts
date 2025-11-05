import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { userId, eventType, ipAddress, userAgent, metadata } = await req.json();

    if (!userId || !eventType) {
      return new Response(
        JSON.stringify({ error: "userId and eventType are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map event types to categories and descriptions
    const eventMapping: Record<string, { category: string; description: string }> = {
      login: { category: "authentication", description: "User logged in" },
      logout: { category: "authentication", description: "User logged out" },
      signup: { category: "authentication", description: "User account created" },
      password_change: { category: "security", description: "Password changed" },
      password_reset: { category: "security", description: "Password reset requested" },
      email_change: { category: "security", description: "Email address changed" },
      mfa_enabled: { category: "security", description: "Multi-factor authentication enabled" },
      mfa_disabled: { category: "security", description: "Multi-factor authentication disabled" },
    };

    const eventInfo = eventMapping[eventType] || {
      category: "authentication",
      description: `Authentication event: ${eventType}`,
    };

    // Insert activity log
    const { error: logError } = await supabaseAdmin.from("user_activity_logs").insert({
      user_id: userId,
      activity_type: eventType,
      activity_category: eventInfo.category,
      description: eventInfo.description,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      metadata: metadata || {},
    });

    if (logError) {
      console.error("Failed to log activity:", logError);
      throw logError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in log-auth-event:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
