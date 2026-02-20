# TokenTrust V2 Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 5 FairScale-deep features (Token Comparison, Wallet Reputation Page, Holder Network Graph, In-app Alerts, Score Improvement Recommendations) that maximize FAIRathon judging criteria.

**Architecture:** Each feature follows the existing pattern: client component + API route + service logic. Features are built in dependency order — Recommendations first (used by Reputation Page), then standalone features, then Alerts (requires Supabase migration). All features use tier gating via the existing `TierGate` component.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, shadcn/ui, Supabase, FairScale API, Helius SDK, Zod validation.

---

## Build Order & Dependencies

```
Task 1: Score Recommendations component  (standalone, used by Tasks 4 & dashboard)
Task 2: Holder Network Graph             (standalone, embedded in token page)
Task 3: Token Comparison page            (new route, tier-gated slots)
Task 4: Wallet Reputation Page           (uses Task 1 component, OG image)
Task 5: In-app Alerts                    (Supabase migration + bell icon)
Task 6: Header nav updates               (adds Compare link + NotificationBell)
Task 7: Dashboard integration            (adds Recommendations to dashboard)
```

---

## Task 1: Score Improvement Recommendations

**Files:**
- Create: `src/components/features/ScoreRecommendations.tsx`
- Create: `src/lib/recommendations.ts`

### Step 1: Create recommendation logic

Create `src/lib/recommendations.ts` — a pure function that analyzes FairScore data and on-chain signals to generate actionable recommendations.

```typescript
// src/lib/recommendations.ts
import type { FairScoreData, FairScoreTier } from "@/types/database";
import type { TrustAnalysis } from "@/services/tokenAnalyzer";

export interface Recommendation {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  category: "score" | "defi" | "distribution" | "authority" | "social" | "age";
}

/**
 * Generate reputation improvement recommendations for a wallet.
 *
 * Analyzes FairScore data and optional token analysis to produce
 * actionable tips. Tier gating controls detail level:
 *   - unrated/bronze: basic tips (top 3)
 *   - silver: detailed tips (top 5)
 *   - gold/platinum: full action plan (all)
 */
export function generateRecommendations(
  fairScore: FairScoreData | null,
  tokens?: TrustAnalysis[],
  tier?: FairScoreTier
): Recommendation[] {
  const recs: Recommendation[] = [];
  const effectiveTier = tier ?? fairScore?.tier ?? "unrated";

  // 1. No score at all
  if (!fairScore || effectiveTier === "unrated") {
    recs.push({
      id: "no-score",
      priority: "high",
      title: "Build on-chain history",
      description:
        "Your wallet has no FairScale reputation yet. Start by making transactions, interacting with DeFi protocols, and building on-chain activity.",
      category: "score",
    });
  }

  // 2. Low score
  if (fairScore && fairScore.integerScore < 300) {
    recs.push({
      id: "low-score",
      priority: "high",
      title: "Increase DeFi activity",
      description:
        "Interact with more Solana DeFi protocols — swap tokens, provide liquidity, or stake SOL. Diverse activity signals trustworthiness.",
      category: "defi",
    });
  }

  // 3. No badges
  if (!fairScore?.badges || fairScore.badges.length === 0) {
    recs.push({
      id: "no-badges",
      priority: "medium",
      title: "Complete social verification on FairScale",
      description:
        "Link your Twitter and Discord accounts on FairScale to earn verification badges that boost your reputation.",
      category: "social",
    });
  }

  // 4. Token-specific: high concentration
  if (tokens?.some((t) => t.topHolderConcentration > 25)) {
    recs.push({
      id: "concentration",
      priority: "medium",
      title: "Improve token distribution",
      description:
        "Some of your tokens have high holder concentration. Broader distribution signals healthier tokenomics.",
      category: "distribution",
    });
  }

  // 5. Token-specific: active mint authority
  if (tokens?.some((t) => t.riskFlags.some((f) => f.label === "Active Mint Authority"))) {
    recs.push({
      id: "mint-authority",
      priority: "medium",
      title: "Renounce mint authority",
      description:
        "Tokens with active mint authority are flagged as risky. Renouncing it signals commitment and builds trust.",
      category: "authority",
    });
  }

  // 6. Token-specific: active freeze authority
  if (tokens?.some((t) => t.riskFlags.some((f) => f.label === "Active Freeze Authority"))) {
    recs.push({
      id: "freeze-authority",
      priority: "low",
      title: "Renounce freeze authority",
      description:
        "Removing freeze authority from your tokens removes a risk flag and improves holder confidence.",
      category: "authority",
    });
  }

  // 7. Score between 300-600: push to gold
  if (fairScore && fairScore.integerScore >= 300 && fairScore.integerScore < 600) {
    recs.push({
      id: "push-gold",
      priority: "medium",
      title: "Reach Gold tier",
      description:
        "You're Silver tier — keep building consistent on-chain activity and attract higher-reputation holders to reach Gold (600+).",
      category: "score",
    });
  }

  // 8. Score between 600-850: push to platinum
  if (fairScore && fairScore.integerScore >= 600 && fairScore.integerScore < 850) {
    recs.push({
      id: "push-platinum",
      priority: "low",
      title: "Reach Platinum tier",
      description:
        "You're Gold tier — maintain activity, earn more badges, and attract high-reputation holders to reach Platinum (850+).",
      category: "score",
    });
  }

  // Tier-based limit
  const tierOrder: Record<string, number> = {
    unrated: -1, bronze: 0, silver: 1, gold: 2, platinum: 3,
  };
  const rank = tierOrder[effectiveTier] ?? -1;

  if (rank <= 0) return recs.slice(0, 3);   // basic tips
  if (rank === 1) return recs.slice(0, 5);   // detailed tips
  return recs;                                // full action plan
}
```

### Step 2: Create ScoreRecommendations component

Create `src/components/features/ScoreRecommendations.tsx`:

```tsx
// src/components/features/ScoreRecommendations.tsx
"use client";

import { Lightbulb, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Recommendation } from "@/lib/recommendations";

interface ScoreRecommendationsProps {
  recommendations: Recommendation[];
}

const priorityStyles: Record<string, { badge: string; border: string }> = {
  high: {
    badge: "bg-red-50 text-red-600 border-red-300",
    border: "border-l-red-500",
  },
  medium: {
    badge: "bg-yellow-50 text-yellow-600 border-yellow-300",
    border: "border-l-yellow-500",
  },
  low: {
    badge: "bg-emerald-50 text-emerald-600 border-emerald-300",
    border: "border-l-emerald-500",
  },
};

export default function ScoreRecommendations({
  recommendations,
}: ScoreRecommendationsProps) {
  if (recommendations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <Lightbulb className="size-8 text-emerald-500" />
          <p className="text-sm text-muted-foreground">
            Great job! No improvement recommendations at this time.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="size-5 text-yellow-500" />
          Score Improvement Tips
        </CardTitle>
        <CardDescription>
          Actionable steps to improve your FairScale reputation.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {recommendations.map((rec) => {
          const styles = priorityStyles[rec.priority];
          return (
            <div
              key={rec.id}
              className={cn(
                "rounded-lg border border-l-4 p-4",
                styles.border
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground">
                      {rec.title}
                    </h4>
                    <Badge
                      className={cn("border text-xs capitalize", styles.badge)}
                    >
                      {rec.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {rec.description}
                  </p>
                </div>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

### Step 3: Commit

```bash
git add src/lib/recommendations.ts src/components/features/ScoreRecommendations.tsx
git commit -m "feat: add Score Improvement Recommendations component and logic"
```

---

## Task 2: Holder Network Graph

**Files:**
- Create: `src/components/features/HolderGraph.tsx`
- Create: `src/hooks/useHolders.ts`
- Modify: `src/app/token/[mint]/page.tsx` (add graph section)

### Step 1: Create useHolders hook

Create `src/hooks/useHolders.ts`:

```typescript
// src/hooks/useHolders.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import type { FairScoreTier } from "@/types/database";

export interface HolderNode {
  owner: string;
  amount: number;
  percentage: number;
  fairScore: number | null;
  tier: FairScoreTier;
}

interface UseHoldersReturn {
  holders: HolderNode[];
  loading: boolean;
  error: string | null;
}

export function useHolders(mint: string, limit: number = 10): UseHoldersReturn {
  const [holders, setHolders] = useState<HolderNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHolders = useCallback(async () => {
    if (!mint) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/token/${encodeURIComponent(mint)}/holders?limit=${limit}`
      );

      if (!res.ok) {
        setError("Failed to fetch holders.");
        setHolders([]);
        return;
      }

      const json = await res.json();
      setHolders(json.holders ?? []);
    } catch {
      setError("An unexpected error occurred.");
      setHolders([]);
    } finally {
      setLoading(false);
    }
  }, [mint, limit]);

  useEffect(() => {
    fetchHolders();
  }, [fetchHolders]);

  return { holders, loading, error };
}
```

### Step 2: Create HolderGraph component

Create `src/components/features/HolderGraph.tsx` — a simplified cluster visualization using SVG (no external dependencies):

```tsx
// src/components/features/HolderGraph.tsx
"use client";

import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import type { HolderNode } from "@/hooks/useHolders";
import type { FairScoreTier } from "@/types/database";

interface HolderGraphProps {
  holders: HolderNode[];
  tokenName: string | null;
  loading?: boolean;
}

const TIER_FILL: Record<FairScoreTier, string> = {
  platinum: "#7c3aed", // violet-600
  gold: "#eab308",     // yellow-500
  silver: "#64748b",   // slate-500
  bronze: "#d97706",   // amber-600
  unrated: "#9ca3af",  // gray-400
};

const CENTER_X = 200;
const CENTER_Y = 200;
const ORBIT_RADIUS = 130;

export default function HolderGraph({
  holders,
  tokenName,
  loading,
}: HolderGraphProps) {
  if (loading) {
    return <Skeleton className="h-[400px] w-full rounded-lg" />;
  }

  if (holders.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No holder data available for visualization.
      </p>
    );
  }

  const nodes = useMemo(() => {
    return holders.map((h, i) => {
      const angle = (2 * Math.PI * i) / holders.length - Math.PI / 2;
      const minR = 12;
      const maxR = 28;
      const maxPct = Math.max(...holders.map((hh) => hh.percentage), 1);
      const radius = minR + ((h.percentage / maxPct) * (maxR - minR));

      return {
        ...h,
        cx: CENTER_X + ORBIT_RADIUS * Math.cos(angle),
        cy: CENTER_Y + ORBIT_RADIUS * Math.sin(angle),
        r: radius,
        fill: TIER_FILL[h.tier] || TIER_FILL.unrated,
        truncAddr: `${h.owner.slice(0, 4)}...${h.owner.slice(-4)}`,
      };
    });
  }, [holders]);

  return (
    <div className="flex flex-col gap-4">
      <svg
        viewBox="0 0 400 400"
        className="mx-auto w-full max-w-[400px]"
        role="img"
        aria-label={`Holder network graph for ${tokenName ?? "token"}`}
      >
        {/* Lines from center to each node */}
        {nodes.map((node) => (
          <line
            key={`line-${node.owner}`}
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={node.cx}
            y2={node.cy}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
          />
        ))}

        {/* Center node (token) */}
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={32}
          fill="currentColor"
          className="text-emerald-600"
        />
        <text
          x={CENTER_X}
          y={CENTER_Y + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={10}
          fontWeight={600}
        >
          TOKEN
        </text>

        {/* Holder nodes */}
        {nodes.map((node) => (
          <g key={node.owner}>
            <circle
              cx={node.cx}
              cy={node.cy}
              r={node.r}
              fill={node.fill}
              fillOpacity={0.85}
              stroke={node.fill}
              strokeWidth={2}
              strokeOpacity={0.3}
            />
            <text
              x={node.cx}
              y={node.cy - node.r - 6}
              textAnchor="middle"
              fill="currentColor"
              className="text-muted-foreground"
              fontSize={9}
            >
              {node.truncAddr}
            </text>
            <text
              x={node.cx}
              y={node.cy + 3}
              textAnchor="middle"
              fill="white"
              fontSize={9}
              fontWeight={600}
            >
              {node.percentage.toFixed(0)}%
            </text>
          </g>
        ))}
      </svg>

      {/* Tier legend */}
      <div
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
        aria-label="Tier color legend"
      >
        {(["platinum", "gold", "silver", "bronze", "unrated"] as FairScoreTier[]).map(
          (tier) => {
            const colors = getTierColor(tier);
            return (
              <div key={tier} className="flex items-center gap-1.5">
                <span
                  className={cn("inline-block size-2.5 rounded-full", colors.bg, colors.border, "border")}
                  aria-hidden="true"
                />
                <span className="capitalize">{tier}</span>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}
```

### Step 3: Embed HolderGraph in token page

Modify `src/app/token/[mint]/page.tsx`. Add imports and a new section after the Holder Quality card (after line 297):

Add imports at top:
```typescript
import HolderGraph from "@/components/features/HolderGraph";
import { useHolders } from "@/hooks/useHolders";
```

Add hook call inside `TokenPage()` after `useTokenAnalysis`:
```typescript
const { holders, loading: holdersLoading } = useHolders(mint, 10);
```

Add new Card section between the Holder Quality card and the Risk Flags card (after the closing `</Card>` on the Holder Quality section, before the Risk Flags section):

```tsx
{/* --------------------------------------------------------------- */}
{/* Holder Network Graph                                            */}
{/* --------------------------------------------------------------- */}
<Card>
  <CardHeader>
    <CardTitle>Holder Network</CardTitle>
    <CardDescription>
      Top holders colored by FairScale reputation tier. Node size reflects holding percentage.
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
```

### Step 4: Commit

```bash
git add src/hooks/useHolders.ts src/components/features/HolderGraph.tsx src/app/token/\[mint\]/page.tsx
git commit -m "feat: add Holder Network Graph to token page"
```

---

## Task 3: Token Comparison Page

**Files:**
- Create: `src/app/compare/page.tsx`
- Create: `src/components/features/ComparisonSlot.tsx`
- Create: `src/app/api/compare/route.ts`

### Step 1: Create comparison API route

Create `src/app/api/compare/route.ts`:

```typescript
// src/app/api/compare/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeToken } from "@/services/tokenAnalyzer";

const querySchema = z.object({
  mints: z
    .string()
    .transform((s) => s.split(",").map((m) => m.trim()).filter(Boolean))
    .pipe(z.array(z.string().min(32).max(44)).min(1).max(4)),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = querySchema.safeParse({ mints: searchParams.get("mints") ?? "" });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      parsed.data.mints.map((mint) => analyzeToken(mint))
    );

    return NextResponse.json({
      tokens: results.filter(Boolean),
    });
  } catch (error) {
    console.error("GET /api/compare error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### Step 2: Create ComparisonSlot component

Create `src/components/features/ComparisonSlot.tsx`:

```tsx
// src/components/features/ComparisonSlot.tsx
"use client";

import { X, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import TrustRating from "@/components/features/TrustRating";
import HolderQualityBar from "@/components/features/HolderQualityBar";
import FairScoreDisplay from "@/components/features/FairScoreDisplay";
import TokenSearch from "@/components/features/TokenSearch";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import type { TrustAnalysis } from "@/services/tokenAnalyzer";

interface ComparisonSlotProps {
  token: TrustAnalysis | null;
  loading: boolean;
  isWinner: boolean;
  onSelect: (mint: string) => void;
  onRemove: () => void;
}

export default function ComparisonSlot({
  token,
  loading,
  isWinner,
  onSelect,
  onRemove,
}: ComparisonSlotProps) {
  if (loading) {
    return (
      <Card className="flex-1">
        <CardContent className="flex flex-col gap-4 p-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-24 w-24 self-center rounded-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!token) {
    return (
      <Card className="flex flex-1 flex-col border-dashed">
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <p className="text-sm text-muted-foreground">Add a token to compare</p>
          <div className="w-full max-w-xs">
            <TokenSearch onSelect={onSelect} placeholder="Search token..." />
          </div>
        </CardContent>
      </Card>
    );
  }

  const tierColors = token.deployerTier ? getTierColor(token.deployerTier) : null;

  return (
    <Card className={cn("relative flex-1", isWinner && "ring-2 ring-emerald-500")}>
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
        aria-label={`Remove ${token.name ?? token.mint}`}
      >
        <X className="size-4" />
      </Button>
      <CardHeader className="pb-2 pt-6">
        <CardTitle className="truncate text-base">
          {token.name ?? "Unknown"}
          {token.symbol && (
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              ${token.symbol}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Trust Rating */}
        <TrustRating rating={token.trustRating} />

        {/* Deployer */}
        {token.deployerTier && tierColors && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Deployer:</span>
            <Badge className={cn("border capitalize", tierColors.bg, tierColors.text, tierColors.border)}>
              {token.deployerTier}
            </Badge>
          </div>
        )}

        {/* Holder Quality */}
        <HolderQualityBar
          score={token.holderQualityScore}
          holderCount={token.holderCount}
        />

        {/* Risk Flags count */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Risk flags</span>
          <Badge
            className={cn(
              "border",
              token.riskFlags.length === 0
                ? "bg-emerald-50 text-emerald-600 border-emerald-300"
                : "bg-red-50 text-red-600 border-red-300"
            )}
          >
            {token.riskFlags.length}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Step 3: Create Compare page

Create `src/app/compare/page.tsx`:

```tsx
// src/app/compare/page.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Scale } from "lucide-react";
import ComparisonSlot from "@/components/features/ComparisonSlot";
import { useFairScore } from "@/hooks/useFairScore";
import type { TrustAnalysis } from "@/services/tokenAnalyzer";
import type { FairScoreTier } from "@/types/database";

function getMaxSlots(tier: FairScoreTier): number {
  switch (tier) {
    case "gold":
    case "platinum":
      return 4;
    case "silver":
      return 3;
    default:
      return 2;
  }
}

export default function ComparePage() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const { data: fairScore } = useFairScore(walletAddress);

  const currentTier: FairScoreTier = fairScore?.tier ?? "unrated";
  const maxSlots = getMaxSlots(currentTier);

  const [tokens, setTokens] = useState<(TrustAnalysis | null)[]>(
    Array(maxSlots).fill(null)
  );
  const [loadingSlots, setLoadingSlots] = useState<boolean[]>(
    Array(maxSlots).fill(false)
  );

  // Adjust slot count when tier changes
  useEffect(() => {
    setTokens((prev) => {
      if (prev.length === maxSlots) return prev;
      if (prev.length < maxSlots) {
        return [...prev, ...Array(maxSlots - prev.length).fill(null)];
      }
      return prev.slice(0, maxSlots);
    });
    setLoadingSlots((prev) => {
      if (prev.length === maxSlots) return prev;
      if (prev.length < maxSlots) {
        return [...prev, ...Array(maxSlots - prev.length).fill(false)];
      }
      return prev.slice(0, maxSlots);
    });
  }, [maxSlots]);

  const handleSelect = useCallback(
    async (slotIndex: number, mint: string) => {
      setLoadingSlots((prev) => {
        const next = [...prev];
        next[slotIndex] = true;
        return next;
      });

      try {
        const res = await fetch(`/api/compare?mints=${encodeURIComponent(mint)}`);
        if (res.ok) {
          const data = await res.json();
          const token = data.tokens?.[0] ?? null;
          setTokens((prev) => {
            const next = [...prev];
            next[slotIndex] = token;
            return next;
          });
        }
      } catch {
        // keep slot empty on error
      } finally {
        setLoadingSlots((prev) => {
          const next = [...prev];
          next[slotIndex] = false;
          return next;
        });
      }
    },
    []
  );

  const handleRemove = useCallback((slotIndex: number) => {
    setTokens((prev) => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
  }, []);

  // Determine winner (highest trust rating among filled slots)
  const filledTokens = tokens.filter(Boolean) as TrustAnalysis[];
  const highestRating =
    filledTokens.length >= 2
      ? Math.max(...filledTokens.map((t) => t.trustRating))
      : -1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
          <Scale className="size-7 text-emerald-600" />
          Token Comparison
        </h1>
        <p className="text-sm text-muted-foreground">
          Compare tokens side-by-side. {maxSlots} slots available for your{" "}
          <span className="font-medium capitalize">{currentTier}</span> tier.
          {currentTier !== "gold" && currentTier !== "platinum" && (
            <span>
              {" "}
              Upgrade your FairScale reputation to unlock more slots.
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tokens.slice(0, maxSlots).map((token, i) => (
          <ComparisonSlot
            key={i}
            token={token}
            loading={loadingSlots[i]}
            isWinner={
              token !== null &&
              filledTokens.length >= 2 &&
              token.trustRating === highestRating
            }
            onSelect={(mint) => handleSelect(i, mint)}
            onRemove={() => handleRemove(i)}
          />
        ))}
      </div>
    </div>
  );
}
```

### Step 4: Commit

```bash
git add src/app/api/compare/route.ts src/components/features/ComparisonSlot.tsx src/app/compare/page.tsx
git commit -m "feat: add Token Comparison page with tier-gated slots"
```

---

## Task 4: Wallet Reputation Page ("Trust Passport")

**Files:**
- Create: `src/app/reputation/[wallet]/page.tsx`
- Create: `src/app/reputation/[wallet]/opengraph-image.tsx`
- Create: `src/app/api/reputation/[wallet]/route.ts`

### Step 1: Create reputation API route

Create `src/app/api/reputation/[wallet]/route.ts`:

```typescript
// src/app/api/reputation/[wallet]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFullScore, getWalletScore } from "@/services/fairscale";
import { generateRecommendations } from "@/lib/recommendations";

const paramSchema = z.object({
  wallet: z
    .string()
    .min(32, "Invalid wallet address")
    .max(44, "Invalid wallet address"),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;
    const parsed = paramSchema.safeParse({ wallet });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid wallet address", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Fetch all 3 FairScale endpoints for deepest profile
    const [fullScore, walletScore] = await Promise.all([
      getFullScore(parsed.data.wallet),
      getWalletScore(parsed.data.wallet),
    ]);

    const recommendations = generateRecommendations(
      fullScore,
      undefined,
      fullScore?.tier
    );

    return NextResponse.json({
      wallet: parsed.data.wallet,
      fairScore: fullScore,
      walletScore,
      recommendations,
    });
  } catch (error) {
    console.error("GET /api/reputation/[wallet] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### Step 2: Create Reputation page

Create `src/app/reputation/[wallet]/page.tsx`:

```tsx
// src/app/reputation/[wallet]/page.tsx
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
      {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
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

          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="size-4" />
              Share your Trust Passport
            </Button>
          </div>

          <Separator />

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

          {/* Score Details */}
          <Card>
            <CardHeader>
              <CardTitle>Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  Decimal Score
                </span>
                <span className="text-lg font-semibold">
                  {data.fairScore?.decimalScore?.toFixed(1) ?? "N/A"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  Integer Score
                </span>
                <span className="text-lg font-semibold">
                  {data.fairScore?.integerScore ?? "N/A"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  Wallet Score
                </span>
                <span className="text-lg font-semibold">
                  {data.walletScore ?? "N/A"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  Badge Count
                </span>
                <span className="text-lg font-semibold">
                  {data.fairScore?.badges?.length ?? 0}
                </span>
              </div>
            </CardContent>
          </Card>

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
```

### Step 3: Create OG image for social sharing

Create `src/app/reputation/[wallet]/opengraph-image.tsx`:

```tsx
// src/app/reputation/[wallet]/opengraph-image.tsx
import { ImageResponse } from "next/og";
import { getFullScore, classifyTier } from "@/services/fairscale";

export const runtime = "edge";
export const alt = "Trust Passport";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TIER_COLORS: Record<string, string> = {
  platinum: "#7c3aed",
  gold: "#eab308",
  silver: "#64748b",
  bronze: "#d97706",
  unrated: "#9ca3af",
};

export default async function Image({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = await params;
  const truncated = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

  let tier = "unrated";
  let score = 0;
  try {
    const data = await getFullScore(wallet);
    if (data) {
      tier = data.tier;
      score = data.decimalScore;
    }
  } catch {
    // Use defaults
  }

  const color = TIER_COLORS[tier] || TIER_COLORS.unrated;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Score circle */}
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: "50%",
            border: `6px solid ${color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 700, color: "white" }}>
            {Math.round(score)}
          </div>
        </div>

        {/* Tier badge */}
        <div
          style={{
            padding: "8px 24px",
            borderRadius: 9999,
            background: color,
            color: "white",
            fontSize: 24,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 2,
            marginBottom: 16,
          }}
        >
          {tier}
        </div>

        {/* Wallet */}
        <div style={{ color: "#94a3b8", fontSize: 20 }}>{truncated}</div>

        {/* Branding */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#10b981",
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          TokenTrust — Trust Passport
        </div>
      </div>
    ),
    { ...size }
  );
}
```

### Step 4: Commit

```bash
git add src/app/api/reputation/\[wallet\]/route.ts src/app/reputation/\[wallet\]/page.tsx src/app/reputation/\[wallet\]/opengraph-image.tsx
git commit -m "feat: add Wallet Reputation Page (Trust Passport) with OG image"
```

---

## Task 5: In-app Alerts (Notifications)

**Files:**
- Create: `src/components/features/NotificationBell.tsx`
- Create: `src/app/api/notifications/route.ts`
- Create: `src/hooks/useNotifications.ts`
- Modify: `src/types/database.ts` (add Notification type)
- Supabase migration: `notifications` table

### Step 1: Add Notification type to database types

Add to `src/types/database.ts` after the WatchlistItem types (around line 128):

```typescript
// ---------------------------------------------------------------------------
// Notifications (Supabase table: notifications)
// ---------------------------------------------------------------------------

export interface Notification {
  id: string;
  user_wallet: string;
  mint: string;
  token_name: string | null;
  type: "score_change" | "new_risk_flag";
  message: string;
  old_value: number | null;
  new_value: number | null;
  read: boolean;
  created_at: string;
}

export type NotificationInsert = Omit<Notification, "id" | "created_at">;
```

Also add `notifications` to the Database type map:

```typescript
notifications: {
  Row: Notification;
  Insert: NotificationInsert;
  Update: Partial<NotificationInsert>;
  Relationships: [];
};
```

### Step 2: Create Supabase migration for notifications table

Run via Supabase MCP `apply_migration` or execute SQL:

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_wallet text NOT NULL,
  mint text NOT NULL,
  token_name text,
  type text NOT NULL CHECK (type IN ('score_change', 'new_risk_flag')),
  message text NOT NULL,
  old_value numeric,
  new_value numeric,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notifications_wallet ON notifications (user_wallet, read, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read notifications" ON notifications
  FOR SELECT USING (true);
CREATE POLICY "Anyone can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update notifications" ON notifications
  FOR UPDATE USING (true);
```

### Step 3: Create notifications API route

Create `src/app/api/notifications/route.ts`:

```typescript
// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { analyzeToken } from "@/services/tokenAnalyzer";

const getSchema = z.object({
  wallet: z.string().min(32).max(44),
});

const patchSchema = z.object({
  wallet: z.string().min(32).max(44),
  notificationIds: z.array(z.string().uuid()).optional(),
  markAllRead: z.boolean().optional(),
});

/**
 * GET /api/notifications?wallet=...
 * Returns notifications + checks watchlist tokens for changes (generates new alerts).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = getSchema.safeParse({ wallet: searchParams.get("wallet") ?? "" });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    const { wallet } = parsed.data;

    // Fetch existing notifications
    const { data: notifications } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_wallet", wallet)
      .order("created_at", { ascending: false })
      .limit(50);

    // Check watchlist for changes (generate new alerts)
    const { data: watchlistItems } = await supabase
      .from("watchlist")
      .select("mint")
      .eq("user_id", wallet);

    if (watchlistItems && watchlistItems.length > 0) {
      // Get current cached analyses
      const mints = watchlistItems.map((w) => w.mint);
      const { data: cachedAnalyses } = await supabase
        .from("token_analyses")
        .select("mint, name, trust_rating, risk_flags, analyzed_at")
        .in("mint", mints);

      // Re-analyze a subset to check for changes (limit to 3 per visit to respect rate limits)
      const toCheck = mints.slice(0, 3);
      for (const mint of toCheck) {
        const cached = cachedAnalyses?.find((a) => a.mint === mint);
        if (!cached) continue;

        const fresh = await analyzeToken(mint);
        if (!fresh) continue;

        const ratingDiff = Math.abs(fresh.trustRating - cached.trust_rating);

        // Generate alert if trust rating changed by 5+ points
        if (ratingDiff >= 5) {
          const existing = (notifications ?? []).find(
            (n) =>
              n.mint === mint &&
              n.type === "score_change" &&
              new Date(n.created_at).getTime() >
                Date.now() - 24 * 60 * 60 * 1000
          );

          if (!existing) {
            await supabase.from("notifications").insert({
              user_wallet: wallet,
              mint,
              token_name: fresh.name,
              type: "score_change",
              message: `${fresh.name ?? mint.slice(0, 8)} trust rating changed from ${cached.trust_rating} to ${fresh.trustRating}`,
              old_value: cached.trust_rating,
              new_value: fresh.trustRating,
              read: false,
            });
          }
        }

        // Check for new risk flags
        const oldFlagCount = Array.isArray(cached.risk_flags) ? cached.risk_flags.length : 0;
        if (fresh.riskFlags.length > oldFlagCount) {
          const existing = (notifications ?? []).find(
            (n) =>
              n.mint === mint &&
              n.type === "new_risk_flag" &&
              new Date(n.created_at).getTime() >
                Date.now() - 24 * 60 * 60 * 1000
          );

          if (!existing) {
            await supabase.from("notifications").insert({
              user_wallet: wallet,
              mint,
              token_name: fresh.name,
              type: "new_risk_flag",
              message: `New risk flag detected for ${fresh.name ?? mint.slice(0, 8)}`,
              old_value: oldFlagCount,
              new_value: fresh.riskFlags.length,
              read: false,
            });
          }
        }
      }
    }

    // Re-fetch notifications after potential inserts
    const { data: updatedNotifications } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_wallet", wallet)
      .order("created_at", { ascending: false })
      .limit(50);

    const unreadCount =
      updatedNotifications?.filter((n) => !n.read).length ?? 0;

    return NextResponse.json({
      notifications: updatedNotifications ?? [],
      unreadCount,
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications — mark notifications as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    const { wallet, notificationIds, markAllRead } = parsed.data;

    if (markAllRead) {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_wallet", wallet)
        .eq("read", false);
    } else if (notificationIds?.length) {
      await supabase
        .from("notifications")
        .update({ read: true })
        .in("id", notificationIds);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### Step 4: Create useNotifications hook

Create `src/hooks/useNotifications.ts`:

```typescript
// src/hooks/useNotifications.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Notification } from "@/types/database";

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (ids?: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  refetch: () => void;
}

export function useNotifications(wallet: string | null): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!wallet) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/notifications?wallet=${encodeURIComponent(wallet)}`
      );
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = useCallback(
    async (ids?: string[]) => {
      if (!wallet) return;
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet, notificationIds: ids }),
        });
        await fetchNotifications();
      } catch {
        // Silently fail
      }
    },
    [wallet, fetchNotifications]
  );

  const markAllRead = useCallback(async () => {
    if (!wallet) return;
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, markAllRead: true }),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // Silently fail
    }
  }, [wallet]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllRead,
    refetch: fetchNotifications,
  };
}
```

### Step 5: Create NotificationBell component

Create `src/components/features/NotificationBell.tsx`:

```tsx
// src/components/features/NotificationBell.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/database";

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onMarkRead: (ids: string[]) => void;
}

export default function NotificationBell({
  notifications,
  unreadCount,
  onMarkAllRead,
  onMarkRead,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleNotificationClick(n: Notification) {
    if (!n.read) onMarkRead([n.id]);
    router.push(`/token/${n.mint}`);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-background shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-muted-foreground"
                onClick={onMarkAllRead}
              >
                <Check className="size-3" />
                Mark all read
              </Button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet. We'll alert you when watchlist tokens change.
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                    !n.read && "bg-muted/30"
                  )}
                >
                  {n.type === "score_change" ? (
                    n.new_value !== null &&
                    n.old_value !== null &&
                    n.new_value > n.old_value ? (
                      <TrendingUp className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    ) : (
                      <TrendingDown className="mt-0.5 size-4 shrink-0 text-red-500" />
                    )
                  ) : (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-500" />
                  )}
                  <div className="flex flex-col gap-0.5">
                    <span className={cn("text-sm", !n.read && "font-medium")}>
                      {n.message}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 6: Commit

```bash
git add src/types/database.ts src/app/api/notifications/route.ts src/hooks/useNotifications.ts src/components/features/NotificationBell.tsx
git commit -m "feat: add In-app Alerts with NotificationBell and notification API"
```

---

## Task 6: Header Navigation Updates

**Files:**
- Modify: `src/components/layout/Header.tsx`

### Step 1: Update Header with Compare link and NotificationBell

Modify `src/components/layout/Header.tsx`:

Add imports:
```typescript
import { Shield, Search, LayoutDashboard, LogOut, Scale } from "lucide-react";
import NotificationBell from "@/components/features/NotificationBell";
import { useNotifications } from "@/hooks/useNotifications";
```

Inside the component, after `useWalletAuth()`, add:
```typescript
const walletAddress = publicKey?.toBase58() ?? null;
const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications(walletAddress);
```

Add Compare link to desktop nav (after the Search button, before the Dashboard button):
```tsx
<Button variant="ghost" size="sm" asChild>
  <Link href="/compare">
    <Scale className="size-4" />
    Compare
  </Link>
</Button>
```

Add Compare icon to mobile nav (after Search icon, before Dashboard icon):
```tsx
<Button variant="ghost" size="icon" asChild>
  <Link href="/compare" aria-label="Compare">
    <Scale className="size-4" />
  </Link>
</Button>
```

Add NotificationBell before the wallet connect/disconnect section (inside the `{connected && truncatedAddress ? (` block, before the address span):
```tsx
<NotificationBell
  notifications={notifications}
  unreadCount={unreadCount}
  onMarkAllRead={markAllRead}
  onMarkRead={(ids) => markAsRead(ids)}
/>
```

### Step 2: Commit

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: add Compare link and NotificationBell to header"
```

---

## Task 7: Dashboard Score Recommendations Integration

**Files:**
- Modify: `src/app/dashboard/page.tsx`

### Step 1: Add Recommendations to Dashboard

Modify `src/app/dashboard/page.tsx`:

Add imports:
```typescript
import ScoreRecommendations from "@/components/features/ScoreRecommendations";
import { generateRecommendations } from "@/lib/recommendations";
```

Inside the component, after `const benefits = tierBenefits[currentTier];`, add:
```typescript
const recommendations = generateRecommendations(fairScore, undefined, currentTier);
```

Add ScoreRecommendations section after the FairScore + Tier Card block (inside `{!isLoading && (`, after `<Separator />`):
```tsx
{/* --------------------------------------------------------------- */}
{/* Score Improvement Recommendations                               */}
{/* --------------------------------------------------------------- */}
{recommendations.length > 0 && (
  <ScoreRecommendations recommendations={recommendations} />
)}
```

### Step 2: Commit

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: add Score Improvement Recommendations to dashboard"
```

---

## Task 8: Supabase Migration + Final Integration Testing

### Step 1: Apply Supabase migration

Run the notifications table migration via Supabase MCP or Supabase dashboard SQL editor.

### Step 2: Verify dev server starts

```bash
npm run dev
```

Expected: No build errors, server starts on localhost:3000 or 3001.

### Step 3: Smoke test each feature

1. **Compare page**: Navigate to `/compare`, search for 2 tokens, verify side-by-side display and winner badge
2. **Reputation page**: Navigate to `/reputation/<any-wallet>`, verify score display, badges, recommendations, share button
3. **Holder graph**: Navigate to any `/token/<mint>`, scroll to "Holder Network" card, verify SVG graph renders
4. **Notifications**: Check bell icon in header, verify dropdown opens
5. **Recommendations on dashboard**: Connect wallet, verify tips show on dashboard

### Step 4: Final commit

```bash
git add -A
git commit -m "feat: complete V2 features - comparison, reputation, holder graph, alerts, recommendations"
```

### Step 5: Deploy to Vercel

```bash
vercel --prod
```

---

## Summary

| Task | Feature | New Files | Modified Files |
|------|---------|-----------|----------------|
| 1 | Score Recommendations | `recommendations.ts`, `ScoreRecommendations.tsx` | — |
| 2 | Holder Network Graph | `HolderGraph.tsx`, `useHolders.ts` | `token/[mint]/page.tsx` |
| 3 | Token Comparison | `compare/page.tsx`, `ComparisonSlot.tsx`, `api/compare/route.ts` | — |
| 4 | Wallet Reputation | `reputation/[wallet]/page.tsx`, `opengraph-image.tsx`, `api/reputation/[wallet]/route.ts` | — |
| 5 | In-app Alerts | `NotificationBell.tsx`, `useNotifications.ts`, `api/notifications/route.ts` | `database.ts` |
| 6 | Header Nav | — | `Header.tsx` |
| 7 | Dashboard Integration | — | `dashboard/page.tsx` |
| 8 | Migration + Deploy | — | — |
