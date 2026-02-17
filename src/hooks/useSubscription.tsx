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

export const PRO_PRODUCT_IDS = [PLANS.pro.product_id_monthly, PLANS.pro.product_id_yearly] as const;

interface SubscriptionState {
  subscribed: boolean;
  productId: string | null;
  subscriptionEnd: string | null;
  loading: boolean;
  planName: string;
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

// Cache subscription result in sessionStorage to prevent flicker
const CACHE_KEY = "subscription_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedSubscription(): { subscribed: boolean; productId: string | null; subscriptionEnd: string | null } | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.ts > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function setCachedSubscription(data: { subscribed: boolean; productId: string | null; subscriptionEnd: string | null }) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, ts: Date.now() }));
  } catch { /* ignore */ }
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();

  // Initialize from cache to prevent Pro features flashing as locked
  const cached = getCachedSubscription();
  const [state, setState] = useState<SubscriptionState>({
    subscribed: cached?.subscribed ?? false,
    productId: cached?.productId ?? null,
    subscriptionEnd: cached?.subscriptionEnd ?? null,
    loading: !cached, // If cached, not loading
    planName: cached?.subscribed ? "Pro" : "Free",
    testOverride: null,
  });

  const checkSubscription = useCallback(async () => {
    if (!session) {
      setState(prev => ({ ...prev, subscribed: false, productId: null, subscriptionEnd: null, loading: false, planName: "Free" }));
      sessionStorage.removeItem(CACHE_KEY);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;

      const isPro = PRO_PRODUCT_IDS.includes(data?.product_id) || data?.product_id === "redeemed_pro";
      const planName = isPro ? "Pro" : "Free";
      const result = {
        subscribed: data?.subscribed ?? false,
        productId: data?.product_id ?? null,
        subscriptionEnd: data?.subscription_end ?? null,
      };

      setCachedSubscription(result);

      setState(prev => ({
        ...prev,
        ...result,
        loading: false,
        planName,
      }));
    } catch (err) {
      console.error("Error checking subscription:", err);
      // On error, keep previous state (don't reset to free) - just stop loading
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [session]);

  const setTestOverride = useCallback((override: boolean | null) => {
    setState(prev => ({ ...prev, testOverride: override }));
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Auto-refresh every 5 minutes (was 60s which was too aggressive)
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(checkSubscription, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [session, checkSubscription]);

  const isPro = state.testOverride !== null ? state.testOverride : state.subscribed;

  return (
    <SubscriptionContext.Provider value={{ ...state, checkSubscription, setTestOverride, isPro }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
