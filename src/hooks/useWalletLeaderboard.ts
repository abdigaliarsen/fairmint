"use client";

import { useState, useEffect, useCallback } from "react";
import type { FairScoreTier, Badge } from "@/types/database";

export interface LeaderboardWallet {
  wallet: string;
  score: number;
  tier: FairScoreTier;
  badges: Badge[];
  walletAgeDays: number | null;
  txCount: number | null;
  activeDays: number | null;
  fetchedAt: string;
}

export function useWalletLeaderboard(tier?: string, limit: number = 20) {
  const [wallets, setWallets] = useState<LeaderboardWallet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWallets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (tier) params.set("tier", tier);
      const res = await fetch(`/api/wallets?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setWallets(data.wallets ?? []);
    } catch {
      setWallets([]);
    } finally {
      setLoading(false);
    }
  }, [tier, limit]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  return { wallets, loading, refetch: fetchWallets };
}
