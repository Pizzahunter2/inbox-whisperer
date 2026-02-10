import { useEffect, useState, useRef } from "react";
import { useTutorial } from "@/hooks/useTutorial";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export function TutorialOverlay() {
  const { isActive, step, currentStep, totalSteps, nextStep, prevStep, endTutorial } = useTutorial();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !step?.targetSelector) {
      setTargetRect(null);
      return;
    }

    // Wait a tick for the DOM to render after navigation
    const timeout = setTimeout(() => {
      const el = document.querySelector(step.targetSelector!);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setTargetRect(null);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [isActive, step?.targetSelector, currentStep]);

  if (!isActive || !step) return null;

  const isCenter = !step.targetSelector || !targetRect;

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[9999]">
      {/* Backdrop */}
      {isCenter ? (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      ) : (
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <mask id="tutorial-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={targetRect!.left - 8}
                y={targetRect!.top - 8}
                width={targetRect!.width + 16}
                height={targetRect!.height + 16}
                rx="12"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.6)"
            mask="url(#tutorial-mask)"
          />
        </svg>
      )}

      {/* Tooltip card */}
      <div
        className={`absolute bg-card border border-border rounded-xl shadow-2xl p-5 max-w-sm w-[90vw] ${
          isCenter
            ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            : ""
        }`}
        style={
          !isCenter && targetRect
            ? {
                top: targetRect.bottom + 16,
                left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 400)),
              }
            : undefined
        }
      >
        {/* Close */}
        <button
          onClick={endTutorial}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Progress */}
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

        {/* Navigation */}
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
    </div>
  );
}
