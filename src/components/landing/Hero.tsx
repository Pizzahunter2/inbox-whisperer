import { Button } from "@/components/ui/button";
import { ArrowRight, Mail, Sparkles, CheckCircle, Zap, Shield } from "lucide-react";
import { Link } from "react-router-dom";

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center gradient-hero overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-accent/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
      </div>
      
      <div className="container relative z-10 px-4 py-20">
        <div className="max-w-4xl mx-auto text-center text-primary-foreground">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 border border-primary-foreground/20 mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium">AI-powered email management</span>
          </div>
          
          {/* Main headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Your inbox,
            <br />
            <span className="text-accent">on autopilot</span>
          </h1>
          
          {/* Subheadline */}
          <p className="text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            Inbox Pilot reads, summarizes, and drafts replies to your emails. 
            Smart categorization, calendar integration, and AI compose—all in one place.
          </p>
          
          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <Button variant="hero" size="xl" asChild>
              <Link to="/signup">
                Start Free
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="heroOutline" size="xl" asChild>
              <Link to="/pricing">
                View Plans
              </Link>
            </Button>
          </div>
          
          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-primary-foreground/60 text-sm animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              <span>5 free analyses per day</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-accent" />
              <span>Works with Gmail</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" />
              <span>Privacy-first design</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Decorative email icons */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-6 opacity-20">
        <Mail className="w-8 h-8 text-primary-foreground animate-bounce" style={{ animationDelay: '0s' }} />
        <Mail className="w-6 h-6 text-primary-foreground animate-bounce" style={{ animationDelay: '0.2s' }} />
        <Mail className="w-10 h-10 text-primary-foreground animate-bounce" style={{ animationDelay: '0.4s' }} />
      </div>
    </section>
  );
}
