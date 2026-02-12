import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Crown, Lock } from "lucide-react";

interface ProGateProps {
  children: ReactNode;
  /** Display mode: "page" blocks the entire page, "section" overlays a section */
  mode?: "page" | "section";
  /** Feature name shown in the upgrade prompt */
  feature?: string;
}

export function ProGate({ children, mode = "section", feature = "This feature" }: ProGateProps) {
  const { isPro } = useSubscription();
  const navigate = useNavigate();

  if (isPro) return <>{children}</>;

  if (mode === "page") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
              <Crown className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Pro Feature</h2>
            <p className="text-muted-foreground">
              {feature} is available on the Pro plan. Upgrade to unlock unlimited access.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                Go Back
              </Button>
              <Button variant="action" onClick={() => navigate("/pricing")} className="gap-2">
                <Crown className="w-4 h-4" />
                Upgrade to Pro
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Section mode - overlay on the section
  return (
    <div className="relative">
      <div className="opacity-30 pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
        <div className="text-center space-y-3 p-4">
          <Lock className="w-6 h-6 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-foreground">{feature} requires Pro</p>
          <Button variant="action" size="sm" onClick={() => navigate("/pricing")} className="gap-1.5">
            <Crown className="w-3.5 h-3.5" />
            Upgrade
          </Button>
        </div>
      </div>
    </div>
  );
}
