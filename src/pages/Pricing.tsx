import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription, PLANS } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, ArrowLeft, Crown, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const features = {
  free: [
    "5 emails processed per day",
    "Basic AI classification",
    "Email queue dashboard",
    "Manual email processing",
  ],
  pro: [
    "Unlimited email processing",
    "Advanced AI classification & replies",
    "Priority processing speed",
    "Custom reply tone & signature",
    "Meeting slot suggestions",
    "Auto-archive newsletters",
    "Invoice flagging",
    "AI chat assistant",
    "Export data",
  ],
};

export default function Pricing() {
  const { user } = useAuth();
  const { subscribed, planName, checkSubscription } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleCheckout = async () => {
    if (!user) {
      navigate("/signup");
      return;
    }

    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: PLANS.pro.price_id },
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

        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free and upgrade when you need more power. Cancel anytime.
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Free Plan */}
          <Card className={`relative ${planName === "Free" && user ? "border-primary" : ""}`}>
            {planName === "Free" && user && (
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
                  {planName === "Free" ? "Current Plan" : "Downgrade via Portal"}
                </Button>
              )}
            </CardFooter>
          </Card>

          {/* Pro Plan */}
          <Card className={`relative border-2 ${planName === "Pro" ? "border-primary" : "border-accent"}`}>
            {planName === "Pro" ? (
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
                <span className="text-4xl font-bold text-foreground">$9.99</span>
                <span className="text-muted-foreground">/month</span>
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

        {/* Refresh button */}
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
