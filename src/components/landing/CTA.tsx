import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function CTA() {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Main CTA card */}
          <div className="bg-card rounded-3xl p-12 shadow-xl border border-border">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ready to reclaim your inbox?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Connect your Gmail, and Inbox Pilot handles the rest. Sign up in seconds and start saving hours every week.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Button variant="action" size="xl" asChild>
                <Link to="/signup">
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button variant="outline" size="xl" asChild>
                <Link to="/login">
                  Sign In
                </Link>
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Free forever for personal use. No credit card required.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
