"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  Search,
  Shield,
  TrendingUp,
  Users,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import TokenSearch from "@/components/features/TokenSearch";
import TokenCard from "@/components/features/TokenCard";
import type { FairScoreTier } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeaturedToken {
  mint: string;
  name: string | null;
  symbol: string | null;
  trust_rating: number;
  deployer_tier: FairScoreTier | null;
}

// ---------------------------------------------------------------------------
// How It Works steps
// ---------------------------------------------------------------------------

const steps = [
  {
    icon: Search,
    title: "Search Any Token",
    description:
      "Enter a Solana token address or name to start your analysis.",
  },
  {
    icon: Shield,
    title: "Check Deployer Reputation",
    description:
      "We analyze the deployer's FairScore, wallet history, and on-chain behavior.",
  },
  {
    icon: TrendingUp,
    title: "Make Informed Decisions",
    description:
      "Get a composite Trust Rating based on deployer rep, holder quality, and risk signals.",
  },
] as const;

// ---------------------------------------------------------------------------
// Feature cards
// ---------------------------------------------------------------------------

const features = [
  {
    icon: Shield,
    title: "Deployer Scoring",
    description:
      "Analyze any token deployer's on-chain reputation and FairScale score before you trade.",
  },
  {
    icon: Users,
    title: "Holder Analysis",
    description:
      "Detect sybil wallets, bot clusters, and evaluate overall holder quality.",
  },
  {
    icon: AlertTriangle,
    title: "Risk Detection",
    description:
      "Identify concentrated holdings, fresh wallets, and suspicious on-chain patterns.",
  },
  {
    icon: Zap,
    title: "Tier Benefits",
    description:
      "Higher FairScore unlocks premium features. Build your reputation and gain deeper insights.",
  },
] as const;

// ---------------------------------------------------------------------------
// Landing Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [featuredTokens, setFeaturedTokens] = useState<FeaturedToken[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);

  useEffect(() => {
    async function loadFeatured() {
      try {
        const res = await fetch("/api/featured?limit=6");
        if (res.ok) {
          const data = await res.json();
          setFeaturedTokens(data.tokens ?? []);
        }
      } catch {
        // Silently fail — featured tokens are non-critical
      } finally {
        setFeaturedLoading(false);
      }
    }
    loadFeatured();
  }, []);

  return (
    <div className="flex flex-col">
      {/* ----------------------------------------------------------------- */}
      {/* Hero Section                                                      */}
      {/* ----------------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-emerald-50/50 to-background dark:from-emerald-950/20">
        {/* Subtle decorative gradient circles */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 size-[600px] -translate-x-1/2 rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-900/20"
          aria-hidden="true"
        />

        <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Know Before You Buy
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Reputation-powered token intelligence for Solana. Check any
            token&apos;s deployer trustworthiness before you trade.
          </p>

          {/* Token Search */}
          <div className="w-full max-w-xl">
            <TokenSearch placeholder="Search tokens by name, symbol, or mint address..." />
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Featured Tokens                                                   */}
      {/* ----------------------------------------------------------------- */}
      <section className="border-b bg-background py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Trending Tokens
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            Top-rated Solana tokens analyzed by our trust algorithm.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="flex flex-col gap-3 py-4">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-full" />
                  </CardContent>
                </Card>
              ))}
            {!featuredLoading &&
              featuredTokens.map((token) => (
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
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* How It Works                                                      */}
      {/* ----------------------------------------------------------------- */}
      <section className="border-b bg-background py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            How It Works
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            Three simple steps to evaluate any Solana token.
          </p>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="flex flex-col items-center gap-4 text-center"
                >
                  {/* Step number + icon */}
                  <div className="relative flex size-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/30">
                    <Icon className="size-7 text-emerald-600" />
                    <span className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Features Grid                                                     */}
      {/* ----------------------------------------------------------------- */}
      <section className="border-b bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Built for Smarter Trading
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            Everything you need to evaluate token trustworthiness on Solana.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                      <Icon className="size-5 text-emerald-600" />
                    </div>
                    <CardTitle className="text-base">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* CTA Section                                                       */}
      {/* ----------------------------------------------------------------- */}
      <section className="bg-background py-16 sm:py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 text-center sm:px-6 lg:px-8">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/30">
            <Shield className="size-7 text-emerald-600" />
          </div>
          <h2 className="max-w-lg text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Unlock Premium Features
          </h2>
          <p className="max-w-md text-muted-foreground">
            Connect your wallet to unlock premium features based on your own
            FairScore. The higher your reputation, the more you can access.
          </p>
          {!connected && (
            <Button
              size="lg"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => setVisible(true)}
              aria-label="Connect wallet to get started"
            >
              Connect Wallet
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
