"use client";

import Link from "next/link";
import { ShieldCheck, User, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import type { WatchlistEntry } from "@/hooks/useWatchlist";
import type { FairScoreTier } from "@/types/database";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getEntityHref(entry: WatchlistEntry): string {
  switch (entry.entity_type) {
    case "wallet":
      return `/reputation/${entry.mint}`;
    case "deployer":
      return `/deployer/${entry.mint}`;
    default:
      return `/token/${entry.mint}`;
  }
}

function getTrustBadgeStyle(rating: number): { className: string; label: string } {
  if (rating >= 60) {
    return {
      className: "bg-emerald-50 text-emerald-600 border-emerald-300",
      label: "Trusted",
    };
  }
  if (rating >= 30) {
    return {
      className: "bg-yellow-50 text-yellow-600 border-yellow-300",
      label: "Caution",
    };
  }
  return {
    className: "bg-red-50 text-red-600 border-red-300",
    label: "Risky",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WatchlistCardProps {
  entry: WatchlistEntry;
}

export default function WatchlistCard({ entry }: WatchlistCardProps) {
  const href = getEntityHref(entry);

  // Token display
  if (entry.entity_type === "token" || !entry.entity_type) {
    const trustRating = entry.token?.trust_rating ?? 0;
    const trustBadge = getTrustBadgeStyle(trustRating);
    const deployerTier = entry.token?.deployer_tier as FairScoreTier | null;
    const tierColors = deployerTier ? getTierColor(deployerTier) : null;

    return (
      <Link href={href} className="block" aria-label={`View ${entry.token?.name ?? entry.mint} token details`}>
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2 overflow-hidden">
              <CardTitle className="min-w-0 text-base">
                <span className="block truncate">
                  <Coins className="mr-1.5 inline size-3.5 text-muted-foreground" />
                  {entry.token?.name ?? "Unknown Token"}
                  {entry.token?.symbol && (
                    <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                      ${entry.token.symbol}
                    </span>
                  )}
                </span>
              </CardTitle>
              <Badge
                className={cn("shrink-0 border", trustBadge.className)}
              >
                {trustRating}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="truncate text-xs text-muted-foreground">
              {entry.mint.slice(0, 8)}...{entry.mint.slice(-4)}
            </span>
            {deployerTier && tierColors && (
              <Badge
                className={cn(
                  "border capitalize",
                  tierColors.bg,
                  tierColors.text,
                  tierColors.border
                )}
              >
                {deployerTier}
              </Badge>
            )}
          </CardContent>
        </Card>
      </Link>
    );
  }

  // Wallet or deployer display
  const isDeployer = entry.entity_type === "deployer";
  const Icon = isDeployer ? User : ShieldCheck;
  const typeLabel = isDeployer ? "Deployer" : "Wallet";
  const walletScore = entry.walletInfo?.score ?? 0;
  const walletTier: FairScoreTier = entry.walletInfo?.tier ?? "unrated";
  const tierColors = getTierColor(walletTier);

  return (
    <Link href={href} className="block" aria-label={`View ${typeLabel.toLowerCase()} ${truncateAddress(entry.mint)}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2 overflow-hidden">
            <CardTitle className="flex min-w-0 items-center gap-1.5 text-base">
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-mono">
                {truncateAddress(entry.mint)}
              </span>
            </CardTitle>
            <Badge
              className={cn(
                "shrink-0 border capitalize",
                tierColors.bg,
                tierColors.text,
                tierColors.border
              )}
            >
              {walletTier}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">
            {typeLabel}
          </Badge>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {walletScore.toFixed(1)}
            <span className="ml-0.5 text-xs font-normal text-muted-foreground">
              /100
            </span>
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
