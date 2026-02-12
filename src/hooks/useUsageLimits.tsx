import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";

const FREE_DAILY_LIMIT = 5;

interface UsageLimits {
  analysesUsed: number;
  calendarAddsUsed: number;
  analysesRemaining: number;
  calendarAddsRemaining: number;
  canAnalyze: boolean;
  canAddToCalendar: boolean;
  loading: boolean;
  incrementAnalyses: () => Promise<boolean>;
  incrementCalendarAdds: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useUsageLimits(): UsageLimits {
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const [analysesUsed, setAnalysesUsed] = useState(0);
  const [calendarAddsUsed, setCalendarAddsUsed] = useState(0);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  const fetchUsage = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("daily_usage")
        .select("analyses_count, calendar_adds_count")
        .eq("user_id", user.id)
        .eq("usage_date", today)
        .maybeSingle();

      setAnalysesUsed(data?.analyses_count ?? 0);
      setCalendarAddsUsed(data?.calendar_adds_count ?? 0);
    } catch (e) {
      console.error("Error fetching usage:", e);
    } finally {
      setLoading(false);
    }
  }, [user, today]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const incrementAnalyses = useCallback(async (): Promise<boolean> => {
    if (isPro) return true;
    if (!user) return false;
    if (analysesUsed >= FREE_DAILY_LIMIT) return false;

    try {
      // Upsert: increment or create
      const { data: existing } = await supabase
        .from("daily_usage")
        .select("id, analyses_count")
        .eq("user_id", user.id)
        .eq("usage_date", today)
        .maybeSingle();

      if (existing) {
        if (existing.analyses_count >= FREE_DAILY_LIMIT) return false;
        await supabase
          .from("daily_usage")
          .update({ analyses_count: existing.analyses_count + 1 })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("daily_usage")
          .insert({ user_id: user.id, usage_date: today, analyses_count: 1 });
      }

      setAnalysesUsed((prev) => prev + 1);
      return true;
    } catch (e) {
      console.error("Error incrementing analyses:", e);
      return false;
    }
  }, [isPro, user, analysesUsed, today]);

  const incrementCalendarAdds = useCallback(async (): Promise<boolean> => {
    if (isPro) return true;
    if (!user) return false;
    if (calendarAddsUsed >= FREE_DAILY_LIMIT) return false;

    try {
      const { data: existing } = await supabase
        .from("daily_usage")
        .select("id, calendar_adds_count")
        .eq("user_id", user.id)
        .eq("usage_date", today)
        .maybeSingle();

      if (existing) {
        if (existing.calendar_adds_count >= FREE_DAILY_LIMIT) return false;
        await supabase
          .from("daily_usage")
          .update({ calendar_adds_count: existing.calendar_adds_count + 1 })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("daily_usage")
          .insert({ user_id: user.id, usage_date: today, calendar_adds_count: 1 });
      }

      setCalendarAddsUsed((prev) => prev + 1);
      return true;
    } catch (e) {
      console.error("Error incrementing calendar adds:", e);
      return false;
    }
  }, [isPro, user, calendarAddsUsed, today]);

  const analysesRemaining = isPro ? Infinity : Math.max(0, FREE_DAILY_LIMIT - analysesUsed);
  const calendarAddsRemaining = isPro ? Infinity : Math.max(0, FREE_DAILY_LIMIT - calendarAddsUsed);

  return {
    analysesUsed,
    calendarAddsUsed,
    analysesRemaining,
    calendarAddsRemaining,
    canAnalyze: isPro || analysesUsed < FREE_DAILY_LIMIT,
    canAddToCalendar: isPro || calendarAddsUsed < FREE_DAILY_LIMIT,
    loading,
    incrementAnalyses,
    incrementCalendarAdds,
    refresh: fetchUsage,
  };
}
