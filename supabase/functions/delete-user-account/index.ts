import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

// GDPR/CCPA "erasure": lets a user permanently delete their OWN account.
//
// Deletion order matters (verified against the schema):
//   1. farms.owner_id -> profiles.id is ON DELETE RESTRICT, so owned farms must
//      be deleted first. animals.farm_id -> farms.id is ON DELETE CASCADE, so
//      deleting a farm removes its animals and farm-scoped records.
//   2. Deleting the auth user then cascades the profile and every
//      user_id -> auth.users ON DELETE CASCADE table (roles, memberships,
//      feedback, queries, activity logs, voice samples, ...).
//
// NOTE: test on a throwaway account after deploy — deep FK constraints can't be
// exercised without the live database.
serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Identify the caller from their own JWT — a user may only delete themselves.
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // Require an explicit confirmation token to avoid accidental deletes.
    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== "DELETE") {
      return new Response(JSON.stringify({ error: "Confirmation required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Delete owned farms first (cascades animals + farm-scoped records).
    const { error: farmsError } = await admin.from("farms").delete().eq("owner_id", userId);
    if (farmsError) {
      console.error("delete-user-account: farm delete failed", farmsError);
      return new Response(
        JSON.stringify({ error: "Could not delete your farm data. Please contact support." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Delete the auth user (cascades profile + all user_id-keyed rows).
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("delete-user-account: auth delete failed", deleteError);
      return new Response(
        JSON.stringify({ error: "Could not complete account deletion. Please contact support." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Account ${userId} self-deleted`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("delete-user-account error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
