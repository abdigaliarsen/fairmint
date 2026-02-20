"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Coins,
  ShieldCheck,
  User,
  GripVertical,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import type { FairScoreTier, RiskFlag } from "@/types/database";
import type { ComparisonMode } from "@/types/comparison";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeaturedToken {
  mint: string;
  name: string | null;
  symbol: string | null;
  image_url: string | null;
  trust_rating: number;
  deployer_wallet: string | null;
  deployer_tier: FairScoreTier | null;
  deployer_score: number | null;
  holder_count: number;
  holder_quality_score: number;
  risk_flags: RiskFlag[];
  analyzed_at: string;
}

interface LeaderboardWallet {
  wallet: string;
  score: number;
  tier: FairScoreTier;
}

interface DerivedDeployer {
  wallet: string;
  tier: FairScoreTier;
  tokenCount: number;
  bestRating: number;
}

type Tab = "tokens" | "wallets" | "deployers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getTrustColor(rating: number): string {
  if (rating >= 60) return "text-emerald-600";
  if (rating >= 30) return "text-yellow-600";
  return "text-red-600";
}

// ---------------------------------------------------------------------------
// Draggable Token Row
// ---------------------------------------------------------------------------

function DraggableTokenRow({ token }: { token: FeaturedToken }) {
  const tierColors = token.deployer_tier
    ? getTierColor(token.deployer_tier)
    : null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", token.mint);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className="flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent active:cursor-grabbing"
      role="option"
      aria-label={`Drag ${token.name ?? token.mint} to compare`}
    >
      <GripVertical className="size-3.5 shrink-0 text-muted-foreground/50" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {token.name ?? truncateAddress(token.mint)}
          {token.symbol && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ${token.symbol}
            </span>
          )}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          getTrustColor(token.trust_rating)
        )}
      >
        {token.trust_rating}
      </span>
      {tierColors && (
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 text-[10px] capitalize",
            tierColors.text
          )}
        >
          {token.deployer_tier}
        </Badge>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wallet Row — draggable when in wallets comparison mode, link otherwise
// ---------------------------------------------------------------------------

function WalletRow({
  wallet,
  draggableMode,
}: {
  wallet: LeaderboardWallet;
  draggableMode: boolean;
}) {
  const tierColors = getTierColor(wallet.tier);
  const displayScore = Math.min(100, (wallet.score / 1000) * 100).toFixed(1);

  const content = (
    <>
      {draggableMode ? (
        <GripVertical className="size-3.5 shrink-0 text-muted-foreground/50" />
      ) : (
        <ShieldCheck className="size-3.5 shrink-0 text-muted-foreground/50" />
      )}
      <span className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
        {truncateAddress(wallet.wallet)}
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {displayScore}
      </span>
      <Badge
        variant="outline"
        className={cn("shrink-0 text-[10px] capitalize", tierColors.text)}
      >
        {wallet.tier}
      </Badge>
      {!draggableMode && (
        <ExternalLink className="size-3 shrink-0 text-muted-foreground/40" />
      )}
    </>
  );

  if (draggableMode) {
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", wallet.wallet);
          e.dataTransfer.effectAllowed = "copy";
        }}
        className="flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent active:cursor-grabbing"
        role="option"
        aria-label={`Drag wallet ${truncateAddress(wallet.wallet)} to compare`}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/reputation/${wallet.wallet}`}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
    >
      {content}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Deployer Row — draggable when in deployers comparison mode, link otherwise
// ---------------------------------------------------------------------------

function DeployerRow({
  deployer,
  draggableMode,
}: {
  deployer: DerivedDeployer;
  draggableMode: boolean;
}) {
  const tierColors = getTierColor(deployer.tier);

  const content = (
    <>
      {draggableMode ? (
        <GripVertical className="size-3.5 shrink-0 text-muted-foreground/50" />
      ) : (
        <User className="size-3.5 shrink-0 text-muted-foreground/50" />
      )}
      <span className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
        {truncateAddress(deployer.wallet)}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {deployer.tokenCount} token{deployer.tokenCount !== 1 ? "s" : ""}
      </span>
      <Badge
        variant="outline"
        className={cn("shrink-0 text-[10px] capitalize", tierColors.text)}
      >
        {deployer.tier}
      </Badge>
      {!draggableMode && (
        <ExternalLink className="size-3 shrink-0 text-muted-foreground/40" />
      )}
    </>
  );

  if (draggableMode) {
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", deployer.wallet);
          e.dataTransfer.effectAllowed = "copy";
        }}
        className="flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent active:cursor-grabbing"
        role="option"
        aria-label={`Drag deployer ${truncateAddress(deployer.wallet)} to compare`}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/deployer/${deployer.wallet}`}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
    >
      {content}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1.5">
          <Skeleton className="size-3.5" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-8" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Button
// ---------------------------------------------------------------------------

const TABS: { value: Tab; label: string; icon: typeof Coins }[] = [
  { value: "tokens", label: "Top Tokens", icon: Coins },
  { value: "wallets", label: "Top Wallets", icon: ShieldCheck },
  { value: "deployers", label: "Top Deployers", icon: User },
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface SuggestionPanelProps {
  comparisonMode?: ComparisonMode;
}

export default function SuggestionPanel({ comparisonMode }: SuggestionPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("tokens");
  const [tokens, setTokens] = useState<FeaturedToken[]>([]);
  const [wallets, setWallets] = useState<LeaderboardWallet[]>([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [walletsLoading, setWalletsLoading] = useState(true);

  // Auto-switch suggestion tab when comparison mode changes
  useEffect(() => {
    if (comparisonMode) {
      setActiveTab(comparisonMode);
    }
  }, [comparisonMode]);

  // Fetch top tokens
  useEffect(() => {
    setTokensLoading(true);
    fetch("/api/featured?limit=10")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setTokens(data.tokens ?? []))
      .catch(() => setTokens([]))
      .finally(() => setTokensLoading(false));
  }, []);

  // Fetch top wallets
  useEffect(() => {
    setWalletsLoading(true);
    fetch("/api/wallets?limit=10")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setWallets(data.wallets ?? []))
      .catch(() => setWallets([]))
      .finally(() => setWalletsLoading(false));
  }, []);

  // Derive deployers from featured tokens
  const deployers = useMemo<DerivedDeployer[]>(() => {
    const map = new Map<string, DerivedDeployer>();
    for (const t of tokens) {
      if (!t.deployer_wallet) continue;
      const existing = map.get(t.deployer_wallet);
      if (existing) {
        existing.tokenCount += 1;
        existing.bestRating = Math.max(existing.bestRating, t.trust_rating);
        if (t.deployer_tier) existing.tier = t.deployer_tier;
      } else {
        map.set(t.deployer_wallet, {
          wallet: t.deployer_wallet,
          tier: t.deployer_tier ?? "unrated",
          tokenCount: 1,
          bestRating: t.trust_rating,
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.bestRating - a.bestRating
    );
  }, [tokens]);

  const instructionText =
    comparisonMode === "wallets"
      ? "Drag wallets into the comparison slots above."
      : comparisonMode === "deployers"
        ? "Drag deployers into the comparison slots above."
        : "Drag tokens into the comparison slots above, or click wallets & deployers to view their profiles.";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Quick Add</CardTitle>
        <p className="text-xs text-muted-foreground">
          {instructionText}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* Tab buttons */}
        <div className="flex gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  activeTab === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="max-h-72 overflow-y-auto" role="listbox">
          {activeTab === "tokens" && (
            tokensLoading ? (
              <ListSkeleton />
            ) : tokens.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {tokens.map((token) => (
                  <DraggableTokenRow key={token.mint} token={token} />
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No tokens available.
              </p>
            )
          )}

          {activeTab === "wallets" && (
            walletsLoading ? (
              <ListSkeleton />
            ) : wallets.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {wallets.map((w) => (
                  <WalletRow
                    key={w.wallet}
                    wallet={w}
                    draggableMode={comparisonMode === "wallets"}
                  />
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No wallets available.
              </p>
            )
          )}

          {activeTab === "deployers" && (
            tokensLoading ? (
              <ListSkeleton />
            ) : deployers.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {deployers.map((d) => (
                  <DeployerRow
                    key={d.wallet}
                    deployer={d}
                    draggableMode={comparisonMode === "deployers"}
                  />
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No deployers available.
              </p>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
