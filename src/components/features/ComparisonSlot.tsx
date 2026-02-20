"use client";

import { useState } from "react";
import { X, Trophy, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import type { RiskFlag } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import TrustRating from "@/components/features/TrustRating";
import HolderQualityBar from "@/components/features/HolderQualityBar";
import EntitySearch from "@/components/features/EntitySearch";
import WalletSlotContent from "@/components/features/WalletSlotContent";
import DeployerSlotContent from "@/components/features/DeployerSlotContent";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import type { ComparisonEntity, ComparisonMode } from "@/types/comparison";

// ---------------------------------------------------------------------------
// Empty Slot with Drop Zone
// ---------------------------------------------------------------------------

function EmptySlot({
  mode,
  onSelect,
}: {
  mode: ComparisonMode;
  onSelect: (id: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  const dropLabel =
    mode === "tokens"
      ? "Drop token here"
      : mode === "wallets"
        ? "Drop wallet here"
        : "Drop deployer here";

  const addLabel =
    mode === "tokens"
      ? "Add a token to compare"
      : mode === "wallets"
        ? "Add a wallet to compare"
        : "Add a deployer to compare";

  return (
    <Card
      className={cn(
        "flex flex-col border-dashed transition-colors",
        dragOver && "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDragOver(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const id = e.dataTransfer.getData("text/plain").trim();
        if (id && id.length >= 32 && id.length <= 44) {
          onSelect(id);
        }
      }}
    >
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 p-6 py-16">
        <p className={cn(
          "text-sm text-muted-foreground transition-colors",
          dragOver && "text-emerald-600 font-medium"
        )}>
          {dragOver ? dropLabel : addLabel}
        </p>
        {!dragOver && (
          <div className="w-full max-w-xs">
            <EntitySearch mode={mode} onSelect={onSelect} />
          </div>
        )}
        {dragOver && (
          <div className="flex size-12 items-center justify-center rounded-full border-2 border-dashed border-emerald-400">
            <span className="text-lg text-emerald-500">+</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Expandable Risk Flag for Comparison
// ---------------------------------------------------------------------------

const EXPAND_THRESHOLD = 60;

function ComparisonRiskFlag({ flag }: { flag: RiskFlag }) {
  const [expanded, setExpanded] = useState(false);
  const iconColor =
    flag.severity === "critical" || flag.severity === "high"
      ? "text-red-500"
      : flag.severity === "medium"
        ? "text-yellow-500"
        : "text-gray-400";

  const hasExpandable =
    !!flag.description && flag.description.length > EXPAND_THRESHOLD;

  return (
    <li className="flex flex-col">
      <div
        role={hasExpandable ? "button" : undefined}
        tabIndex={hasExpandable ? 0 : undefined}
        onClick={() => hasExpandable && setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (hasExpandable && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        className={cn(
          "flex items-start gap-2 text-left",
          hasExpandable && "cursor-pointer"
        )}
      >
        <AlertTriangle
          className={cn("mt-0.5 size-4 shrink-0", iconColor)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm text-muted-foreground">
            {flag.label}
          </span>
          {flag.description && !hasExpandable && (
            <span className="text-xs text-muted-foreground/70">
              {flag.description}
            </span>
          )}
        </div>
        {hasExpandable && (
          expanded ? (
            <ChevronUp className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
          ) : (
            <ChevronDown className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
          )
        )}
      </div>
      {expanded && hasExpandable && (
        <p className="ml-6 mt-1 text-xs leading-relaxed text-muted-foreground">
          {flag.description}
        </p>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Token Slot Content (extracted from original)
// ---------------------------------------------------------------------------

function TokenSlotContent({ token }: { token: import("@/services/tokenAnalyzer").TrustAnalysis }) {
  const tierColors = token.deployerTier
    ? getTierColor(token.deployerTier)
    : getTierColor("unrated");

  return (
    <>
      <CardHeader className="pb-3 pt-6">
        <CardTitle className="truncate text-lg">
          {token.name ?? "Unknown"}
          {token.symbol && (
            <span className="ml-1.5 text-base font-normal text-muted-foreground">
              ${token.symbol}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Trust Rating */}
        <TrustRating rating={token.trustRating} />

        <Separator />

        {/* Deployer */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Deployer</span>
          <Badge
            className={cn(
              "border text-sm capitalize",
              tierColors.bg,
              tierColors.text,
              tierColors.border
            )}
          >
            {token.deployerTier ?? "unrated"}
          </Badge>
        </div>

        {/* Holder Quality */}
        <HolderQualityBar
          score={token.holderQualityScore}
          holderCount={token.holderCount}
        />

        <Separator />

        {/* Risk Flags */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Risk Flags
            </span>
            <Badge
              className={cn(
                "border text-sm",
                token.riskFlags.length === 0
                  ? "bg-emerald-50 text-emerald-600 border-emerald-300"
                  : "bg-red-50 text-red-600 border-red-300"
              )}
            >
              {token.riskFlags.length}
            </Badge>
          </div>
          {token.riskFlags.length === 0 ? (
            <p className="text-sm text-emerald-600">No risk flags detected</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {token.riskFlags.map((flag) => (
                <ComparisonRiskFlag key={flag.id} flag={flag} />
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ComparisonSlotProps {
  entity: ComparisonEntity | null;
  mode: ComparisonMode;
  loading: boolean;
  isWinner: boolean;
  onSelect: (id: string) => void;
  onRemove: () => void;
}

export default function ComparisonSlot({
  entity,
  mode,
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

  if (!entity) {
    return <EmptySlot mode={mode} onSelect={onSelect} />;
  }

  // Derive aria label for the remove button
  const removeLabel =
    entity.mode === "tokens"
      ? `Remove ${entity.data.name ?? entity.data.mint}`
      : `Remove ${entity.data.wallet}`;

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
        aria-label={removeLabel}
      >
        <X className="size-4" />
      </Button>

      {entity.mode === "tokens" && <TokenSlotContent token={entity.data} />}

      {entity.mode === "wallets" && (
        <CardContent className="pt-8">
          <WalletSlotContent data={entity.data} />
        </CardContent>
      )}

      {entity.mode === "deployers" && (
        <CardContent className="pt-8">
          <DeployerSlotContent data={entity.data} />
        </CardContent>
      )}
    </Card>
  );
}
