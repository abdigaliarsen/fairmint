"use client";

import { X, Trophy, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!token) {
    return (
      <Card className="flex flex-col border-dashed">
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 p-6 py-16">
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
    : getTierColor("unrated");

  return (
    <Card
      className={cn("relative", isWinner && "ring-2 ring-emerald-500")}
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

        <Separator />

        {/* Deployer - always shown */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Deployer</span>
          <Badge
            className={cn(
              "border capitalize",
              tierColors.bg,
              tierColors.text,
              tierColors.border
            )}
          >
            {token.deployerTier ?? "unrated"}
          </Badge>
        </div>

        {/* Holder Quality - always shown */}
        <HolderQualityBar
          score={token.holderQualityScore}
          holderCount={token.holderCount}
        />

        <Separator />

        {/* Risk Flags - expanded with details */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Risk Flags
            </span>
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
          {token.riskFlags.length === 0 ? (
            <p className="text-xs text-emerald-600">No risk flags detected</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {token.riskFlags.map((flag) => (
                <li key={flag.id} className="flex items-start gap-1.5">
                  <AlertTriangle
                    className={cn(
                      "mt-0.5 size-3 shrink-0",
                      flag.severity === "critical" || flag.severity === "high"
                        ? "text-red-500"
                        : flag.severity === "medium"
                          ? "text-yellow-500"
                          : "text-gray-400"
                    )}
                  />
                  <span className="text-xs text-muted-foreground">
                    {flag.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
