"use client";

import { useState, useCallback, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Scale } from "lucide-react";
import ComparisonSlot from "@/components/features/ComparisonSlot";
import { useFairScore } from "@/hooks/useFairScore";
import { cn } from "@/lib/utils";
import type { TrustAnalysis } from "@/services/tokenAnalyzer";
import type { FairScoreTier } from "@/types/database";

function getMaxSlots(tier: FairScoreTier): number {
  switch (tier) {
    case "gold":
    case "platinum":
      return 4;
    case "silver":
      return 3;
    default:
      return 2;
  }
}

export default function ComparePage() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const { data: fairScore } = useFairScore(walletAddress);

  const currentTier: FairScoreTier = fairScore?.tier ?? "unrated";
  const maxSlots = getMaxSlots(currentTier);

  const [tokens, setTokens] = useState<(TrustAnalysis | null)[]>(
    Array(2).fill(null)
  );
  const [loadingSlots, setLoadingSlots] = useState<boolean[]>(
    Array(2).fill(false)
  );

  // Adjust slot count when tier changes
  useEffect(() => {
    setTokens((prev) => {
      if (prev.length === maxSlots) return prev;
      if (prev.length < maxSlots) {
        return [...prev, ...Array(maxSlots - prev.length).fill(null)];
      }
      return prev.slice(0, maxSlots);
    });
    setLoadingSlots((prev) => {
      if (prev.length === maxSlots) return prev;
      if (prev.length < maxSlots) {
        return [...prev, ...Array(maxSlots - prev.length).fill(false)];
      }
      return prev.slice(0, maxSlots);
    });
  }, [maxSlots]);

  const handleSelect = useCallback(
    async (slotIndex: number, mint: string) => {
      setLoadingSlots((prev) => {
        const next = [...prev];
        next[slotIndex] = true;
        return next;
      });

      try {
        const res = await fetch(
          `/api/compare?mints=${encodeURIComponent(mint)}`
        );
        if (res.ok) {
          const data = await res.json();
          const token = data.tokens?.[0] ?? null;
          setTokens((prev) => {
            const next = [...prev];
            next[slotIndex] = token;
            return next;
          });
        }
      } catch {
        // keep slot empty on error
      } finally {
        setLoadingSlots((prev) => {
          const next = [...prev];
          next[slotIndex] = false;
          return next;
        });
      }
    },
    []
  );

  const handleRemove = useCallback((slotIndex: number) => {
    setTokens((prev) => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
  }, []);

  // Determine winner (highest trust rating among filled slots)
  const filledTokens = tokens.filter(Boolean) as TrustAnalysis[];
  const highestRating =
    filledTokens.length >= 2
      ? Math.max(...filledTokens.map((t) => t.trustRating))
      : -1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
          <Scale className="size-7 text-emerald-600" />
          Token Comparison
        </h1>
        <p className="text-sm text-muted-foreground">
          Compare tokens side-by-side. {maxSlots} slots available for your{" "}
          <span className="font-medium capitalize">{currentTier}</span> tier.
          {currentTier !== "gold" && currentTier !== "platinum" && (
            <span>
              {" "}
              Upgrade your FairScale reputation to unlock more slots.
            </span>
          )}
        </p>
      </div>

      <div
        className={cn(
          "mx-auto grid gap-6",
          maxSlots === 2 && "max-w-3xl grid-cols-1 sm:grid-cols-2",
          maxSlots === 3 && "max-w-4xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          maxSlots === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        )}
      >
        {tokens.slice(0, maxSlots).map((token, i) => (
          <ComparisonSlot
            key={i}
            token={token}
            loading={loadingSlots[i]}
            isWinner={
              token !== null &&
              filledTokens.length >= 2 &&
              token.trustRating === highestRating
            }
            onSelect={(mint) => handleSelect(i, mint)}
            onRemove={() => handleRemove(i)}
          />
        ))}
      </div>
    </div>
  );
}
