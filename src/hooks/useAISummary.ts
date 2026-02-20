"use client";

import { useCompletion } from "@ai-sdk/react";
import { useEffect, useRef } from "react";

interface UseAISummaryOptions {
  type: "token" | "deployer" | "reputation";
  context: Record<string, unknown> | null;
}

export function useAISummary({ type, context }: UseAISummaryOptions) {
  const hasFired = useRef(false);

  const { completion, isLoading, error, complete } = useCompletion({
    api: "/api/ai/summary",
    streamProtocol: "text",
  });

  useEffect(() => {
    if (!context || hasFired.current) return;
    hasFired.current = true;

    complete("", {
      body: { type, context },
    });
  }, [context, type, complete]);

  return { text: completion, loading: isLoading, error: !!error };
}
