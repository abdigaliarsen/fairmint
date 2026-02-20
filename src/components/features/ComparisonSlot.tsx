"use client";

import { X, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import TrustRating from "@/components/features/TrustRating";
import HolderQualityBar from "@/components/features/HolderQualityBar";
import TokenSearch from "@/components/features/TokenSearch";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import type { TrustAnalysis } from "@/services/tokenAnalyzer";

interface ComparisonSlotProps {
  token: TrustAnalysis | null;
  loading: boolean;
  isWinner: boolean;
  onSelect: (mint: string) => void;
  onRemove: () => void;
}

export default function ComparisonSlot({
  token,
  loading,
  isWinner,
  onSelect,
  onRemove,
}: ComparisonSlotProps) {
  if (loading) {
    return (
      <Card className="flex-1">
        <CardContent className="flex flex-col gap-4 p-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-24 w-24 self-center rounded-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!token) {
    return (
      <Card className="flex flex-1 flex-col border-dashed">
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <p className="text-sm text-muted-foreground">
            Add a token to compare
          </p>
          <div className="w-full max-w-xs">
            <TokenSearch onSelect={onSelect} placeholder="Search token..." />
          </div>
        </CardContent>
      </Card>
    );
  }

  const tierColors = token.deployerTier
    ? getTierColor(token.deployerTier)
    : null;

  return (
    <Card
      className={cn("relative flex-1", isWinner && "ring-2 ring-emerald-500")}
    >
      {isWinner && (
        <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
          <Trophy className="size-3" />
          Best
        </div>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 size-7"
        onClick={onRemove}
        aria-label={`Remove ${token.name ?? token.mint}`}
      >
        <X className="size-4" />
      </Button>
      <CardHeader className="pb-2 pt-6">
        <CardTitle className="truncate text-base">
          {token.name ?? "Unknown"}
          {token.symbol && (
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              ${token.symbol}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Trust Rating */}
        <TrustRating rating={token.trustRating} />

        {/* Deployer */}
        {token.deployerTier && tierColors && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Deployer:</span>
            <Badge
              className={cn(
                "border capitalize",
                tierColors.bg,
                tierColors.text,
                tierColors.border
              )}
            >
              {token.deployerTier}
            </Badge>
          </div>
        )}

        {/* Holder Quality */}
        <HolderQualityBar
          score={token.holderQualityScore}
          holderCount={token.holderCount}
        />

        {/* Risk Flags count */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Risk flags</span>
          <Badge
            className={cn(
              "border",
              token.riskFlags.length === 0
                ? "bg-emerald-50 text-emerald-600 border-emerald-300"
                : "bg-red-50 text-red-600 border-red-300"
            )}
          >
            {token.riskFlags.length}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
