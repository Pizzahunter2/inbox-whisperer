import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Stripe product/price mapping
export const PLANS = {
  free: {
    name: "Free",
    price_monthly: 0,
    price_yearly: 0,
    price_id_monthly: null,
    price_id_yearly: null,
    product_id: null,
  },
  pro: {
    name: "Pro",
    price_monthly: 3.99,
    price_yearly: 37,
    price_id_monthly: "price_1T07S9J1XB1DUJf2Z1mrPong",
    price_id_yearly: "price_1T07SNJ1XB1DUJf2l9aaUXk5",
    product_id_monthly: "prod_Ty3ZJ5VIKBhiFW",
    product_id_yearly: "prod_Ty3ZCBq4ZavdSX",
  },
} as const;

// All pro product IDs for checking
export const PRO_PRODUCT_IDS = [PLANS.pro.product_id_monthly, PLANS.pro.product_id_yearly] as const;

interface SubscriptionState {
  subscribed: boolean;
  productId: string | null;
  subscriptionEnd: string | null;
  loading: boolean;
  planName: string;
  // For testing toggle
  testOverride: boolean | null;
}

interface SubscriptionContextType extends SubscriptionState {
  checkSubscription: () => Promise<void>;
  setTestOverride: (override: boolean | null) => void;
  isPro: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscribed: false,
  productId: null,
  subscriptionEnd: null,
  loading: true,
  planName: "Free",
  testOverride: null,
  checkSubscription: async () => {},
  setTestOverride: () => {},
  isPro: false,
});

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    subscribed: false,
    productId: null,
    subscriptionEnd: null,
    loading: true,
    planName: "Free",
    testOverride: null,
  });

  const checkSubscription = useCallback(async () => {
    if (!session) {
      setState(prev => ({ ...prev, subscribed: false, productId: null, subscriptionEnd: null, loading: false, planName: "Free" }));
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;

      const isPro = PRO_PRODUCT_IDS.includes(data?.product_id) || data?.product_id === "redeemed_pro";
      const planName = isPro ? "Pro" : "Free";

      setState(prev => ({
        ...prev,
        subscribed: data?.subscribed ?? false,
        productId: data?.product_id ?? null,
        subscriptionEnd: data?.subscription_end ?? null,
        loading: false,
        planName,
      }));
    } catch (err) {
      console.error("Error checking subscription:", err);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [session]);

  const setTestOverride = useCallback((override: boolean | null) => {
    setState(prev => ({ ...prev, testOverride: override }));
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [session, checkSubscription]);

  // Compute isPro considering test override
  const isPro = state.testOverride !== null ? state.testOverride : state.subscribed;

  return (
    <SubscriptionContext.Provider value={{ ...state, checkSubscription, setTestOverride, isPro }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
