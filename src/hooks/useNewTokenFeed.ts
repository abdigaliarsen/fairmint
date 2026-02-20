"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { DiscoverToken } from "@/hooks/useDiscover";
import type { FairScoreTier } from "@/types/database";

interface UseNewTokenFeedReturn {
  tokens: DiscoverToken[];
  loading: boolean;
  error: string | null;
  newCount: number;
  acknowledge: () => void;
  refetch: () => Promise<void>;
}

export function useNewTokenFeed(limit: number = 20): UseNewTokenFeedReturn {
  const [tokens, setTokens] = useState<DiscoverToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const initialLoadDone = useRef(false);

  const fetchInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/discover?tab=new&limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setTokens(data.tokens ?? []);
      initialLoadDone.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setTokens([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  useEffect(() => {
    const supabase = getSupabaseClient();

    const channel = supabase
      .channel("new_token_events_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "new_token_events" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const token: DiscoverToken = {
            mint: row.mint as string,
            name: (row.name as string) ?? null,
            symbol: (row.symbol as string) ?? null,
            image_url: (row.image_url as string) ?? null,
            trust_rating: (row.trust_rating as number) ?? 0,
            deployer_tier: (row.deployer_tier as FairScoreTier) ?? null,
            holder_count: 0,
            token_age_days: null,
            risk_flags: [],
            analyzed_at: row.analyzed ? (row.created_at as string) : null,
            source: (row.source as string) ?? undefined,
            created_at: (row.created_at as string) ?? undefined,
          };

          setTokens((prev) => {
            if (prev.some((t) => t.mint === token.mint)) return prev;
            return [token, ...prev];
          });

          if (initialLoadDone.current) {
            setNewCount((c) => c + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "new_token_events" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          setTokens((prev) =>
            prev.map((t) =>
              t.mint === (row.mint as string)
                ? {
                    ...t,
                    trust_rating: (row.trust_rating as number) ?? t.trust_rating,
                    deployer_tier: (row.deployer_tier as FairScoreTier) ?? t.deployer_tier,
                    name: (row.name as string) ?? t.name,
                    symbol: (row.symbol as string) ?? t.symbol,
                    image_url: (row.image_url as string) ?? t.image_url,
                    analyzed_at: row.analyzed ? (row.created_at as string) : null,
                  }
                : t
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const acknowledge = useCallback(() => {
    setNewCount(0);
  }, []);

  return { tokens, loading, error, newCount, acknowledge, refetch: fetchInitial };
}
