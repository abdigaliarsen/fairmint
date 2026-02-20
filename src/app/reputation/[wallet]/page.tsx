"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Copy, Check, Share2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import FairScoreDisplay from "@/components/features/FairScoreDisplay";
import ScoreRecommendations from "@/components/features/ScoreRecommendations";
import AISummaryCard from "@/components/features/AISummaryCard";
import ScoreHistoryChart from "@/components/features/ScoreHistoryChart";
import WalletAnalyticsChart from "@/components/features/WalletAnalyticsChart";
import { useBrowsingHistory } from "@/hooks/useBrowsingHistory";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useSession } from "next-auth/react";
import WatchlistButton from "@/components/features/WatchlistButton";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import type { FairScoreData, FairScoreTier } from "@/types/database";
import type { Recommendation } from "@/lib/recommendations";

interface ReputationData {
  wallet: string;
  fairScore: FairScoreData | null;
  walletScore: number | null;
  recommendations: Recommendation[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-600" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </Button>
  );
}

function ReputationSkeleton() {
  return (
    <div className="flex flex-col items-center gap-6">
      <Skeleton className="size-32 rounded-full" />
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export default function ReputationPage() {
  const params = useParams<{ wallet: string }>();
  const wallet = params.wallet;

  const [data, setData] = useState<ReputationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { recordVisit } = useBrowsingHistory();
  const { data: session } = useSession();
  const { items: watchlistItems, addItem, removeItem, loading: watchlistLoading } = useWatchlist(session?.user?.wallet ?? null);
  const isWatched = watchlistItems.some((i) => i.mint === wallet);

  useEffect(() => {
    if (!wallet) return;

    setLoading(true);
    setError(null);

    fetch(`/api/reputation/${encodeURIComponent(wallet)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load reputation");
        return res.json();
      })
      .then((json) => setData(json as ReputationData))
      .catch(() => setError("Failed to load wallet reputation."))
      .finally(() => setLoading(false));
  }, [wallet]);

  useEffect(() => {
    if (data && !loading) {
      recordVisit({
        type: "reputation",
        subject: wallet,
        name: null,
        symbol: null,
        score: data.fairScore?.decimalScore ?? null,
        tier: data.fairScore?.tier ?? null,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading]);

  const truncated = wallet
    ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
    : "";

  const tier: FairScoreTier = data?.fairScore?.tier ?? "unrated";
  const tierColors = getTierColor(tier);
  const score = data?.fairScore?.score ?? data?.fairScore?.decimalScore ?? 0;

  function handleShare() {
    const url = `${window.location.origin}/reputation/${wallet}`;
    const text = `Check out my Trust Passport on TokenTrust! My FairScale tier: ${tier}`;
    if (navigator.share) {
      navigator.share({ title: "Trust Passport", text, url });
    } else {
      navigator.clipboard.writeText(url);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {loading && <ReputationSkeleton />}

      {error && !loading && (
        <Card className="border-red-200">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {data && !loading && (
        <div className="flex flex-col gap-6">
          {/* Header: Score + Wallet */}
          <div className="flex flex-col items-center gap-4">
            <FairScoreDisplay score={score} tier={tier} size="lg" />
            <div className="flex flex-col items-center gap-1">
              <h1 className="text-2xl font-bold text-foreground">
                Trust Passport
              </h1>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span className="font-mono">{truncated}</span>
                <CopyButton text={wallet} />
              </div>
              <Badge
                className={cn(
                  "mt-1 border capitalize",
                  tierColors.bg,
                  tierColors.text,
                  tierColors.border
                )}
              >
                {tier} Tier
              </Badge>
            </div>
          </div>

          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="size-4" />
              Share your Trust Passport
            </Button>
            <WatchlistButton
              isWatched={isWatched}
              onToggle={() => isWatched ? removeItem(wallet) : addItem(wallet, "wallet")}
              loading={watchlistLoading}
            />
          </div>

          <Separator />

          {/* AI Analysis */}
          <AISummaryCard
            type="reputation"
            context={data ? {
              wallet: truncated,
              decimalScore: data.fairScore?.decimalScore,
              integerScore: data.fairScore?.integerScore,
              walletScore: data.walletScore,
              tier: data.fairScore?.tier,
              badgeCount: data.fairScore?.badges?.length ?? 0,
              badgeLabels: data.fairScore?.badges?.map((b: { label: string }) => b.label).join(", "),
            } : null}
          />

          {/* Wallet Analytics Radar */}
          <WalletAnalyticsChart features={data.fairScore?.features} />

          {/* Score History */}
          <ScoreHistoryChart
            type="wallet"
            subject={wallet}
            label="FairScore"
            color="#7c3aed"
          />

          {/* Badges */}
          {data.fairScore?.badges && data.fairScore.badges.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Badges</CardTitle>
                <CardDescription>
                  Achievements earned on FairScale.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {data.fairScore.badges.map((badge) => {
                  const badgeColors = getTierColor(badge.tier);
                  return (
                    <Badge
                      key={badge.id}
                      className={cn(
                        "border",
                        badgeColors.bg,
                        badgeColors.text,
                        badgeColors.border
                      )}
                    >
                      {badge.label}
                    </Badge>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Score Summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="flex flex-col gap-0.5 py-3">
                <span className="text-xs text-muted-foreground">FairScore</span>
                <span className="text-lg font-semibold">
                  {data.fairScore?.decimalScore?.toFixed(1) ?? "N/A"}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">/ 100</span>
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-0.5 py-3">
                <span className="text-xs text-muted-foreground">Badges</span>
                <span className="text-lg font-semibold">
                  {data.fairScore?.badges?.length ?? 0}
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-0.5 py-3">
                <span className="text-xs text-muted-foreground">Wallet Score</span>
                <span className="text-lg font-semibold">
                  {data.walletScore ?? "N/A"}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          <ScoreRecommendations recommendations={data.recommendations} />

          {/* External links */}
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" asChild>
              <a
                href={`https://solscan.io/account/${wallet}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="size-4" />
                View on Solscan
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
