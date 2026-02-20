"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Award,
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
import { Skeleton } from "@/components/ui/skeleton";
import FairScoreDisplay from "@/components/features/FairScoreDisplay";
import TokenCard from "@/components/features/TokenCard";
import TokenGraph from "@/components/features/TokenGraph";
import ScoreRecommendations from "@/components/features/ScoreRecommendations";
import AISummaryCard from "@/components/features/AISummaryCard";
import ScoreHistoryChart from "@/components/features/ScoreHistoryChart";
import WalletAnalyticsChart from "@/components/features/WalletAnalyticsChart";
import DeployerTimeline from "@/components/features/DeployerTimeline";
import { useDeployerProfile } from "@/hooks/useDeployerProfile";
import { useBrowsingHistory } from "@/hooks/useBrowsingHistory";
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
// Metric Card
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="text-lg font-semibold text-foreground">{value}</span>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function DeployerPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="size-32 rounded-full" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-5 w-24" />
      </div>

      {/* Score breakdown */}
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>

      {/* Badges */}
      <Skeleton className="h-24 w-full" />

      {/* Tokens */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deployer Profile Page
// ---------------------------------------------------------------------------

export default function DeployerPage() {
  const params = useParams<{ wallet: string }>();
  const router = useRouter();
  const wallet = params.wallet;
  const { data, loading, error, refetch } = useDeployerProfile(wallet);
  const { recordVisit } = useBrowsingHistory();

  useEffect(() => {
    if (data && !loading) {
      recordVisit({
        type: "deployer",
        subject: data.wallet,
        name: null,
        symbol: null,
        score: data.fairScore?.score ?? null,
        tier: data.fairScore?.tier ?? null,
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

      {loading && <DeployerPageSkeleton />}

      {error && !loading && (
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <AlertCircle className="size-10 text-red-500" />
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-foreground">
                Profile Unavailable
              </h2>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="size-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {data && !loading && (
        <div className="flex flex-col gap-6">
          {/* --------------------------------------------------------------- */}
          {/* Wallet Header + FairScore Display                               */}
          {/* --------------------------------------------------------------- */}
          <div className="flex flex-col items-center gap-4 text-center">
            <FairScoreDisplay
              score={data.fairScore?.score ?? 0}
              tier={data.fairScore?.tier ?? "unrated"}
              size="lg"
            />
            <div className="flex items-center gap-1">
              <span className="font-mono text-sm text-muted-foreground">
                {truncateAddress(data.wallet)}
              </span>
              <CopyButton text={data.wallet} />
            </div>
            <p className="text-[10px] text-muted-foreground/60">
              via FairScale
            </p>
          </div>

          <Separator />

          {/* --------------------------------------------------------------- */}
          {/* AI Analysis                                                     */}
          {/* --------------------------------------------------------------- */}
          <AISummaryCard
            type="deployer"
            context={data ? {
              wallet: truncateAddress(data.wallet),
              score: data.fairScore?.score,
              tier: data.fairScore?.tier,
              tokenCount: data.tokenCount,
              badgeCount: data.fairScore?.badges?.length ?? 0,
              badgeLabels: data.fairScore?.badges?.map((b) => b.label).join(", "),
            } : null}
          />

          {/* --------------------------------------------------------------- */}
          {/* Score Breakdown                                                 */}
          {/* --------------------------------------------------------------- */}
          <section aria-label="Score breakdown">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Score Breakdown
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MetricCard
                label="Decimal Score (0-100)"
                value={data.fairScore?.score?.toFixed(1) ?? "N/A"}
              />
              <MetricCard
                label="Integer Score (0-1000+)"
                value={data.fairScore?.integerScore ?? "N/A"}
              />
              <MetricCard
                label="Trust Tier"
                value={
                  data.fairScore?.tier
                    ? data.fairScore.tier.charAt(0).toUpperCase() +
                      data.fairScore.tier.slice(1)
                    : "Unrated"
                }
              />
            </div>
          </section>

          {/* --------------------------------------------------------------- */}
          {/* Wallet Analytics Radar                                          */}
          {/* --------------------------------------------------------------- */}
          <WalletAnalyticsChart features={data.fairScore?.features} />

          {/* --------------------------------------------------------------- */}
          {/* Score History                                                   */}
          {/* --------------------------------------------------------------- */}
          <ScoreHistoryChart
            type="wallet"
            subject={data.wallet}
            label="FairScore"
            color="#7c3aed"
          />

          {/* --------------------------------------------------------------- */}
          {/* Badges                                                          */}
          {/* --------------------------------------------------------------- */}
          {data.fairScore?.badges && data.fairScore.badges.length > 0 && (
            <section aria-label="Badges">
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                Badges
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {data.fairScore.badges.map((badge) => {
                  const colors = getTierColor(badge.tier as FairScoreTier);
                  return (
                    <Card key={badge.id} className="text-center">
                      <CardContent className="flex flex-col items-center gap-2 py-4">
                        <div
                          className={cn(
                            "flex size-10 items-center justify-center rounded-full",
                            colors.bg
                          )}
                        >
                          <Award
                            className={cn("size-5", colors.text)}
                            aria-hidden="true"
                          />
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {badge.label}
                        </span>
                        <Badge
                          className={cn(
                            "border capitalize",
                            colors.bg,
                            colors.text,
                            colors.border
                          )}
                        >
                          {badge.tier}
                        </Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {/* --------------------------------------------------------------- */}
          {/* Deployer Metrics                                                */}
          {/* --------------------------------------------------------------- */}
          <section aria-label="Deployer metrics">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Metrics
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <MetricCard
                label="Tokens Deployed"
                value={data.tokenCount}
              />
              {data.fairScore?.updatedAt && (
                <MetricCard
                  label="Last Updated"
                  value={new Date(data.fairScore.updatedAt).toLocaleDateString(
                    undefined,
                    { dateStyle: "medium" }
                  )}
                />
              )}
              <MetricCard
                label="Badges Earned"
                value={data.fairScore?.badges?.length ?? 0}
              />
            </div>
          </section>

          {/* --------------------------------------------------------------- */}
          {/* Improvement Tips                                                */}
          {/* --------------------------------------------------------------- */}
          {data.recommendations && data.recommendations.length > 0 && (
            <ScoreRecommendations recommendations={data.recommendations} />
          )}

          {/* --------------------------------------------------------------- */}
          {/* Token Network Graph                                             */}
          {/* --------------------------------------------------------------- */}
          {data.deployedTokens.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Token Network</CardTitle>
                <CardDescription>
                  Tokens deployed by this wallet. Node size reflects trust
                  rating. Click a token to view its analysis.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TokenGraph
                  tokens={data.deployedTokens.map((t) => ({
                    mint: t.mint,
                    name: t.name,
                    symbol: t.symbol,
                    trustRating: t.trust_rating,
                    deployerTier: t.deployer_tier,
                    riskFlags: t.risk_flags ?? [],
                  }))}
                  walletLabel={truncateAddress(data.wallet)}
                  walletTier={data.fairScore?.tier ?? "unrated"}
                />
              </CardContent>
            </Card>
          )}

          {/* --------------------------------------------------------------- */}
          {/* Deployer Timeline                                               */}
          {/* --------------------------------------------------------------- */}
          {data.deployedTokens.length > 0 && (
            <DeployerTimeline tokens={data.deployedTokens} />
          )}

          {/* --------------------------------------------------------------- */}
          {/* Deployed Tokens                                                 */}
          {/* --------------------------------------------------------------- */}
          <section aria-label="Deployed tokens">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Deployed Tokens
            </h2>
            {data.deployedTokens.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {data.deployedTokens.map((token) => (
                  <TokenCard
                    key={token.mint}
                    mint={token.mint}
                    name={token.name}
                    symbol={token.symbol}
                    trustRating={token.trust_rating}
                    deployerTier={token.deployer_tier}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <CardDescription>
                    No analyzed tokens found for this deployer yet.
                  </CardDescription>
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
