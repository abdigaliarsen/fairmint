"use client";

import { useState } from "react";
import Link from "next/link";
import { Crown, ExternalLink, Clock, Activity, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import { useWalletLeaderboard } from "@/hooks/useWalletLeaderboard";
import type { FairScoreTier } from "@/types/database";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDays(days: number): string {
  if (days >= 365) return `${(days / 365).toFixed(1)}y`;
  if (days >= 30) return `${Math.round(days / 30)}mo`;
  return `${days}d`;
}

// ---------------------------------------------------------------------------
// Filter buttons
// ---------------------------------------------------------------------------

const TIER_FILTERS: Array<{ label: string; value: string | undefined }> = [
  { label: "All", value: undefined },
  { label: "Platinum", value: "platinum" },
  { label: "Gold", value: "gold" },
  { label: "Silver", value: "silver" },
];

// ---------------------------------------------------------------------------
// Wallets Page
// ---------------------------------------------------------------------------

export default function WalletsPage() {
  const [tierFilter, setTierFilter] = useState<string | undefined>(undefined);
  const { wallets, loading } = useWalletLeaderboard(tierFilter, 30);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Crown className="size-6 text-yellow-500" />
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Trusted Wallets
          </h1>
        </div>
        <p className="text-muted-foreground">
          Top Solana wallets ranked by FairScale reputation score.
        </p>
      </div>

      {/* Tier filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TIER_FILTERS.map((filter) => (
          <Button
            key={filter.label}
            variant={tierFilter === filter.value ? "default" : "outline"}
            size="sm"
            onClick={() => setTierFilter(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* Leaderboard */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : wallets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No wallets found for the selected filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leaderboard</CardTitle>
            <CardDescription>
              {wallets.length} wallet{wallets.length !== 1 ? "s" : ""} ranked by
              FairScale score
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {wallets.map((wallet, index) => {
                const tierColors = getTierColor(wallet.tier as FairScoreTier);
                return (
                  <Link
                    key={wallet.wallet}
                    href={`/reputation/${wallet.wallet}`}
                    className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50 sm:px-6"
                  >
                    {/* Rank */}
                    <span className="w-8 shrink-0 text-center text-sm font-bold text-muted-foreground">
                      #{index + 1}
                    </span>

                    {/* Score circle */}
                    <div
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold",
                        tierColors.bg,
                        tierColors.border,
                        tierColors.text
                      )}
                    >
                      {Math.min(
                        100,
                        Math.round((wallet.score / 1000) * 100)
                      )}
                    </div>

                    {/* Wallet info */}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-sm font-medium text-foreground">
                          {truncateAddress(wallet.wallet)}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs capitalize",
                            tierColors.text
                          )}
                        >
                          {wallet.tier}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {wallet.walletAgeDays != null && (
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {formatDays(wallet.walletAgeDays)}
                          </span>
                        )}
                        {wallet.txCount != null && (
                          <span className="flex items-center gap-1">
                            <Hash className="size-3" />
                            {wallet.txCount.toLocaleString()} txns
                          </span>
                        )}
                        {wallet.activeDays != null && (
                          <span className="flex items-center gap-1">
                            <Activity className="size-3" />
                            {wallet.activeDays} active days
                          </span>
                        )}
                      </div>
                    </div>

                    {/* View profile link */}
                    <ExternalLink className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Powered by FairScale
      </p>
    </div>
  );
}
