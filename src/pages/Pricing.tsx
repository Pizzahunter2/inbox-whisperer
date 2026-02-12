import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription, PLANS } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, Loader2, ArrowLeft, Crown, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const features = {
  free: [
    "Read calendar",
    "Read email",
    "Summarize emails (5 per day)",
    "AI-generated responses (5 per day)",
    "Manual editing of AI responses",
    "Add events to calendar (limit 5)",
  ],
  pro: [
    "Read calendar",
    "Read email",
    "Summarize unlimited emails per day",
    "AI-generated responses (unlimited)",
    "Manual editing of AI responses",
    "Add events to calendar (no limit)",
    "Compose: AI-generated emails",
    "Reply preferences in settings",
    "Working hours in settings",
    "Automation rules in settings",
    "Categorize emails automatically",
    "Filter by categories",
    "Inbox Chat with calendar actions",
    "Automated event detection (flights, tickets, etc.)",
  ],
};

export default function Pricing() {
  const { user } = useAuth();
  const { subscribed, planName, isPro, checkSubscription, setTestOverride, testOverride } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");

  const priceId = billingInterval === "yearly" ? PLANS.pro.price_id_yearly : PLANS.pro.price_id_monthly;
  const displayPrice = billingInterval === "yearly" ? PLANS.pro.price_yearly : PLANS.pro.price_monthly;
  const intervalLabel = billingInterval === "yearly" ? "/year" : "/month";

  const handleCheckout = async () => {
    if (!user) {
      navigate("/signup");
      return;
    }

    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to start checkout", variant: "destructive" });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to open portal", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free and upgrade when you need more power. Cancel anytime.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={`text-sm font-medium ${billingInterval === "monthly" ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
          <Switch
            checked={billingInterval === "yearly"}
            onCheckedChange={(checked) => setBillingInterval(checked ? "yearly" : "monthly")}
          />
          <span className={`text-sm font-medium ${billingInterval === "yearly" ? "text-foreground" : "text-muted-foreground"}`}>
            Yearly
            <Badge variant="secondary" className="ml-2 text-xs">Save 23%</Badge>
          </span>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Free Plan */}
          <Card className={`relative ${planName === "Free" && user && !isPro ? "border-primary" : ""}`}>
            {planName === "Free" && user && !isPro && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                Your Plan
              </Badge>
            )}
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-muted-foreground" />
                Free
              </CardTitle>
              <CardDescription>For trying out Inbox Pilot</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-foreground">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {features.free.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {!user ? (
                <Button variant="outline" className="w-full" onClick={() => navigate("/signup")}>
                  Get Started
                </Button>
              ) : (
                <Button variant="outline" className="w-full" disabled>
                  {!isPro ? "Current Plan" : "Downgrade via Portal"}
                </Button>
              )}
            </CardFooter>
          </Card>

          {/* Pro Plan */}
          <Card className={`relative border-2 ${isPro ? "border-primary" : "border-accent"}`}>
            {isPro ? (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                Your Plan
              </Badge>
            ) : (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground">
                Recommended
              </Badge>
            )}
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-accent" />
                Pro
              </CardTitle>
              <CardDescription>For power users who want full automation</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-foreground">${displayPrice}</span>
                <span className="text-muted-foreground">{intervalLabel}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {features.pro.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {subscribed ? (
                <Button variant="outline" className="w-full" onClick={handleManageSubscription}>
                  Manage Subscription
                </Button>
              ) : (
                <Button variant="action" className="w-full" onClick={handleCheckout} disabled={checkoutLoading}>
                  {checkoutLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Starting checkout...</>
                  ) : (
                    "Upgrade to Pro"
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>

        {user && (
          <div className="text-center mt-8">
            <Button variant="ghost" size="sm" onClick={checkSubscription}>
              Refresh subscription status
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
