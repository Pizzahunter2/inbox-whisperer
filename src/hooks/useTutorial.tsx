import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  route: string;
  /** CSS selector for the element to highlight. If null, show a centered modal. */
  targetSelector: string | null;
  placement: "top" | "bottom" | "left" | "right" | "center";
}

export const tutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Inbox Pilot! ✈️",
    description:
      "Let's take a quick tour of the app. We'll walk you through connecting your accounts and all the key features.",
    route: "/settings",
    targetSelector: null,
    placement: "center",
  },
  {
    id: "connect-accounts",
    title: "Connect Your Accounts",
    description:
      "First, connect your Gmail and Google Calendar here. This lets Inbox Pilot read your emails, send replies, and suggest meeting times based on your real availability.",
    route: "/settings",
    targetSelector: '[data-tutorial="connected-accounts"]',
    placement: "bottom",
  },
  {
    id: "reply-preferences",
    title: "Set Your Preferences",
    description:
      "Customize your reply tone, signature, working hours, and automation rules. These settings influence how AI drafts your emails.",
    route: "/settings",
    targetSelector: '[data-tutorial="reply-preferences"]',
    placement: "bottom",
  },
  {
    id: "action-queue",
    title: "Action Queue",
    description:
      "This is your main inbox view. Emails appear here with AI-generated summaries and proposed actions (Reply, Archive, Schedule, etc.). Click an email to see details and take action.",
    route: "/dashboard",
    targetSelector: null,
    placement: "center",
  },
  {
    id: "history",
    title: "History",
    description:
      "All emails you've already acted on appear here. You can review past actions, replies sent, and archived emails.",
    route: "/history",
    targetSelector: null,
    placement: "center",
  },
  {
    id: "inbox-chat",
    title: "Inbox Chat",
    description:
      "Chat with AI about your inbox! Ask questions like 'Summarize my unread emails' or 'Any urgent items?'. You can also ask the AI to compose a new email — it will open the Composer for you.",
    route: "/chat",
    targetSelector: null,
    placement: "center",
  },
  {
    id: "compose",
    title: "Compose Email",
    description:
      "Write new emails here. Use the AI Assistant to generate or refine drafts, and the 'Suggest Meeting Times' button to pull available slots from your Google Calendar into the email.",
    route: "/compose",
    targetSelector: null,
    placement: "center",
  },
  {
    id: "done",
    title: "You're All Set! 🎉",
    description:
      "That's the full tour! Start by connecting your Gmail in Settings, then head to the Action Queue to manage your inbox. You can replay this tutorial anytime from the Settings page.",
    route: "/compose",
    targetSelector: null,
    placement: "center",
  },
];

interface TutorialContextValue {
  isActive: boolean;
  currentStep: number;
  step: TutorialStep | null;
  totalSteps: number;
  startTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  endTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextValue>({
  isActive: false,
  currentStep: 0,
  step: null,
  totalSteps: tutorialSteps.length,
  startTutorial: () => {},
  nextStep: () => {},
  prevStep: () => {},
  endTutorial: () => {},
});

export function useTutorial() {
  return useContext(TutorialContext);
}

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  const step = isActive ? tutorialSteps[currentStep] ?? null : null;

  // Navigate to the step's route when step changes
  useEffect(() => {
    if (isActive && step && location.pathname !== step.route) {
      navigate(step.route);
    }
  }, [isActive, currentStep, step?.route]);

  const startTutorial = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      setIsActive(false);
    }
  }, [currentStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const endTutorial = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    // Mark tutorial as seen
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        localStorage.setItem(`tutorial_seen_${user.id}`, "true");
      }
    });
  }, []);

  return (
    <TutorialContext.Provider
      value={{
        isActive,
        currentStep,
        step,
        totalSteps: tutorialSteps.length,
        startTutorial,
        nextStep,
        prevStep,
        endTutorial,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}
