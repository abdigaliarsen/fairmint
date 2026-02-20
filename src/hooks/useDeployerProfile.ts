"use client";

import { useState, useEffect, useCallback } from "react";
import type { FairScoreTier, Badge, FairScaleAction } from "@/types/database";
import type { Recommendation } from "@/lib/recommendations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeployedToken {
  mint: string;
  name: string | null;
  symbol: string | null;
  image_url: string | null;
  trust_rating: number;
  deployer_score: number | null;
  deployer_tier: FairScoreTier | null;
  holder_count: number;
  analyzed_at: string;
}

interface FairScoreInfo {
  score: number;
  integerScore: number;
  tier: FairScoreTier;
  badges: Badge[];
  actions?: FairScaleAction[];
  updatedAt: string;
}

export interface DeployerProfile {
  wallet: string;
  fairScore: FairScoreInfo | null;
  recommendations: Recommendation[];
  deployedTokens: DeployedToken[];
  tokenCount: number;
}

interface UseDeployerProfileReturn {
  data: DeployerProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetch a deployer profile from `/api/deployer/[wallet]`.
 *
 * Returns `{ data, loading, error, refetch }`.
 */
export function useDeployerProfile(
  wallet: string
): UseDeployerProfileReturn {
  const [data, setData] = useState<DeployerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!wallet) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/deployer/${encodeURIComponent(wallet)}`);

      if (res.status === 400) {
        setError("Invalid wallet address.");
        setData(null);
        return;
      }

      if (!res.ok) {
        setError("Failed to fetch deployer profile. Please try again later.");
        setData(null);
        return;
      }

      const json = await res.json();
      setData(json as DeployerProfile);
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { data, loading, error, refetch: fetchProfile };
}
