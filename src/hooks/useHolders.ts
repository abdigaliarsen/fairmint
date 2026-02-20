"use client";

import { useState, useEffect, useCallback } from "react";
import type { FairScoreTier } from "@/types/database";

export interface HolderNode {
  owner: string;
  amount: number;
  percentage: number;
  fairScore: number | null;
  tier: FairScoreTier;
}

interface UseHoldersReturn {
  holders: HolderNode[];
  loading: boolean;
  error: string | null;
}

export function useHolders(mint: string, limit: number = 10): UseHoldersReturn {
  const [holders, setHolders] = useState<HolderNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHolders = useCallback(async () => {
    if (!mint) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/token/${encodeURIComponent(mint)}/holders?limit=${limit}`
      );

      if (!res.ok) {
        setError("Failed to fetch holders.");
        setHolders([]);
        return;
      }

      const json = await res.json();
      setHolders(json.holders ?? []);
    } catch {
      setError("An unexpected error occurred.");
      setHolders([]);
    } finally {
      setLoading(false);
    }
  }, [mint, limit]);

  useEffect(() => {
    fetchHolders();
  }, [fetchHolders]);

  return { holders, loading, error };
}
