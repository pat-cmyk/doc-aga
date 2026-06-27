import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RouteSeo } from "@/components/seo/RouteSeo";

// Fixed revision date — bump this whenever the policy text actually changes.
const LAST_UPDATED = "June 27, 2026";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <RouteSeo
        title="Privacy Policy | Doc Aga"
        description="How Doc Aga collects, uses, shares, and protects farm and user data across our livestock management platform."
        path="/privacy"
      />

      <div className="max-w-3xl mx-auto">
        <Link to="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Return to Home
          </Button>
        </Link>

        <Card>
          <CardContent className="p-6 md:p-8 space-y-8">
            <div className="text-center border-b border-border pb-6">
              <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy for Doc Aga</h1>
              <p className="text-muted-foreground">Last updated: {LAST_UPDATED}</p>
            </div>

            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-muted-foreground">
              <strong className="text-foreground">Note:</strong> This policy describes how the
              app actually handles data, but it is a working draft and not legal advice.
              Golden Forage should have it reviewed by legal counsel for GDPR, CCPA, and
              Philippine Data Privacy Act (RA 10173) compliance before relying on it.
            </div>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                Doc Aga ("we," "our," or "us"), operated by Golden Forage, provides an
                offline-first livestock farm management platform. This Privacy Policy explains
                what information we collect, how we use and share it, who processes it on our
                behalf, and the choices and rights you have. By using Doc Aga you agree to this
                policy.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">2. Information We Collect</h2>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-foreground">Account &amp; identity</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Name, email address, and phone number</li>
                  <li>Password (hashed and managed by our authentication provider; we never see it in plain text)</li>
                  <li>Your role(s) and farm/cooperative memberships</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-foreground">Farm &amp; location data</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Farm name and <strong>precise GPS location</strong></li>
                  <li>Animal records (IDs, breeds, birth dates, health, breeding, weight, milk)</li>
                  <li>Inventory, feeding, and financial records</li>
                  <li>Photos of animals, farms, and receipts</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-foreground">Voice data</h3>
                <p className="text-muted-foreground">
                  If you use voice features (voice-to-text logging, voice training, or talking to
                  Doc Aga), we collect <strong>audio recordings</strong> and their transcripts.
                  Audio is sent to our speech provider for transcription and may be stored to
                  improve recognition of your voice. You can clear your voice training data at any
                  time from your Profile.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-foreground">AI assistant content</h3>
                <p className="text-muted-foreground">
                  Questions and content you send to the Doc Aga or RICO AI assistants, along with
                  relevant farm context, are processed by our AI provider to generate responses.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-foreground">Technical &amp; usage data</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Authentication and activity logs, including IP address and device/user-agent</li>
                  <li>Device permissions you grant (camera, microphone, location)</li>
                </ul>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">3. How We Use Your Information</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li><strong>To provide the service:</strong> create your account, store and sync your farm records across devices, and power voice and AI features.</li>
                <li><strong>To keep it secure:</strong> authentication, abuse/bot prevention, rate limiting, and audit logging.</li>
                <li><strong>To improve the app:</strong> diagnose bugs and understand usage.</li>
                <li><strong>To communicate:</strong> administrative emails such as invitations, password resets, and notifications. We do not sell your personal information.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">4. Sharing With Government Programs</h2>
              <p className="text-muted-foreground leading-relaxed">
                Doc Aga includes a "Boses ng Magsasaka" (Farmer Voice) feature that lets you send
                feedback to Philippine government agencies (e.g., the Department of Agriculture /
                National Dairy Authority). When you submit feedback, authorized government and
                administrator users may see your message, its analysis, and your farm's location.
                Unless you choose to submit <strong>anonymously</strong>, your identity may also be
                visible to them. Aggregated, regional farm statistics may likewise be visible to
                government users.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">5. Third-Party Processors (Subprocessors)</h2>
              <p className="text-muted-foreground leading-relaxed">
                We rely on the following service providers, who process data on our behalf:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li><strong>Supabase</strong> (via Lovable Cloud) — database, authentication, and file storage</li>
                <li><strong>Lovable AI Gateway</strong> — AI processing for the Doc Aga and RICO assistants and feedback analysis</li>
                <li><strong>ElevenLabs</strong> — speech-to-text and text-to-speech for voice features</li>
                <li><strong>Mapbox</strong> — maps for farm and regional views</li>
                <li><strong>Cloudflare (Turnstile)</strong> — bot protection on public forms</li>
                <li><strong>Resend</strong> — sending transactional emails</li>
                <li><strong>Google Play Services / app stores</strong> — app distribution</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">6. International Data Transfers</h2>
              <p className="text-muted-foreground leading-relaxed">
                Some of the providers above are located outside the Philippines (for example, in
                the United States). This means your information may be transferred to and processed
                in other countries with different data-protection laws.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">7. Cookies &amp; On-Device Storage</h2>
              <p className="text-muted-foreground leading-relaxed">
                As an offline-first app, Doc Aga stores data on your device using browser storage
                (IndexedDB and localStorage) — including a cached copy of your farm data and your
                preferences — so the app works without a connection. This stays on your device and
                is not shared except through the syncs described above. You can clear it from your
                Profile (Cache Settings) or via your browser/app settings.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">8. Your Rights &amp; Choices</h2>
              <p className="text-muted-foreground leading-relaxed">
                Depending on your jurisdiction (e.g., GDPR, CCPA, RA 10173), you may have the rights
                below. You can exercise the first three yourself in the app:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li><strong>Access &amp; portability:</strong> Profile → "Export my data" downloads a JSON copy of your data.</li>
                <li><strong>Erasure:</strong> Profile → "Delete my account" permanently removes your account, owned farms, and personal data.</li>
                <li><strong>Rectification:</strong> update your name, phone, and records directly in the app.</li>
                <li><strong>Objection / restriction:</strong> contact us using the details below.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">9. Data Storage &amp; Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your data is stored on managed cloud infrastructure with row-level security,
                encrypted transport (HTTPS), role-based access controls, and audit logging. No
                method of transmission or storage is 100% secure, and we cannot guarantee absolute
                security.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">10. Data Retention &amp; Deletion</h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your personal and farm data for as long as your account is active. When
                you delete your account (Profile → "Delete my account"), we delete your account,
                the farms you own — including their animals and records — and your personal data.
                Some minimal records may be retained where required by law.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">11. Children's Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our Service is not directed to anyone under the age of 13, and we do not knowingly
                collect personal information from children under 13.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">12. Changes to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. We will post the updated policy
                on this page and revise the "Last updated" date above.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">13. Contact Us</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li><strong>Email:</strong> grow@goldenforage.com</li>
                <li><strong>Operator:</strong> Golden Forage</li>
              </ul>
            </section>

            <div className="pt-6 border-t border-border text-center">
              <Link to="/">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Return to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
