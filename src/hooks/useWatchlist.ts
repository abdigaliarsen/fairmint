"use client";

import { useState, useEffect, useCallback } from "react";
import type { FairScoreTier } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WatchlistEntityType = "token" | "wallet" | "deployer";

export interface WatchlistTokenInfo {
  name: string | null;
  symbol: string | null;
  trust_rating: number;
  deployer_tier: FairScoreTier | null;
}

export interface WatchlistWalletInfo {
  score: number;
  tier: FairScoreTier;
}

export interface WatchlistEntry {
  id: string;
  mint: string;
  entity_type: WatchlistEntityType;
  added_at: string;
  token: WatchlistTokenInfo | null;
  walletInfo: WatchlistWalletInfo | null;
}

interface UseWatchlistReturn {
  items: WatchlistEntry[];
  loading: boolean;
  addItem: (address: string, entityType?: WatchlistEntityType) => Promise<void>;
  removeItem: (address: string) => Promise<void>;
  /** @deprecated Use addItem instead */
  addToken: (tokenMint: string) => Promise<void>;
  /** @deprecated Use removeItem instead */
  removeToken: (tokenMint: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manage a wallet's watchlist via `/api/watchlist`.
 *
 * Returns `{ items, loading, addItem, removeItem, addToken, removeToken }`.
 */
export function useWatchlist(wallet: string | null): UseWatchlistReturn {
  const [items, setItems] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchWatchlist = useCallback(async (silent = false) => {
    if (!wallet) {
      setItems([]);
      return;
    }

    if (!silent) setLoading(true);
    try {
      const res = await fetch(
        `/api/watchlist?wallet=${encodeURIComponent(wallet)}`
      );
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      } else if (!silent) {
        setItems([]);
      }
    } catch {
      if (!silent) setItems([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const addItem = useCallback(
    async (address: string, entityType: WatchlistEntityType = "token") => {
      if (!wallet) return;

      try {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet, tokenMint: address, entityType }),
        });

        if (res.ok) {
          // Silent refetch to get enriched data without triggering loading state
          await fetchWatchlist(true);
        }
      } catch {
        // Silently fail — the UI will still show the current state
      }
    },
    [wallet, fetchWatchlist]
  );

  const removeItem = useCallback(
    async (address: string) => {
      if (!wallet) return;

      // Optimistic removal
      setItems((prev) => prev.filter((item) => item.mint !== address));

      try {
        const res = await fetch("/api/watchlist", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet, tokenMint: address }),
        });

        if (!res.ok) {
          // Revert on failure (silent to avoid skeleton flash)
          await fetchWatchlist(true);
        }
      } catch {
        await fetchWatchlist(true);
      }
    },
    [wallet, fetchWatchlist]
  );

  // Backwards-compatible aliases
  const addToken = useCallback(
    (tokenMint: string) => addItem(tokenMint, "token"),
    [addItem]
  );
  const removeToken = useCallback(
    (tokenMint: string) => removeItem(tokenMint),
    [removeItem]
  );

  return { items, loading, addItem, removeItem, addToken, removeToken };
}
