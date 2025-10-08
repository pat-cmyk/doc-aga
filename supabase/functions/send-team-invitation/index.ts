import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  membershipId: string;
  invitedEmail: string;
  farmName: string;
  inviterName: string;
  role: string;
  invitationToken: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      invitedEmail,
      farmName,
      inviterName,
      role,
      invitationToken,
    }: InvitationRequest = await req.json();

    console.log(`Sending invitation to ${invitedEmail} for farm ${farmName}`);

    const roleName = role === "farmer_owner" ? "Farm Manager" : "Farm Hand";
    const roleDescription =
      role === "farmer_owner"
        ? "You'll be able to manage animals and records."
        : "You'll have access to assigned animals.";

    const acceptUrl = `${supabaseUrl.replace(
      "supabase.co",
      "lovableproject.com"
    )}/invite/accept/${invitationToken}`;

    const emailResponse = await resend.emails.send({
      from: "GoldenForage <onboarding@resend.dev>",
      to: [invitedEmail],
      subject: `You've been invited to join ${farmName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Farm Team Invitation</h1>
          <p>Hi there!</p>
          <p><strong>${inviterName}</strong> has invited you to join <strong>${farmName}</strong> as a <strong>${roleName}</strong>.</p>
          <p>${roleDescription}</p>
          
          <div style="margin: 30px 0;">
            <a href="${acceptUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            This invitation will expire in 7 days. If you don't have an account yet, you'll be able to create one when you accept the invitation.
          </p>
          
          <p style="color: #999; font-size: 12px; margin-top: 40px;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${acceptUrl}" style="color: #2563eb;">${acceptUrl}</a>
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-team-invitation function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
