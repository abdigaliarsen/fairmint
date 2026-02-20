"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import TrustRating from "@/components/features/TrustRating";
import HolderQualityBar from "@/components/features/HolderQualityBar";
import RiskFlags from "@/components/features/RiskFlags";
import HolderGraph from "@/components/features/HolderGraph";
import ScoreRecommendations from "@/components/features/ScoreRecommendations";
import AISummaryCard from "@/components/features/AISummaryCard";
import ScoreHistoryChart from "@/components/features/ScoreHistoryChart";
import { useTokenAnalysis } from "@/hooks/useTokenAnalysis";
import { useHolders } from "@/hooks/useHolders";
import { generateTokenTips } from "@/lib/recommendations";

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
// Loading Skeleton
// ---------------------------------------------------------------------------

function TokenPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-64" />
      </div>

      {/* Trust Rating skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-2 h-2 w-full" />
        </CardContent>
      </Card>

      {/* Deployer info skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <Skeleton className="size-24 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </CardContent>
      </Card>

      {/* Holder Quality skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-2 h-2 w-full" />
        </CardContent>
      </Card>

      {/* Risk Flags skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    </div>
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

      {loading && <TokenPageSkeleton />}

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
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              {data.name ?? "Unknown Token"}
              {data.symbol && (
                <span className="ml-2 text-lg font-normal text-muted-foreground">
                  ${data.symbol}
                </span>
              )}
            </h1>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <span className="font-mono">{truncateAddress(data.mint)}</span>
              <CopyButton text={data.mint} />
            </div>
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
            </CardContent>
          </Card>

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
            </CardContent>
          </Card>

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
