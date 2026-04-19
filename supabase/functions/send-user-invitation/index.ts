// Admin Dashboard — send-user-invitation
// Super admin-only endpoint that either:
//   1. Creates a pending user_invitations row + sends a Resend email, OR
//   2. If the email already belongs to an auth user, grants the role immediately (no email).
//
// Input:  { email, role, appUrl }
// Output: { status, invitationId?, token?, userId?, message }

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { Resend } from "npm:resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_GLOBAL_ROLES = [
  "admin",
  "government",
  "merchant",
  "distributor",
  "cooperative",
] as const;

const requestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email format")
    .max(255, "Email must be under 255 characters"),
  role: z.enum(ALLOWED_GLOBAL_ROLES),
  appUrl: z
    .string()
    .url("appUrl must be a valid URL")
    .max(500)
    .optional(),
});

type AllowedRole = (typeof ALLOWED_GLOBAL_ROLES)[number];

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(id: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(id);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(id, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  if (record.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      retryAfter: Math.ceil((record.resetAt - now) / 1000),
    };
  }
  record.count++;
  return { allowed: true };
}

const roleCopy: Record<AllowedRole, { label: string; description: string }> = {
  admin: {
    label: "System Administrator",
    description: "You'll have full platform administration access.",
  },
  government: {
    label: "Government Official",
    description: "You'll have access to government analytics dashboards.",
  },
  merchant: {
    label: "Merchant",
    description: "You'll have access to the marketplace vendor tools.",
  },
  distributor: {
    label: "Distributor",
    description: "You'll have access to distributor tools.",
  },
  cooperative: {
    label: "Cooperative Admin",
    description: "You'll manage your cooperative's dashboard.",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized - No auth header" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Unauthorized - Invalid token" }, 401);
    }

    const { data: isSuperAdmin, error: adminCheckError } = await supabaseAdmin
      .rpc("is_super_admin", { _user_id: user.id });
    if (adminCheckError || !isSuperAdmin) {
      return json({ error: "Forbidden - Super admin access required" }, 403);
    }

    // --- Rate limit ---
    const rate = checkRateLimit(user.id);
    if (!rate.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(rate.retryAfter ?? 60),
        },
      });
    }

    // --- Validate body ---
    const rawBody = await req.json();
    const parsed = requestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        400
      );
    }
    const { email, role, appUrl } = parsed.data;

    // --- Look up existing user by email ---
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();
    if (existingErr) {
      console.error("Profile lookup error:", existingErr);
    }

    if (existing?.id) {
      // Check whether they already have this role
      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", existing.id)
        .eq("role", role)
        .maybeSingle();

      if (existingRole) {
        return json({
          status: "role_already_present",
          userId: existing.id,
          message: "User already has this role.",
        });
      }

      const { error: assignErr } = await supabaseAdmin.rpc(
        "admin_assign_role",
        { _user_id: existing.id, _role: role }
      );
      if (assignErr) throw assignErr;

      await supabaseAdmin.rpc("log_user_activity", {
        _user_id: existing.id,
        _activity_type: "role_assigned",
        _activity_category: "security",
        _description: `Role '${role}' granted via admin invite flow (existing user)`,
        _metadata: { role, granted_by: user.id, source: "send-user-invitation" },
      });

      return json({
        status: "role_added_existing_user",
        userId: existing.id,
        message: `Role ${role} granted to existing user ${email}.`,
      });
    }

    // --- No existing user: reuse pending invite if one matches, otherwise create a new row ---
    const { data: existingPending } = await supabaseAdmin
      .from("user_invitations")
      .select("id, invitation_token, role, token_expires_at")
      .ilike("email", email)
      .eq("invitation_status", "pending")
      .maybeSingle();

    let invitationId: string;
    let invitationToken: string;

    if (existingPending) {
      // If same role, reuse the existing pending invite (refresh expiry + resend email).
      if (existingPending.role === role) {
        const { error: refreshErr } = await supabaseAdmin
          .from("user_invitations")
          .update({
            token_expires_at: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
            invited_by: user.id,
            invited_at: new Date().toISOString(),
          })
          .eq("id", existingPending.id);
        if (refreshErr) throw refreshErr;
        invitationId = existingPending.id;
        invitationToken = existingPending.invitation_token;
      } else {
        return json(
          {
            status: "pending_invite_exists_different_role",
            message: `A pending invitation already exists for ${email} with role '${existingPending.role}'. Revoke it before inviting with a different role.`,
          },
          409
        );
      }
    } else {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("user_invitations")
        .insert({
          email,
          role,
          invited_by: user.id,
        })
        .select("id, invitation_token")
        .single();
      if (insertErr || !inserted) throw insertErr ?? new Error("Insert failed");
      invitationId = inserted.id;
      invitationToken = inserted.invitation_token;
    }

    // --- Send email ---
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return json({
        status: "invited_no_email",
        invitationId,
        token: invitationToken,
        message:
          "Invitation saved, but email could not be sent (RESEND_API_KEY not configured).",
      });
    }

    const resend = new Resend(resendApiKey);
    const baseUrl =
      appUrl ??
      Deno.env.get("APP_URL") ??
      "https://doc-aga.goldenforage.com";
    const cleanBaseUrl = baseUrl.replace(/\/$/, "");
    const acceptUrl = Deno.env.get("UNIFIED_INVITE_FLOW") === "true"
      ? `${cleanBaseUrl}/invite/${invitationToken}`
      : `${cleanBaseUrl}/invite/user/${invitationToken}`;
    const { label, description } = roleCopy[role];

    const emailResponse = await resend.emails.send({
      from: "Doc Aga <updates@doc-aga.goldenforage.com>",
      reply_to: "support@goldenforage.com",
      to: [email],
      subject: `You've been invited to Doc Aga as a ${label}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Doc Aga Invitation</h1>
          <p>Hi there,</p>
          <p>You've been invited to join <strong>Doc Aga</strong> as a <strong>${label}</strong>.</p>
          <p>${description}</p>
          <div style="margin: 30px 0;">
            <a href="${acceptUrl}"
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            This invitation will expire in 7 days. If you don't have an account yet, you'll be able to create one when you accept.
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 40px;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${acceptUrl}" style="color: #2563eb;">${acceptUrl}</a>
          </p>
        </div>
      `,
    });

    console.log("Invitation email sent:", emailResponse);

    await supabaseAdmin.rpc("log_user_activity", {
      _user_id: user.id,
      _activity_type: "user_invitation_sent",
      _activity_category: "security",
      _description: `Invitation sent to ${email} for role '${role}'`,
      _metadata: {
        role,
        invited_email: email,
        invitation_id: invitationId,
      },
    });

    return json({
      status: "invited",
      invitationId,
      token: invitationToken,
      message: `Invitation sent to ${email}.`,
    });
  } catch (error) {
    console.error("send-user-invitation error:", error);
    const msg =
      error instanceof Error ? error.message : "Unknown error occurred";
    return json({ error: msg }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
