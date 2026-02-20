"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Clock, Coins, User, ShieldCheck, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import {
  useBrowsingHistory,
  type LocalHistoryEntry,
} from "@/hooks/useBrowsingHistory";
import { useWatchlist } from "@/hooks/useWatchlist";
import WatchlistButton from "@/components/features/WatchlistButton";
import type { BrowsingHistoryType, FairScoreTier } from "@/types/database";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_FILTERS: { value: BrowsingHistoryType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "token", label: "Tokens" },
  { value: "deployer", label: "Deployers" },
  { value: "reputation", label: "Wallets" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getTypeIcon(type: BrowsingHistoryType) {
  switch (type) {
    case "token":
      return Coins;
    case "deployer":
      return User;
    case "reputation":
      return ShieldCheck;
  }
}

function getTypeHref(type: BrowsingHistoryType, subject: string): string {
  switch (type) {
    case "token":
      return `/token/${subject}`;
    case "deployer":
      return `/deployer/${subject}`;
    case "reputation":
      return `/reputation/${subject}`;
  }
}

// ---------------------------------------------------------------------------
// History Entry Card
// ---------------------------------------------------------------------------

function HistoryEntryCard({
  entry,
  isWatched,
  onToggleWatchlist,
  watchlistLoading,
}: {
  entry: LocalHistoryEntry;
  isWatched: boolean;
  onToggleWatchlist: () => void;
  watchlistLoading: boolean;
}) {
  const Icon = getTypeIcon(entry.type);
  const href = getTypeHref(entry.type, entry.subject);
  const tierColors = entry.tier
    ? getTierColor(entry.tier as FairScoreTier)
    : null;

  return (
    <Link href={href} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-3 py-3">
          {/* Type icon */}
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
            <Icon className="size-4 text-muted-foreground" />
          </div>

          {/* Name + Address */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {entry.name ?? truncateAddress(entry.subject)}
              {entry.symbol && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ${entry.symbol}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {truncateAddress(entry.subject)}
            </p>
          </div>

          {/* Score + Tier */}
          <div className="flex shrink-0 items-center gap-2">
            {entry.score !== null && (
              <span className="text-sm font-semibold text-foreground">
                {entry.type === "token"
                  ? entry.score.toFixed(0)
                  : entry.score.toFixed(1)}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                  /100
                </span>
              </span>
            )}
            {entry.tier && tierColors && (
              <Badge
                className={cn(
                  "border capitalize",
                  tierColors.bg,
                  tierColors.text,
                  tierColors.border
                )}
              >
                {entry.tier}
              </Badge>
            )}
          </div>

          {/* Watchlist toggle */}
          <div
            className="shrink-0"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <WatchlistButton
              isWatched={isWatched}
              onToggle={onToggleWatchlist}
              loading={watchlistLoading}
              size="sm"
            />
          </div>

          {/* Timestamp */}
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
            {relativeTime(entry.visitedAt)}
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// History Page
// ---------------------------------------------------------------------------

export default function HistoryPage() {
  const { entries, clearHistory } = useBrowsingHistory();
  const { data: session } = useSession();
  const { items: watchlistItems, addToken, removeToken, loading: watchlistLoading } = useWatchlist(session?.user?.wallet ?? null);
  const watchlistMints = useMemo(() => new Set(watchlistItems.map((i) => i.mint)), [watchlistItems]);
  const [typeFilter, setTypeFilter] = useState<
    BrowsingHistoryType | "all"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let result = entries;

    if (typeFilter !== "all") {
      result = result.filter((e) => e.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.name?.toLowerCase().includes(q) ||
          e.symbol?.toLowerCase().includes(q) ||
          e.subject.toLowerCase().includes(q)
      );
    }

    return result;
  }, [entries, typeFilter, searchQuery]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Browsing History
          </h1>
          <p className="text-sm text-muted-foreground">
            {entries.length} {entries.length === 1 ? "page" : "pages"} visited
            {!session && " (stored locally)"}
          </p>
        </div>
        {entries.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearHistory}
            className="text-muted-foreground"
          >
            <Trash2 className="size-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Type pills */}
        <div className="flex gap-1">
          {TYPE_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              variant={typeFilter === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter(filter.value)}
              className="text-xs"
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, symbol, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Entry list */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-2">
          {filtered.map((entry) => (
            <HistoryEntryCard
              key={entry.id}
              entry={entry}
              isWatched={watchlistMints.has(entry.subject)}
              onToggleWatchlist={() =>
                watchlistMints.has(entry.subject)
                  ? removeToken(entry.subject)
                  : addToken(entry.subject)
              }
              watchlistLoading={watchlistLoading}
            />
          ))}
        </div>
      ) : entries.length > 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No results match your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Clock className="size-10 text-muted-foreground/50" />
            <div>
              <p className="font-medium text-foreground">No history yet</p>
              <p className="text-sm text-muted-foreground">
                Start exploring tokens and wallets to build your history.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/search">Search Tokens</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
