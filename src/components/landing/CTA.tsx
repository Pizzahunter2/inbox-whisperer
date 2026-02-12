import { Button } from "@/components/ui/button";
import { ArrowRight, Crown } from "lucide-react";
import { Link } from "react-router-dom";

export function CTA() {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Main CTA card */}
          <div className="bg-card rounded-3xl p-12 shadow-xl border border-border">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
              <Crown className="w-4 h-4" />
              Start free, upgrade anytime
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ready to reclaim your inbox?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Get started with 5 free email analyses per day. Upgrade to Pro for unlimited analyses, AI compose, smart tags, and more.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="action" size="xl" asChild>
                <Link to="/signup">
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button variant="outline" size="xl" asChild>
                <Link to="/pricing">
                  Compare Plans
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
