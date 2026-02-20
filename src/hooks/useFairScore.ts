"use client";

import { useState, useEffect, useCallback } from "react";
import type { FairScoreData } from "@/types/database";

interface UseFairScoreReturn {
  data: FairScoreData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetch the full FairScore profile for a wallet from `/api/fairscore`.
 *
 * Returns `{ data, loading, error }`.
 */
export function useFairScore(wallet: string | null): UseFairScoreReturn {
  const [data, setData] = useState<FairScoreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScore = useCallback(async () => {
    if (!wallet) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/fairscore?wallet=${encodeURIComponent(wallet)}`
      );

      if (res.status === 404) {
        // New / unrated wallet — not an error, just no data
        setData(null);
        return;
      }

      if (!res.ok) {
        setError("Failed to fetch FairScore.");
        setData(null);
        return;
      }

      const json = await res.json();
      setData(json as FairScoreData);
    } catch {
      setError("An unexpected error occurred.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  return { data, loading, error };
}
