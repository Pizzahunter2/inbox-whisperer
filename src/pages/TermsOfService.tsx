import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl px-4 py-16">
        <Button variant="ghost" size="sm" asChild className="mb-8">
          <Link to="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">By accessing or using Inbox Pilot ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground">Inbox Pilot is an AI-powered email management tool that reads, summarizes, and proposes responses to your emails. The Service integrates with your email provider to process messages on your behalf.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
            <p className="text-muted-foreground">You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate and complete information when creating an account.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Email Access & Processing</h2>
            <p className="text-muted-foreground">By connecting your email account, you grant Inbox Pilot permission to read, process, and respond to emails on your behalf as directed by you. You retain ownership of all email content. AI-generated responses are suggestions only — you are responsible for reviewing and approving any actions taken.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Acceptable Use</h2>
            <p className="text-muted-foreground">You agree not to use the Service to: send spam or unsolicited messages; violate any applicable laws or regulations; impersonate any person or entity; or interfere with the operation of the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Limitation of Liability</h2>
            <p className="text-muted-foreground">The Service is provided "as is" without warranties of any kind. Inbox Pilot shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service, including any actions taken by AI-generated responses that you approved.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Termination</h2>
            <p className="text-muted-foreground">We reserve the right to suspend or terminate your account at any time for violations of these Terms. You may delete your account at any time through the Settings page.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Changes to Terms</h2>
            <p className="text-muted-foreground">We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the revised Terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Contact</h2>
            <p className="text-muted-foreground">If you have questions about these Terms, please contact us through the application.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
