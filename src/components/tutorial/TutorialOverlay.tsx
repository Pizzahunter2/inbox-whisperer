import { useEffect } from "react";
import { useTutorial } from "@/hooks/useTutorial";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export function TutorialOverlay() {
  const { isActive, step, currentStep, totalSteps, nextStep, prevStep, endTutorial } = useTutorial();

  // Scroll to the target element when step changes
  useEffect(() => {
    if (!isActive || !step?.targetSelector) return;

    const timeout = setTimeout(() => {
      const el = document.querySelector(step.targetSelector!);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [isActive, currentStep, step?.targetSelector]);

  if (!isActive || !step) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[9999] bg-card border border-border rounded-xl shadow-2xl p-5 max-w-sm w-[90vw] animate-fade-in">
      <button
        onClick={endTutorial}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex gap-1 mb-3">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= currentStep ? "bg-accent" : "bg-muted"
            }`}
          />
        ))}
      </div>

      <h3 className="text-base font-semibold text-foreground mb-1.5">{step.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">{step.description}</p>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {currentStep + 1} / {totalSteps}
        </span>
        <div className="flex gap-2">
          {currentStep > 0 && (
            <Button variant="ghost" size="sm" onClick={prevStep}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          )}
          <Button variant="action" size="sm" onClick={currentStep === totalSteps - 1 ? endTutorial : nextStep}>
            {currentStep === totalSteps - 1 ? "Finish" : "Next"}
            {currentStep < totalSteps - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
