"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useRouter } from "next/navigation";
import { Shield, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import FairScoreDisplay from "@/components/features/FairScoreDisplay";
import WatchlistCard from "@/components/features/WatchlistCard";
import TokenSearch from "@/components/features/TokenSearch";
import ScoreRecommendations from "@/components/features/ScoreRecommendations";
import { useFairScore } from "@/hooks/useFairScore";
import { useWatchlist } from "@/hooks/useWatchlist";
import { generateRecommendations } from "@/lib/recommendations";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import type { FairScoreTier } from "@/types/database";

// ---------------------------------------------------------------------------
// Tier benefit descriptions
// ---------------------------------------------------------------------------

const tierBenefits: Record<
  FairScoreTier,
  { label: string; description: string }
> = {
  unrated: {
    label: "Unrated",
    description:
      "Your wallet has no FairScale reputation yet. Use Solana DeFi, trade, and interact on-chain to build your score.",
  },
  bronze: {
    label: "Bronze",
    description: "Basic token lookups and risk flag visibility.",
  },
  silver: {
    label: "Silver",
    description: "Holder quality analysis and watchlist with up to 10 tokens.",
  },
  gold: {
    label: "Gold",
    description:
      "Full holder analysis, unlimited watchlist, and historical data.",
  },
  platinum: {
    label: "Platinum",
    description:
      "All features unlocked, priority analysis, and early access to new tools.",
  },
};

// ---------------------------------------------------------------------------
// Connect Wallet Prompt
// ---------------------------------------------------------------------------

function ConnectWalletPrompt({
  onConnect,
}: {
  onConnect: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/30">
        <Wallet className="size-8 text-emerald-600" />
      </div>
      <h1 className="text-2xl font-bold text-foreground">
        Connect Your Wallet
      </h1>
      <p className="mt-2 text-muted-foreground">
        Connect your Solana wallet to access your personalized dashboard,
        view your FairScore, and manage your watchlist.
      </p>
      <Button
        size="lg"
        className="mt-6 bg-emerald-600 text-white hover:bg-emerald-700"
        onClick={onConnect}
        aria-label="Connect wallet"
      >
        Connect Wallet
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <Skeleton className="size-32 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const router = useRouter();

  const walletAddress = publicKey?.toBase58() ?? null;
  const { data: fairScore, loading: scoreLoading } = useFairScore(walletAddress);
  const {
    items: watchlistItems,
    loading: watchlistLoading,
    addToken,
    removeItem,
  } = useWatchlist(walletAddress);

  // Determine current tier
  const currentTier: FairScoreTier = fairScore?.tier ?? "unrated";
  const tierColors = getTierColor(currentTier);
  const benefits = tierBenefits[currentTier];
  const recommendations = generateRecommendations(fairScore, undefined, currentTier);

  if (!connected) {
    return <ConnectWalletPrompt onConnect={() => setVisible(true)} />;
  }

  const isLoading = scoreLoading || watchlistLoading;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground sm:text-3xl">
        Dashboard
      </h1>

      {isLoading && <DashboardSkeleton />}

      {!isLoading && (
        <div className="flex flex-col gap-8">
          {/* --------------------------------------------------------------- */}
          {/* Your FairScore + Tier Card                                      */}
          {/* --------------------------------------------------------------- */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {/* Score display */}
            <div className="flex shrink-0 flex-col items-center">
              <FairScoreDisplay
                score={fairScore?.score ?? fairScore?.decimalScore ?? 0}
                tier={currentTier}
                size="lg"
              />
            </div>

            {/* Tier benefits card */}
            <Card className="flex-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className={cn("size-5", tierColors.text)} />
                  <span className={cn("capitalize", tierColors.text)}>
                    {benefits.label}
                  </span>{" "}
                  Tier
                </CardTitle>
                <CardDescription>{benefits.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {currentTier === "unrated"
                    ? "Interact on-chain to start building your FairScale reputation."
                    : `Your wallet reputation qualifies for ${benefits.label} tier features.`}
                </p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* --------------------------------------------------------------- */}
          {/* Score Improvement Recommendations                               */}
          {/* --------------------------------------------------------------- */}
          {recommendations.length > 0 && (
            <ScoreRecommendations recommendations={recommendations} />
          )}

          {/* --------------------------------------------------------------- */}
          {/* Tabs: Overview / Watchlist                                       */}
          {/* --------------------------------------------------------------- */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="watchlist">
                Watchlist
                {watchlistItems.length > 0 && (
                  <span className="ml-1.5 inline-flex size-5 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {watchlistItems.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ---- Overview Tab ---- */}
            <TabsContent value="overview" className="flex flex-col gap-6">
              {/* Quick search */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Token Lookup</CardTitle>
                  <CardDescription>
                    Search for any Solana token to analyze its trustworthiness.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TokenSearch
                    onSelect={(mint) => router.push(`/token/${mint}`)}
                  />
                </CardContent>
              </Card>

              {/* Recent watchlist (preview) */}
              {watchlistItems.length > 0 && (
                <section aria-label="Recent watchlist items">
                  <h3 className="mb-3 text-lg font-semibold text-foreground">
                    Recently Watched
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {watchlistItems.slice(0, 3).map((item) => (
                      <WatchlistCard key={item.id} entry={item} />
                    ))}
                  </div>
                </section>
              )}
            </TabsContent>

            {/* ---- Watchlist Tab ---- */}
            <TabsContent value="watchlist" className="flex flex-col gap-6">
              {/* Add to watchlist search */}
              <Card>
                <CardHeader>
                  <CardTitle>Add Token to Watchlist</CardTitle>
                  <CardDescription>
                    Search and add tokens to track their trust ratings over time.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TokenSearch
                    onSelect={(mint) => addToken(mint)}
                    placeholder="Search to add a token to your watchlist..."
                  />
                </CardContent>
              </Card>

              {/* Watchlist grid */}
              {watchlistItems.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {watchlistItems.map((item) => (
                    <div key={item.id} className="group relative">
                      <WatchlistCard entry={item} />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 size-7 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeItem(item.mint);
                        }}
                        aria-label={`Remove ${item.token?.name ?? item.mint} from watchlist`}
                      >
                        <X className="size-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                    <Shield className="size-10 text-muted-foreground/50" />
                    <div className="flex flex-col gap-1">
                      <h3 className="font-semibold text-foreground">
                        Your watchlist is empty
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Search for tokens above to start tracking their trust
                        ratings.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
