import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

// GDPR/CCPA "access & portability": returns a JSON copy of the caller's own
// personal data. Reads run through the user-scoped client so RLS guarantees a
// user can only ever export their own rows.
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ownedFarms = await supabase.from("farms").select("*").eq("owner_id", user.id);
    const farmIds = (ownedFarms.data ?? []).map((f: { id: string }) => f.id);

    const [
      profile,
      roles,
      memberships,
      feedback,
      queries,
      activity,
      voiceSamples,
      animals,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("*").eq("user_id", user.id),
      supabase.from("farm_memberships").select("*").eq("user_id", user.id),
      supabase.from("farmer_feedback").select("*").eq("user_id", user.id),
      supabase.from("doc_aga_queries").select("*").eq("user_id", user.id),
      supabase.from("user_activity_logs").select("*").eq("user_id", user.id),
      supabase.from("voice_training_samples").select("*").eq("user_id", user.id),
      farmIds.length
        ? supabase.from("animals").select("*").in("farm_id", farmIds)
        : Promise.resolve({ data: [] as unknown[] }),
    ]);

    const payload = {
      meta: {
        generated_at: new Date().toISOString(),
        user_id: user.id,
        email: user.email ?? null,
        note:
          "Personal data export from Doc Aga. Farm data is included only for farms you own.",
      },
      profile: profile.data ?? null,
      roles: roles.data ?? [],
      farm_memberships: memberships.data ?? [],
      owned_farms: ownedFarms.data ?? [],
      animals: animals.data ?? [],
      farmer_feedback: feedback.data ?? [],
      ai_queries: queries.data ?? [],
      activity_logs: activity.data ?? [],
      voice_training_samples: voiceSamples.data ?? [],
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("export-user-data error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
