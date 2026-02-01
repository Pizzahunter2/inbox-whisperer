import { Brain, MousePointerClick, Send, Inbox, Calendar, Zap } from "lucide-react";

const steps = [
  {
    icon: Brain,
    title: "AI Reads",
    description: "Every email gets summarized, categorized, and analyzed. Meeting requests, action items, newsletters—all sorted automatically.",
    color: "text-info",
    bgColor: "bg-info/10",
  },
  {
    icon: MousePointerClick,
    title: "You Approve",
    description: "Review simple cards instead of full emails. See the summary, proposed action, and draft reply. One glance tells you everything.",
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    icon: Send,
    title: "It Replies",
    description: "Accept the AI draft, tweak it if needed, or decline. Responses go out in your voice. You stay in control, just faster.",
    color: "text-success",
    bgColor: "bg-success/10",
  },
];

const additionalFeatures = [
  {
    icon: Inbox,
    title: "Smart Categorization",
    description: "Meeting requests, invoices, newsletters—automatically tagged and prioritized.",
  },
  {
    icon: Calendar,
    title: "Calendar Aware",
    description: "Meeting requests get time slot suggestions based on your real availability.",
  },
  {
    icon: Zap,
    title: "Instant Actions",
    description: "Archive newsletters, flag invoices, schedule meetings—all with one click.",
  },
];

export function Features() {
  return (
    <section className="py-24 bg-background">
      <div className="container px-4">
        {/* Main 3-step flow */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Email management in three steps
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Stop spending hours reading emails. Let AI do the heavy lifting while you focus on decisions.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {steps.map((step, index) => (
            <div 
              key={step.title}
              className="relative group"
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-full w-full h-0.5 bg-border -translate-x-1/2 z-0" />
              )}
              
              <div className="relative z-10 flex flex-col items-center text-center p-8 rounded-2xl bg-card shadow-card hover:shadow-card-hover transition-all duration-300 border border-border">
                {/* Step number */}
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </div>
                
                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl ${step.bgColor} flex items-center justify-center mb-6`}>
                  <step.icon className={`w-8 h-8 ${step.color}`} />
                </div>
                
                {/* Content */}
                <h3 className="text-xl font-semibold text-foreground mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
        
        {/* Additional features */}
        <div className="border-t border-border pt-16">
          <h3 className="text-2xl font-semibold text-center text-foreground mb-12">
            Plus, powerful features
          </h3>
          
          <div className="grid sm:grid-cols-3 gap-6">
            {additionalFeatures.map((feature) => (
              <div 
                key={feature.title}
                className="flex items-start gap-4 p-6 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
