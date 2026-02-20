"use client";

import { useState, useEffect, useCallback } from "react";
import type { FairScoreTier, RiskFlag } from "@/types/database";

export interface DiscoverToken {
  mint: string;
  name: string | null;
  symbol: string | null;
  image_url: string | null;
  trust_rating: number;
  deployer_tier: FairScoreTier | null;
  holder_count: number;
  token_age_days: number | null;
  risk_flags: RiskFlag[];
  analyzed_at: string;
}

export type DiscoverTab = "trending" | "new" | "trusted";

export function useDiscover(tab: DiscoverTab, limit: number = 20) {
  const [tokens, setTokens] = useState<DiscoverToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/discover?tab=${tab}&limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setTokens(data.tokens ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setTokens([]);
    } finally {
      setLoading(false);
    }
  }, [tab, limit]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  return { tokens, loading, error, refetch: fetchTokens };
}
