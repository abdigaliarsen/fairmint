"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Clock,
  Users,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useDiscover, type DiscoverTab, type DiscoverToken } from "@/hooks/useDiscover";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTrustColor(rating: number): string {
  if (rating >= 60) return "text-emerald-600";
  if (rating >= 30) return "text-yellow-600";
  return "text-red-600";
}

function getTrustBg(rating: number): string {
  if (rating >= 60) return "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800";
  if (rating >= 30) return "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800";
  return "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800";
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Token Card for Discover
// ---------------------------------------------------------------------------

function DiscoverTokenCard({ token }: { token: DiscoverToken }) {
  const riskCount = token.risk_flags?.length ?? 0;
  const isUnanalyzed = token.trust_rating === 0 && token.deployer_tier === null;

  return (
    <Link href={`/token/${token.mint}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-4 p-4">
          {/* Trust Rating Circle or NEW badge */}
          {isUnanalyzed ? (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-sky-300 bg-sky-50 text-xs font-bold text-sky-600 dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-400">
              NEW
            </div>
          ) : (
            <div
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-full border text-lg font-bold",
                getTrustBg(token.trust_rating),
                getTrustColor(token.trust_rating)
              )}
            >
              {token.trust_rating}
            </div>
          )}

          {/* Token Info */}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold text-foreground">
                {token.name ?? "Unknown"}
              </span>
              {token.symbol && (
                <span className="text-sm text-muted-foreground">
                  ${token.symbol}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {truncateAddress(token.mint)}
              </span>
              {token.deployer_tier && token.deployer_tier !== "unrated" && (
                <Badge variant="outline" className="text-xs capitalize">
                  {token.deployer_tier}
                </Badge>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="hidden flex-col items-end gap-1 sm:flex">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3" />
              {token.holder_count} holders
            </div>
            {token.token_age_days != null && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {token.token_age_days}d old
              </div>
            )}
            {riskCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-yellow-600">
                <AlertTriangle className="size-3" />
                {riskCount} risk{riskCount !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function DiscoverSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-lg" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Content
// ---------------------------------------------------------------------------

function TabContent({ tab }: { tab: DiscoverTab }) {
  const { tokens, loading, error } = useDiscover(tab);

  if (loading) return <DiscoverSkeleton />;

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Failed to load tokens. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (tokens.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {tab === "new"
              ? "No new tokens found in the last 48 hours."
              : tab === "trending"
                ? "No trending tokens in the last 24 hours."
                : "No trusted tokens found."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {tokens.map((token) => (
        <DiscoverTokenCard key={token.mint} token={token} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Discover Page
// ---------------------------------------------------------------------------

export default function DiscoverPage() {
  const [activeTab, setActiveTab] = useState<DiscoverTab>("trending");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Discover Tokens
        </h1>
        <p className="text-muted-foreground">
          Find tokens scored by trust rating. Powered by FairScale + Helius.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as DiscoverTab)}
        className="w-full"
      >
        <TabsList className="mb-6 w-full sm:w-auto">
          <TabsTrigger value="trending" className="gap-1.5">
            <TrendingUp className="size-3.5" />
            Trending
          </TabsTrigger>
          <TabsTrigger value="new" className="gap-1.5">
            <Sparkles className="size-3.5" />
            New Launches
          </TabsTrigger>
          <TabsTrigger value="trusted" className="gap-1.5">
            <ShieldCheck className="size-3.5" />
            Top Trusted
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trending">
          <TabContent tab="trending" />
        </TabsContent>
        <TabsContent value="new">
          <TabContent tab="new" />
        </TabsContent>
        <TabsContent value="trusted">
          <TabContent tab="trusted" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
