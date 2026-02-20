import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl px-4 py-16">
        <Button variant="ghost" size="sm" asChild className="mb-8">
          <Link to="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
            <p className="text-muted-foreground">We collect information you provide directly, including your email address and profile information. When you connect your email account, we access email content (sender, subject, body) solely to provide the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
            <p className="text-muted-foreground">We use your information to: provide and improve the Service; generate AI-powered email summaries and response suggestions; manage your account; and communicate with you about the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Email Data Processing</h2>
            <p className="text-muted-foreground">Email content is processed by our AI systems to generate summaries and suggested responses. We do not sell, share, or use your email content for advertising purposes. Email data is encrypted at rest and in transit.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Data Storage & Security</h2>
            <p className="text-muted-foreground">Your data is stored securely using industry-standard encryption. OAuth tokens used to access your email are encrypted using AES-256-GCM. We implement appropriate technical and organizational measures to protect your personal data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Google User Data — Sharing, Transfer & Disclosure</h2>
            <p className="text-muted-foreground mb-3">
              Inbox Pilot integrates with Google Gmail and Google Calendar via OAuth 2.0. We request only the following scopes, which are the minimum necessary to operate the Service:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mb-3">
              <li><strong>gmail.readonly</strong> — to read your emails and generate AI summaries and suggested responses.</li>
              <li><strong>gmail.send</strong> — to send emails on your behalf when you approve a suggested reply.</li>
              <li><strong>calendar.events</strong> — to create calendar events when you approve a meeting suggestion.</li>
            </ul>
            <p className="text-muted-foreground mb-3">
              <strong>We do not sell, share, transfer, or disclose Google user data to any third party</strong>, except in the following limited circumstances:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mb-3">
              <li><strong>AI Processing:</strong> Email content is sent to an AI model (OpenAI / Google) solely to generate summaries and reply suggestions. This data is not used for model training.</li>
              <li><strong>Legal requirements:</strong> We may disclose data if required by law or to protect the rights and safety of our users.</li>
            </ul>
            <p className="text-muted-foreground">
              Google user data is never used for advertising, profiling, or any purpose beyond providing the core features of Inbox Pilot. Our use of Google user data complies with the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="underline">Google API Services User Data Policy</a>, including the Limited Use requirements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
            <p className="text-muted-foreground">We retain your data for as long as your account is active. You can request deletion of your data at any time by deleting your account. Email data may be retained for a limited period for backup purposes.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
            <p className="text-muted-foreground">You have the right to: access your personal data; correct inaccurate data; request deletion of your data; disconnect your email account at any time; and export your data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Cookies</h2>
            <p className="text-muted-foreground">We use essential cookies for authentication and session management. We do not use tracking or advertising cookies.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Changes to This Policy</h2>
            <p className="text-muted-foreground">We may update this Privacy Policy from time to time. We will notify you of significant changes through the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Contact</h2>
            <p className="text-muted-foreground">If you have questions about this Privacy Policy, please contact us through the application.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
