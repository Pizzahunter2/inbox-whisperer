import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles, Calendar, Mail, Filter, Clock } from "lucide-react";

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

const proFeatures = [
  { icon: Sparkles, label: "Unlimited email analyses per day" },
  { icon: Calendar, label: "Unlimited calendar additions" },
  { icon: Mail, label: "AI-powered email composing & sending" },
  { icon: Filter, label: "Smart email categorization tags" },
  { icon: Clock, label: "Working hours & automation rules" },
];

export function UpgradeDialog({
  open,
  onOpenChange,
  title = "Upgrade to Pro",
  description = "You've reached the free plan limit. Upgrade to Pro for unlimited access.",
}: UpgradeDialogProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-2">
            <Crown className="w-7 h-7 text-accent" />
          </div>
          <DialogTitle className="text-center text-xl">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <p className="text-sm font-medium text-foreground">What you get with Pro:</p>
          <ul className="space-y-2.5">
            {proFeatures.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-accent" />
                </div>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
          <Button
            variant="action"
            className="flex-1 gap-2"
            onClick={() => {
              onOpenChange(false);
              navigate("/pricing");
            }}
          >
            <Crown className="w-4 h-4" />
            Upgrade — $3.99/mo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
