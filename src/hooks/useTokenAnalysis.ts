"use client";

import { useState, useEffect, useCallback } from "react";
import type { TrustAnalysis } from "@/services/tokenAnalyzer";

interface UseTokenAnalysisReturn {
  data: TrustAnalysis | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetch a full token trust analysis from `/api/token/[mint]`.
 *
 * Returns `{ data, loading, error, refetch }`.
 */
export function useTokenAnalysis(mint: string): UseTokenAnalysisReturn {
  const [data, setData] = useState<TrustAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async () => {
    if (!mint) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/token/${encodeURIComponent(mint)}`);

      if (res.status === 404) {
        setError("Token not found. Please check the mint address and try again.");
        setData(null);
        return;
      }

      if (!res.ok) {
        setError("Failed to fetch token analysis. Please try again later.");
        setData(null);
        return;
      }

      const json = await res.json();
      setData(json as TrustAnalysis);
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [mint]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  return { data, loading, error, refetch: fetchAnalysis };
}
