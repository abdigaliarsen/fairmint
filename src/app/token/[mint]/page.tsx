"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  BadgeCheck,
  Clock,
  ShieldCheck,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import FairScoreDisplay from "@/components/features/FairScoreDisplay";
import TrustRating from "@/components/features/TrustRating";
import HolderQualityBar from "@/components/features/HolderQualityBar";
import RiskFlags from "@/components/features/RiskFlags";
import HolderGraph from "@/components/features/HolderGraph";
import ScoreRecommendations from "@/components/features/ScoreRecommendations";
import AISummaryCard from "@/components/features/AISummaryCard";
import ScoreHistoryChart from "@/components/features/ScoreHistoryChart";
import LiquidityCard from "@/components/features/LiquidityCard";
import AuthorityBadges from "@/components/features/AuthorityBadges";
import ScoringMethodology from "@/components/features/ScoringMethodology";
import AnalysisProgress from "@/components/features/AnalysisProgress";
import { useTokenAnalysis } from "@/hooks/useTokenAnalysis";
import { useHolders } from "@/hooks/useHolders";
import { generateTokenTips } from "@/lib/recommendations";
import { useBrowsingHistory } from "@/hooks/useBrowsingHistory";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useSession } from "next-auth/react";
import WatchlistButton from "@/components/features/WatchlistButton";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import type { FairScoreTier } from "@/types/database";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Copy Button
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Token Lookup Page
// ---------------------------------------------------------------------------

export default function TokenPage() {
  const params = useParams<{ mint: string }>();
  const router = useRouter();
  const mint = params.mint;
  const { data, loading, error, refetch } = useTokenAnalysis(mint);
  const { holders, loading: holdersLoading } = useHolders(mint, 10);
  const { recordVisit } = useBrowsingHistory();
  const { data: session } = useSession();
  const { items: watchlistItems, addToken, removeToken, loading: watchlistLoading } = useWatchlist(session?.user?.wallet ?? null);
  const isWatched = data ? watchlistItems.some((i) => i.mint === data.mint) : false;

  useEffect(() => {
    if (data && !loading) {
      recordVisit({
        type: "token",
        subject: data.mint,
        name: data.name ?? null,
        symbol: data.symbol ?? null,
        score: data.trustRating,
        tier: data.deployerTier ?? null,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-6"
        onClick={() => router.back()}
        aria-label="Go back"
      >
        <ArrowLeft className="size-4" />
        Back
      </Button>

      {loading && <AnalysisProgress />}

      {error && !loading && (
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <AlertCircle className="size-10 text-red-500" />
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-foreground">
                Analysis Failed
              </h2>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={refetch}>
                <RefreshCw className="size-4" />
                Retry
              </Button>
              <Button variant="ghost" size="sm" onClick={() => router.push("/search")}>
                Search Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {data && !loading && (
        <div className="flex flex-col gap-6">
          {/* --------------------------------------------------------------- */}
          {/* Token Header                                                    */}
          {/* --------------------------------------------------------------- */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                {data.name ?? "Unknown Token"}
                {data.symbol && (
                  <span className="ml-2 text-lg font-normal text-muted-foreground">
                    ${data.symbol}
                  </span>
                )}
              </h1>
              {data.jupiterVerified && (
                <Badge className="border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400">
                  <BadgeCheck className="mr-0.5 size-3" />
                  Jupiter Verified
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <span className="font-mono">{truncateAddress(data.mint)}</span>
              <CopyButton text={data.mint} />
              <WatchlistButton
                isWatched={isWatched}
                onToggle={() => isWatched ? removeToken(data.mint) : addToken(data.mint)}
                loading={watchlistLoading}
              />
            </div>

            {/* Token Age */}
            {data.tokenAgeDays !== null && data.tokenAgeDays !== undefined && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  Token Age: {data.tokenAgeDays}d
                </div>
                {data.tokenAgeDays < 2 && (
                  <Badge className="border-red-300 bg-red-50 text-red-600 text-xs dark:border-red-800 dark:bg-red-950 dark:text-red-400">Very New</Badge>
                )}
                {data.tokenAgeDays >= 2 && data.tokenAgeDays < 7 && (
                  <Badge className="border-yellow-300 bg-yellow-50 text-yellow-600 text-xs dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400">New Token</Badge>
                )}
              </div>
            )}

            {/* Authority Status */}
            <AuthorityBadges
              mintAuthorityActive={data.mintAuthorityActive}
              freezeAuthorityActive={data.freezeAuthorityActive}
            />
          </div>

          <Separator />

          {/* --------------------------------------------------------------- */}
          {/* AI Analysis                                                     */}
          {/* --------------------------------------------------------------- */}
          <AISummaryCard
            type="token"
            context={data ? {
              name: data.name,
              symbol: data.symbol,
              trustRating: data.trustRating,
              deployerScore: data.deployerScore,
              deployerTier: data.deployerTier,
              holderCount: data.holderCount,
              topHolderConcentration: data.topHolderConcentration,
              holderQualityScore: data.holderQualityScore,
              riskFlags: data.riskFlags,
            } : null}
          />

          {/* --------------------------------------------------------------- */}
          {/* Trust Rating                                                    */}
          {/* --------------------------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>Trust Rating</CardTitle>
              <CardDescription>
                Composite score based on deployer reputation, holder quality,
                and risk signals.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TrustRating rating={data.trustRating} />
              <ScoringMethodology />
              <p className="mt-2 text-xs text-muted-foreground">
                Powered by FairScale + Helius
              </p>
            </CardContent>
          </Card>

          {/* RugCheck Second Opinion */}
          {data.rugCheck && (
            <div className="flex items-center justify-center gap-2">
              <ShieldCheck className={cn(
                "size-4",
                data.rugCheck.riskLevel === "Good" ? "text-emerald-500" :
                data.rugCheck.riskLevel === "Warning" ? "text-yellow-500" : "text-red-500"
              )} />
              <span className="text-xs font-medium text-foreground">
                RugCheck: {data.rugCheck.riskLevel}
              </span>
              <span className="text-xs text-muted-foreground">
                ({data.rugCheck.riskCount} risk{data.rugCheck.riskCount !== 1 ? "s" : ""} detected)
              </span>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* Score History                                                   */}
          {/* --------------------------------------------------------------- */}
          <ScoreHistoryChart
            type="token"
            subject={data.mint}
            label="Trust Rating"
            color="#059669"
          />

          {/* --------------------------------------------------------------- */}
          {/* Liquidity                                                       */}
          {/* --------------------------------------------------------------- */}
          <LiquidityCard mint={data.mint} />

          {/* --------------------------------------------------------------- */}
          {/* Deployer Info                                                   */}
          {/* --------------------------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>Deployer Info</CardTitle>
              <CardDescription>
                The wallet that deployed this token and its FairScale reputation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.deployerWallet ? (
                <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                  <FairScoreDisplay
                    score={
                      data.deployerScore !== null
                        ? Math.min(100, (data.deployerScore / 1000) * 100)
                        : 0
                    }
                    tier={data.deployerTier ?? "unrated"}
                    size="lg"
                  />
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-sm text-muted-foreground">
                        {truncateAddress(data.deployerWallet)}
                      </span>
                      <CopyButton text={data.deployerWallet} />
                    </div>
                    {data.deployerTier && (
                      <p className="text-sm text-muted-foreground">
                        Reputation Tier:{" "}
                        <span className="font-semibold capitalize text-foreground">
                          {data.deployerTier}
                        </span>
                      </p>
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/deployer/${data.deployerWallet}`}>
                        <ExternalLink className="size-4" />
                        View Deployer Profile
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Deployer information is not available for this token.
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                via FairScale
              </p>
            </CardContent>
          </Card>

          {/* --------------------------------------------------------------- */}
          {/* Holder Quality                                                  */}
          {/* --------------------------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>Holder Quality</CardTitle>
              <CardDescription>
                Average reputation quality of the top token holders.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HolderQualityBar
                score={data.holderQualityScore}
                holderCount={data.holderCount}
              />
              {data.topHolderConcentration > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Top holder concentration:{" "}
                  <span className="font-medium">
                    {data.topHolderConcentration.toFixed(1)}%
                  </span>
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                via Helius
              </p>
            </CardContent>
          </Card>

          {/* --------------------------------------------------------------- */}
          {/* Notable Holders (Gold / Platinum)                               */}
          {/* --------------------------------------------------------------- */}
          {(() => {
            const notable = holders.filter(
              (h) => h.tier === "gold" || h.tier === "platinum"
            );
            if (notable.length === 0) return null;
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="size-4 text-yellow-500" />
                    Notable Holders
                  </CardTitle>
                  <CardDescription>
                    Top holders with Gold or Platinum FairScale reputation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {notable.map((holder) => {
                      const tierColors = getTierColor(holder.tier as FairScoreTier);
                      return (
                        <Link
                          key={holder.owner}
                          href={`/reputation/${holder.owner}`}
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 sm:px-6"
                        >
                          <div
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                              tierColors.bg,
                              tierColors.border,
                              tierColors.text
                            )}
                          >
                            {holder.fairScore !== null
                              ? Math.min(100, Math.round((holder.fairScore / 1000) * 100))
                              : "–"}
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-mono text-sm font-medium text-foreground">
                              {truncateAddress(holder.owner)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Holds {holder.percentage.toFixed(1)}%
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn("text-xs capitalize", tierColors.text)}
                          >
                            {holder.tier}
                          </Badge>
                        </Link>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* --------------------------------------------------------------- */}
          {/* Holder Network Graph                                            */}
          {/* --------------------------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>Holder Network</CardTitle>
              <CardDescription>
                Top holders colored by FairScale reputation tier. Node size
                reflects holding percentage.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HolderGraph
                holders={holders}
                tokenName={data.name}
                loading={holdersLoading}
              />
              <p className="mt-2 text-center text-xs text-muted-foreground">
                via Helius
              </p>
            </CardContent>
          </Card>

          {/* --------------------------------------------------------------- */}
          {/* Risk Flags                                                      */}
          {/* --------------------------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Flags</CardTitle>
              <CardDescription>
                Potential concerns detected during analysis.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RiskFlags flags={data.riskFlags} />
            </CardContent>
          </Card>

          {/* --------------------------------------------------------------- */}
          {/* Trust Improvement Tips                                          */}
          {/* --------------------------------------------------------------- */}
          <ScoreRecommendations recommendations={generateTokenTips(data)} />

          {/* --------------------------------------------------------------- */}
          {/* Analysis Metadata                                               */}
          {/* --------------------------------------------------------------- */}
          <p className="text-center text-xs text-muted-foreground">
            Analyzed at{" "}
            {new Date(data.analyzedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
      )}
    </div>
  );
}
