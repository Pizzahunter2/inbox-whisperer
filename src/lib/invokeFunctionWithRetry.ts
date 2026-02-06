import { supabase } from "@/integrations/supabase/client";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type InvokeOptions<TBody> = {
  body?: TBody;
  /** Total retries after the first attempt. */
  retries?: number;
  /** Base delay in ms for backoff. */
  baseDelayMs?: number;
};

/**
 * Wraps supabase.functions.invoke with small retry/backoff for transient network/preflight hiccups.
 */
export async function invokeFunctionWithRetry<TData = any, TBody = any>(
  functionName: string,
  options: InvokeOptions<TBody> = {}
): Promise<{ data: TData | null; error: any | null }> {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 500;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: options.body,
    });

    if (!error) return { data: data as TData, error: null };

    const msg = String((error as any)?.message || "");
    const isFetchError =
      (error as any)?.name === "FunctionsFetchError" ||
      msg.includes("Failed to send a request") ||
      msg.includes("Failed to fetch");

    if (!isFetchError || attempt === retries) return { data: null, error };

    // Quadratic-ish backoff: 0.5s, 2.0s, 4.5s ...
    const delay = baseDelayMs * Math.pow(attempt + 1, 2);
    await sleep(delay);
  }

  return { data: null, error: new Error("Failed to call backend function") };
}
