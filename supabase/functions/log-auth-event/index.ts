import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute per user

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Parse request body first to check event type
    const { userId, eventType, ipAddress, userAgent, metadata } = await req.json();

    if (!userId || !eventType) {
      return new Response(
        JSON.stringify({ error: "userId and eventType are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For signup events, we allow without auth since the user just created their account
    // and may not have a valid session token yet
    const isSignupEvent = eventType === "signup";

    if (!isSignupEvent) {
      // Verify JWT authentication for all non-signup events
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        console.warn("Missing authorization header for non-signup event");
        return new Response(
          JSON.stringify({ error: "Missing authorization header" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create client with anon key to verify the user's token
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

      if (authError || !user) {
        console.warn("Invalid or expired token:", authError?.message);
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate that the userId matches the authenticated user
      // Users can only log events for themselves
      if (userId !== user.id) {
        console.warn(`User ${user.id} attempted to log event for user ${userId}`);
        return new Response(
          JSON.stringify({ error: "Cannot log events for other users" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check rate limit for authenticated user
      if (!checkRateLimit(user.id)) {
        console.warn(`Rate limit exceeded for user ${user.id}`);
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // For signup events, apply rate limiting based on IP to prevent abuse
      const clientIp = ipAddress || req.headers.get("x-forwarded-for") || "unknown";
      if (!checkRateLimit(`signup_${clientIp}`)) {
        console.warn(`Signup rate limit exceeded for IP ${clientIp}`);
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Use service role for inserting the log (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

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

    console.log(`Auth event logged: ${eventType} for user ${userId}`);

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
