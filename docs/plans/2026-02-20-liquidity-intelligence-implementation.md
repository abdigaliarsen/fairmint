# Liquidity Intelligence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface FairScale wallet analytics and on-chain liquidity data to improve trust scoring and provide richer token/wallet analysis.

**Architecture:** Three workstreams — (1) extract FairScale `/score` features into the data model and display as radar chart, (2) detect LP vaults from Helius holders + fetch DexScreener supplementary data for a liquidity card, (3) improve trust rating formula with real wallet age and a new liquidity component.

**Tech Stack:** Recharts (RadarChart), Helius SDK, DexScreener REST API, Jupiter Price API, Supabase, Next.js API routes

---

### Task 1: Add FairScale features to the data model

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/services/fairscale.ts`

**Step 1: Add WalletFeatures type to database.ts**

Add after the `FairScaleAction` interface (around line 31):

```typescript
/** Wallet analytics features from the FairScale /score endpoint. */
export interface WalletFeatures {
  lst_percentile_score: number;
  major_percentile_score: number;
  native_sol_percentile: number;
  stable_percentile_score: number;
  tx_count: number;
  active_days: number;
  median_gap_hours: number;
  wallet_age_days: number;
  [key: string]: number;
}
```

**Step 2: Add features field to FairScoreData**

In the `FairScoreData` interface (around line 46), add:

```typescript
  /** Detailed wallet analytics features from /score */
  features?: WalletFeatures;
```

**Step 3: Extract features in fairscale.ts getFullScore()**

In `src/services/fairscale.ts`, the `FairScaleScoreResponse` interface (line 142) already has `[key: string]: unknown` which captures `features`. Update the return object in `getFullScore()` to include features.

After line 217 (`const tier = ...`), add:

```typescript
  const features = (data.features ?? {}) as WalletFeatures;
```

Then add `features` to the returned `FairScoreData` object (around line 271-280):

```typescript
  return {
    wallet,
    score: data.fairscore,
    tier,
    badges,
    actions,
    features,
    updatedAt: cacheRow.fetched_at,
    decimalScore: data.fairscore,
    integerScore: effectiveIntegerScore,
  };
```

Also add `features` to the cached data return path (around line 197-206):

```typescript
  // Extract features from cached raw_response
  const cachedFeatures = ((cached.raw_response as Record<string, unknown>)?.features ?? {}) as WalletFeatures;
```

And include `features: cachedFeatures` in that return block.

**Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/types/database.ts src/services/fairscale.ts
git commit -m "feat: extract FairScale wallet features into data model"
```

---

### Task 2: Create the DexScreener service

**Files:**
- Create: `src/services/dexscreener.ts`

**Step 1: Create the service**

```typescript
/**
 * DexScreener service — fetches token trading pair data from the
 * DexScreener public API. No API key required.
 *
 * Results are cached in Supabase with a 1-hour TTL to avoid
 * rate limits and slow responses.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd: string;
  volume: { h24: number; h6: number; h1: number; m5: number };
  liquidity: { usd: number; base: number; quote: number };
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
  labels?: string[];
}

export interface TokenLiquidity {
  /** Total liquidity across all pools (USD). */
  totalLiquidityUsd: number;
  /** 24-hour trading volume (USD). */
  volume24h: number;
  /** Volume / Liquidity ratio — healthy if > 0.5. */
  volumeLiquidityRatio: number;
  /** Number of trading pools on DEXes. */
  poolCount: number;
  /** Primary DEX by liquidity. */
  primaryDex: string | null;
  /** Fully diluted valuation (USD). */
  fdv: number;
  /** Market capitalization (USD). */
  marketCap: number;
  /** Current price (USD). */
  priceUsd: number;
  /** Timestamp of when this data was fetched. */
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEXSCREENER_BASE_URL = "https://api.dexscreener.com/tokens/v1/solana";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Fetch + Cache
// ---------------------------------------------------------------------------

/**
 * Fetch token liquidity data from DexScreener, cached in Supabase.
 * Returns null if no pairs found or on failure.
 */
export async function getTokenLiquidity(
  mint: string
): Promise<TokenLiquidity | null> {
  const supabase = createServerSupabaseClient();

  // 1. Check cache
  const { data: cached } = await supabase
    .from("dexscreener_cache")
    .select("*")
    .eq("mint", mint)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (age < CACHE_TTL_MS) {
      return cached.data as TokenLiquidity;
    }
  }

  // 2. Fetch from DexScreener
  try {
    const response = await fetch(`${DEXSCREENER_BASE_URL}/${mint}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const pairs: DexScreenerPair[] = await response.json();
    if (!pairs || pairs.length === 0) return null;

    // Aggregate across all pairs
    const totalLiquidityUsd = pairs.reduce(
      (sum, p) => sum + (p.liquidity?.usd ?? 0),
      0
    );
    const volume24h = pairs.reduce(
      (sum, p) => sum + (p.volume?.h24 ?? 0),
      0
    );

    // Find primary DEX by liquidity
    const sortedByLiquidity = [...pairs].sort(
      (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
    );
    const primaryDex = sortedByLiquidity[0]?.dexId ?? null;

    // Use the highest-liquidity pair for price/fdv/mcap
    const topPair = sortedByLiquidity[0];

    const result: TokenLiquidity = {
      totalLiquidityUsd,
      volume24h,
      volumeLiquidityRatio:
        totalLiquidityUsd > 0 ? volume24h / totalLiquidityUsd : 0,
      poolCount: pairs.length,
      primaryDex,
      fdv: topPair?.fdv ?? 0,
      marketCap: topPair?.marketCap ?? 0,
      priceUsd: parseFloat(topPair?.priceUsd ?? "0"),
      fetchedAt: new Date().toISOString(),
    };

    // 3. Cache result
    await supabase.from("dexscreener_cache").upsert(
      {
        mint,
        data: result as unknown as Record<string, unknown>,
        fetched_at: result.fetchedAt,
      },
      { onConflict: "mint" }
    );

    return result;
  } catch (error) {
    console.error(`DexScreener fetch failed for ${mint}:`, error);
    return null;
  }
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/services/dexscreener.ts
git commit -m "feat: add DexScreener service with Supabase caching"
```

---

### Task 3: Create DexScreener Supabase cache table

**Step 1: Run migration via Supabase MCP**

Use `mcp__plugin_supabase_supabase__apply_migration` with project `pxcolqnhttmdjkgprifg`:

```sql
CREATE TABLE IF NOT EXISTS dexscreener_cache (
  id SERIAL PRIMARY KEY,
  mint VARCHAR(44) NOT NULL UNIQUE,
  data JSONB NOT NULL DEFAULT '{}',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dexscreener_cache_mint ON dexscreener_cache (mint);

ALTER TABLE dexscreener_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read dexscreener_cache"
  ON dexscreener_cache FOR SELECT USING (true);
CREATE POLICY "Allow public insert dexscreener_cache"
  ON dexscreener_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update dexscreener_cache"
  ON dexscreener_cache FOR UPDATE USING (true);
```

**Step 2: Verify table exists**

Query: `SELECT table_name FROM information_schema.tables WHERE table_name = 'dexscreener_cache';`

---

### Task 4: Add LP vault detection to Helius holder data

**Files:**
- Modify: `src/services/helius.ts`

**Step 1: Add DEX program IDs and LP detection**

After the `TokenHolder` interface (around line 50), add:

```typescript
/** Known Solana DEX program IDs for LP vault detection. */
const DEX_PROGRAMS: Record<string, string> = {
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium AMM",
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK": "Raydium CLMM",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": "Orca Whirlpool",
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo": "Meteora DLMM",
  "Eo7WjKq67rjJQSZxS6z3YkapzY3eBj6xGaBpnh77SXfQ": "Meteora Pools",
};

export interface LPVault {
  /** DEX name (e.g., "Raydium AMM"). */
  dex: string;
  /** Vault token account owner. */
  owner: string;
  /** Token amount in the vault. */
  amount: number;
  /** Percentage of sampled supply in this vault. */
  percentage: number;
}

export interface HolderAnalysis {
  /** Regular (non-LP) holders. */
  holders: TokenHolder[];
  /** Identified LP vault positions. */
  lpVaults: LPVault[];
  /** Total percentage of supply in LP vaults. */
  lpSupplyPercent: number;
}
```

**Step 2: Add analyzeHolders function**

After `getTokenHolders`, add:

```typescript
/**
 * Analyze token holders to separate regular holders from LP vault positions.
 * Identifies accounts owned by known DEX programs.
 */
export function analyzeHolders(holders: TokenHolder[]): HolderAnalysis {
  const lpVaults: LPVault[] = [];
  const regularHolders: TokenHolder[] = [];

  for (const holder of holders) {
    const dex = DEX_PROGRAMS[holder.owner];
    if (dex) {
      lpVaults.push({
        dex,
        owner: holder.owner,
        amount: holder.amount,
        percentage: holder.percentage,
      });
    } else {
      regularHolders.push(holder);
    }
  }

  const lpSupplyPercent = lpVaults.reduce((sum, v) => sum + v.percentage, 0);

  return {
    holders: regularHolders,
    lpVaults,
    lpSupplyPercent,
  };
}
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/services/helius.ts
git commit -m "feat: add LP vault detection to Helius holder analysis"
```

---

### Task 5: Create the Liquidity API endpoint

**Files:**
- Create: `src/app/api/token/[mint]/liquidity/route.ts`

**Step 1: Create the endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenHolders, analyzeHolders } from "@/services/helius";
import { getTokenLiquidity } from "@/services/dexscreener";

const paramSchema = z.object({
  mint: z.string().min(32).max(44),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  const parsed = paramSchema.safeParse({ mint });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid mint" }, { status: 400 });
  }

  // Fetch Helius holders + DexScreener in parallel
  const [holders, dexData] = await Promise.all([
    getTokenHolders(parsed.data.mint, 20),
    getTokenLiquidity(parsed.data.mint),
  ]);

  const { lpVaults, lpSupplyPercent } = analyzeHolders(holders);

  return NextResponse.json({
    lpVaults,
    lpSupplyPercent,
    dexScreener: dexData,
  });
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/token/\[mint\]/liquidity/route.ts
git commit -m "feat: add liquidity API endpoint combining Helius + DexScreener"
```

---

### Task 6: Improve trust rating with real age + liquidity components

**Files:**
- Modify: `src/services/tokenAnalyzer.ts`

**Step 1: Import new dependencies**

Add to imports at top of file:

```typescript
import { analyzeHolders, type LPVault } from "@/services/helius";
import { getTokenLiquidity, type TokenLiquidity } from "@/services/dexscreener";
```

**Step 2: Update WEIGHTS constant (line 79)**

Replace the existing `WEIGHTS` with:

```typescript
/** Trust rating weight factors (must sum to 1.0). */
const WEIGHTS = {
  deployerScore: 0.15,
  holderQuality: 0.25,
  distribution: 0.20,
  age: 0.10,
  patterns: 0.20,
  liquidity: 0.10,
} as const;
```

**Step 3: Update computeAgeComponent to accept deployer features**

Replace the `computeAgeComponent` function (lines 254-258) with:

```typescript
/**
 * Compute a wallet age signal (0-100) using real FairScale features.
 * Falls back to neutral 50 if features are unavailable.
 */
function computeAgeComponent(
  walletAgeDays: number | null,
  activeDays: number | null
): number {
  if (walletAgeDays === null) return 50;

  let score: number;
  if (walletAgeDays > 365) score = 90;
  else if (walletAgeDays > 180) score = 70 + ((walletAgeDays - 180) / 185) * 20;
  else if (walletAgeDays > 30) score = 30 + ((walletAgeDays - 30) / 150) * 40;
  else score = (walletAgeDays / 30) * 30;

  // Bonus for active usage
  if (activeDays !== null && activeDays > 100) {
    score = Math.min(100, score + 10);
  }

  return Math.round(score);
}
```

**Step 4: Add computeLiquidityComponent**

Add after `computePatternComponent`:

```typescript
/**
 * Compute liquidity score (0-100) based on DexScreener data and LP vault positions.
 * Tokens with more liquidity and healthy volume/liquidity ratios score higher.
 */
function computeLiquidityComponent(
  dexData: TokenLiquidity | null,
  lpSupplyPercent: number
): number {
  if (!dexData) {
    // No DexScreener data — use LP supply percent as a basic signal
    if (lpSupplyPercent > 20) return 60;
    if (lpSupplyPercent > 5) return 40;
    return 20;
  }

  const liq = dexData.totalLiquidityUsd;
  let score: number;

  if (liq > 100_000) score = 100;
  else if (liq > 10_000) score = 60 + ((liq - 10_000) / 90_000) * 40;
  else if (liq > 1_000) score = 20 + ((liq - 1_000) / 9_000) * 40;
  else score = (liq / 1_000) * 20;

  // Bonus for healthy volume/liquidity ratio
  if (dexData.volumeLiquidityRatio > 0.5) {
    score = Math.min(100, score + 10);
  }

  return Math.round(score);
}
```

**Step 5: Update analyzeToken to use new components**

In the `analyzeToken` function, after fetching holders (around line 345), add LP analysis and DexScreener fetch:

```typescript
  // 3b. Analyze holders for LP vaults
  const holderAnalysis = analyzeHolders(holders);

  // 3c. Fetch DexScreener liquidity data (in parallel with deployer score)
```

Move the deployer score fetch into a Promise.all with DexScreener:

```typescript
  // 4. Fetch deployer score + DexScreener liquidity in parallel
  const [deployerResult, dexData] = await Promise.all([
    (async () => {
      if (!deployerWallet) return { score: null, tier: null, features: null };
      const fullScore = await getFullScore(deployerWallet);
      if (!fullScore) return { score: null, tier: null, features: null };
      return {
        score: fullScore.integerScore,
        tier: fullScore.tier,
        features: fullScore.features ?? null,
      };
    })(),
    getTokenLiquidity(mint),
  ]);

  let deployerScore = deployerResult.score;
  let deployerTier = deployerResult.tier;
  const deployerFeatures = deployerResult.features;
```

Update the trust rating calculation (around line 383) to include new components:

```typescript
  const ageComponent = computeAgeComponent(
    deployerFeatures?.wallet_age_days ?? null,
    deployerFeatures?.active_days ?? null
  );
  const patternComponent = computePatternComponent(riskFlags);
  const liquidityComponent = computeLiquidityComponent(
    dexData,
    holderAnalysis.lpSupplyPercent
  );

  const trustRating = Math.round(
    deployerComponent * WEIGHTS.deployerScore +
      holderQualityComponent * WEIGHTS.holderQuality +
      distributionComponent * WEIGHTS.distribution +
      ageComponent * WEIGHTS.age +
      patternComponent * WEIGHTS.patterns +
      liquidityComponent * WEIGHTS.liquidity
  );
```

Also add `liquidity` and `lpSupplyPercent` to the `TrustAnalysis` interface and return value.

**Step 6: Update TrustAnalysis interface**

Add to the `TrustAnalysis` interface (around line 39):

```typescript
  /** DexScreener liquidity data, if available. */
  liquidity: TokenLiquidity | null;
  /** Percentage of supply in LP vaults. */
  lpSupplyPercent: number;
  /** Identified LP vault positions. */
  lpVaults: LPVault[];
```

And include them in the return object.

**Step 7: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 8: Commit**

```bash
git add src/services/tokenAnalyzer.ts
git commit -m "feat: add liquidity + real age components to trust rating"
```

---

### Task 7: Create the WalletAnalyticsChart component

**Files:**
- Create: `src/components/features/WalletAnalyticsChart.tsx`

**Step 1: Create the radar chart component**

```tsx
"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type { WalletFeatures } from "@/types/database";

interface WalletAnalyticsChartProps {
  features: WalletFeatures | null | undefined;
}

function formatDays(days: number): string {
  if (days >= 365) return `${(days / 365).toFixed(1)}y`;
  if (days >= 30) return `${Math.round(days / 30)}mo`;
  return `${days}d`;
}

export default function WalletAnalyticsChart({
  features,
}: WalletAnalyticsChartProps) {
  if (!features) return null;

  const radarData = [
    {
      metric: "SOL Balance",
      value: Math.round((features.native_sol_percentile ?? 0) * 100),
    },
    {
      metric: "Major Tokens",
      value: Math.round((features.major_percentile_score ?? 0) * 100),
    },
    {
      metric: "Stablecoins",
      value: Math.round((features.stable_percentile_score ?? 0) * 100),
    },
    {
      metric: "Liquid Staking",
      value: Math.round((features.lst_percentile_score ?? 0) * 100),
    },
    {
      metric: "Activity",
      value: Math.min(
        100,
        Math.round(
          ((features.active_days ?? 0) /
            Math.max(1, features.wallet_age_days ?? 1)) *
            100
        )
      ),
    },
    {
      metric: "Tx Volume",
      value: Math.min(100, Math.round(((features.tx_count ?? 0) / 5000) * 100)),
    },
  ];

  const stats = [
    {
      label: "Wallet Age",
      value: features.wallet_age_days
        ? formatDays(features.wallet_age_days)
        : "N/A",
    },
    {
      label: "Transactions",
      value: features.tx_count?.toLocaleString() ?? "N/A",
    },
    {
      label: "Active Days",
      value: features.active_days?.toLocaleString() ?? "N/A",
    },
    {
      label: "Median Gap",
      value: features.median_gap_hours
        ? `${features.median_gap_hours.toFixed(0)}h`
        : "N/A",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Wallet Analytics</CardTitle>
        <CardDescription>
          On-chain footprint from FairScale feature analysis.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <Radar
              name="Wallet"
              dataKey="value"
              stroke="#7c3aed"
              fill="#7c3aed"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <span className="text-sm font-semibold text-foreground">
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/features/WalletAnalyticsChart.tsx
git commit -m "feat: add WalletAnalyticsChart radar component"
```

---

### Task 8: Create the LiquidityCard component

**Files:**
- Create: `src/components/features/LiquidityCard.tsx`
- Create: `src/hooks/useLiquidity.ts`

**Step 1: Create the hook**

```typescript
"use client";

import { useState, useEffect } from "react";
import type { TokenLiquidity } from "@/services/dexscreener";
import type { LPVault } from "@/services/helius";

interface LiquidityData {
  lpVaults: LPVault[];
  lpSupplyPercent: number;
  dexScreener: TokenLiquidity | null;
}

export function useLiquidity(mint: string | null) {
  const [data, setData] = useState<LiquidityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mint) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/token/${encodeURIComponent(mint)}/liquidity`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((json) => setData(json as LiquidityData))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [mint]);

  return { data, loading };
}
```

**Step 2: Create the LiquidityCard component**

```tsx
"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLiquidity } from "@/hooks/useLiquidity";

interface LiquidityCardProps {
  mint: string | null;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export default function LiquidityCard({ mint }: LiquidityCardProps) {
  const { data, loading } = useLiquidity(mint);

  if (!mint) return null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Liquidity</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[120px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const dex = data.dexScreener;
  const hasLPData = data.lpVaults.length > 0;
  const hasDexData = dex !== null;

  if (!hasLPData && !hasDexData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Liquidity</CardTitle>
          <CardDescription>
            No liquidity pool data found for this token.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Determine health indicator
  const ratio = dex?.volumeLiquidityRatio ?? 0;
  const healthColor =
    ratio > 0.5
      ? "text-emerald-600 bg-emerald-50 border-emerald-300"
      : ratio > 0.1
        ? "text-yellow-600 bg-yellow-50 border-yellow-300"
        : "text-red-600 bg-red-50 border-red-300";
  const healthLabel =
    ratio > 0.5 ? "Healthy" : ratio > 0.1 ? "Moderate" : "Low";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Liquidity</CardTitle>
            <CardDescription>
              On-chain liquidity from DEX pools.
            </CardDescription>
          </div>
          <Badge className={cn("border", healthColor)}>
            {healthLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {hasDexData && (
            <>
              <Metric
                label="Total Liquidity"
                value={formatUsd(dex.totalLiquidityUsd)}
              />
              <Metric label="24h Volume" value={formatUsd(dex.volume24h)} />
              <Metric
                label="Vol/Liq Ratio"
                value={dex.volumeLiquidityRatio.toFixed(2)}
              />
              <Metric label="Pools" value={dex.poolCount.toString()} />
              {dex.primaryDex && (
                <Metric
                  label="Primary DEX"
                  value={dex.primaryDex.charAt(0).toUpperCase() + dex.primaryDex.slice(1)}
                />
              )}
              {dex.fdv > 0 && <Metric label="FDV" value={formatUsd(dex.fdv)} />}
            </>
          )}
          {hasLPData && (
            <>
              <Metric
                label="Supply in LPs"
                value={`${data.lpSupplyPercent.toFixed(1)}%`}
              />
              <Metric
                label="LP Pools (on-chain)"
                value={data.lpVaults.length.toString()}
              />
            </>
          )}
        </div>

        {/* LP Vault breakdown */}
        {hasLPData && (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.lpVaults.map((vault) => (
              <Badge
                key={vault.owner}
                variant="outline"
                className="text-xs"
              >
                {vault.dex}: {vault.percentage.toFixed(1)}%
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/hooks/useLiquidity.ts src/components/features/LiquidityCard.tsx
git commit -m "feat: add LiquidityCard component with LP vault + DexScreener data"
```

---

### Task 9: Add WalletAnalyticsChart to deployer page

**Files:**
- Modify: `src/app/deployer/[wallet]/page.tsx`
- Modify: `src/hooks/useDeployerProfile.ts` (may need to pass features through)

**Step 1: Ensure features are available in deployer profile data**

Check `src/hooks/useDeployerProfile.ts` — the hook calls `/api/deployer/[wallet]` which fetches the FairScale full score. The features need to be passed through from `getFullScore()` to the deployer API response and into the hook's data type.

In `src/app/api/deployer/[wallet]/route.ts`, ensure the response includes `features`:

```typescript
features: fairScore?.features ?? null,
```

In `src/hooks/useDeployerProfile.ts`, add to the profile type:

```typescript
fairScore: FairScoreData | null;  // Already has features via the type
```

**Step 2: Add WalletAnalyticsChart to the page**

Import:
```typescript
import WalletAnalyticsChart from "@/components/features/WalletAnalyticsChart";
```

Add after the Score Breakdown section, before the Score History chart:

```tsx
          {/* Wallet Analytics Radar */}
          <WalletAnalyticsChart features={data.fairScore?.features} />
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/deployer/\[wallet\]/page.tsx src/hooks/useDeployerProfile.ts src/app/api/deployer/\[wallet\]/route.ts
git commit -m "feat: add wallet analytics radar chart to deployer page"
```

---

### Task 10: Add WalletAnalyticsChart to reputation page

**Files:**
- Modify: `src/app/reputation/[wallet]/page.tsx`

**Step 1: Check data availability**

The reputation page fetches from `/api/reputation/[wallet]` which should also return FairScale features. Verify the API route includes features in its response.

**Step 2: Import and add the chart**

Import:
```typescript
import WalletAnalyticsChart from "@/components/features/WalletAnalyticsChart";
```

Add after the AI Analysis section, before the Score History chart:

```tsx
          {/* Wallet Analytics Radar */}
          <WalletAnalyticsChart features={data.fairScore?.features} />
```

**Step 3: Verify build and commit**

```bash
git add src/app/reputation/\[wallet\]/page.tsx
git commit -m "feat: add wallet analytics radar chart to reputation page"
```

---

### Task 11: Add LiquidityCard to token page

**Files:**
- Modify: `src/app/token/[mint]/page.tsx`

**Step 1: Import and add the card**

Import:
```typescript
import LiquidityCard from "@/components/features/LiquidityCard";
```

Add after the Trust Rating section, before/after the Score History chart:

```tsx
          {/* Liquidity */}
          <LiquidityCard mint={data.mint} />
```

**Step 2: Verify build and commit**

```bash
git add src/app/token/\[mint\]/page.tsx
git commit -m "feat: add liquidity card to token page"
```

---

### Task 12: Full build, push, and deploy

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Full build**

Run: `npx next build`
Expected: Build succeeds

**Step 3: Commit any remaining changes**

```bash
git add -A
git commit -m "feat: liquidity intelligence - complete feature"
```

**Step 4: Push and deploy**

```bash
git push origin main
vercel --prod --yes
```
