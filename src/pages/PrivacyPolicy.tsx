import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PrivacyPolicy = () => {
  const lastUpdated = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="min-h-screen bg-background py-8 px-4">
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
              <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy for Doc-Aga</h1>
              <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
            </div>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                Welcome to Doc-Aga ("we," "our," or "us"). We are committed to protecting your privacy. 
                This Privacy Policy explains how our mobile application collects, uses, and safeguards 
                your information when you use our farm management services.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                By using Doc-Aga, you agree to the collection and use of information in accordance with this policy.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">2. Information We Collect</h2>
              <p className="text-muted-foreground leading-relaxed">
                We collect the following types of information to provide and improve our Service:
              </p>
              
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-foreground">Personal Information</h3>
                <p className="text-muted-foreground">When you create an account, we may ask for personal details such as:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Your Name</li>
                  <li>Email Address</li>
                  <li>Password (encrypted and secured)</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-foreground">Farm and Operational Data</h3>
                <p className="text-muted-foreground">To function as a management tool, we store data you input, including:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Farm Name and Location</li>
                  <li>Animal records (IDs, breeds, birth dates, health records)</li>
                  <li>Inventory details (feeds, quantities)</li>
                  <li>Activity logs (feeding, treatments)</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-foreground">Device Permissions</h3>
                <p className="text-muted-foreground">Our app may request access to certain device features to enhance functionality:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li><strong>Camera & Photos:</strong> To allow you to upload photos of your animals or farm receipts.</li>
                  <li><strong>Microphone:</strong> To enable voice command features or voice-to-text logging.</li>
                  <li><strong>Location:</strong> To help localize your farm data or provide weather-related insights.</li>
                </ul>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">3. How We Use Your Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                We use the collected data for the following purposes:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li><strong>To Provide the Service:</strong> Creating your account, storing your farm records, and allowing you to access them across devices.</li>
                <li><strong>To Improve the App:</strong> Analyzing usage trends to fix bugs and develop new features.</li>
                <li><strong>Communication:</strong> Sending you administrative emails (e.g., password resets, account notifications). We do not sell your email address to third parties.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">4. Data Storage and Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your data is securely stored on cloud servers (e.g., Supabase, Google Cloud). We implement 
                industry-standard security measures to protect your personal information from unauthorized 
                access, alteration, or disclosure. However, no method of transmission over the internet 
                is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">5. Third-Party Services</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may use third-party services that may collect information used to identify you. 
                Services used by the app include:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Google Play Services</li>
                <li>Supabase (Database and Authentication)</li>
                <li>Mapbox (Mapping Services)</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">6. Data Retention and Deletion</h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your personal information and farm data for as long as your account is active.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                <strong>Account Deletion:</strong> You have the right to request the deletion of your account 
                and all associated data. You may do this within the app settings or by contacting us at the 
                email below. Upon request, we will permanently delete your data from our servers.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">7. Children's Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our Service is not directed to anyone under the age of 13. We do not knowingly collect 
                personally identifiable information from children under 13.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">8. Changes to This Privacy Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update our Privacy Policy from time to time. We will notify you of any changes by 
                posting the new Privacy Policy on this page. You are advised to review this page periodically 
                for any changes.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">9. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions or suggestions about our Privacy Policy, do not hesitate to contact us at:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li><strong>Email:</strong> support@goldenforage.com</li>
                <li><strong>Developer:</strong> Golden Forage</li>
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
