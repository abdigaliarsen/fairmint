"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import type { FairScoreTier } from "@/types/database";

interface TokenCardProps {
  mint: string;
  name: string | null;
  symbol: string | null;
  trustRating: number;
  deployerTier: FairScoreTier | null;
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

export default function TokenCard({
  mint,
  name,
  symbol,
  trustRating,
  deployerTier,
}: TokenCardProps) {
  const trustBadge = getTrustBadgeStyle(trustRating);
  const tierColors = deployerTier ? getTierColor(deployerTier) : null;

  return (
    <Link href={`/token/${mint}`} className="block" aria-label={`View ${name ?? symbol ?? mint} token details`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="truncate text-base">
              {name ?? "Unknown Token"}
              {symbol && (
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  ${symbol}
                </span>
              )}
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
            {mint.slice(0, 8)}...{mint.slice(-4)}
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
