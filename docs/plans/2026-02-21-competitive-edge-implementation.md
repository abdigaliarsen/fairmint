# Competitive Edge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close competitive gaps with a discovery feed, deeper security analysis, and smart money leaderboard.

**Architecture:** Three phases using existing data sources (Helius, FairScale, DexScreener, RugCheck, Supabase). No new external API dependencies. All new pages are client-side with API routes proxying server-side data.

**Tech Stack:** Next.js 14+ App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase, Helius SDK, Recharts

---

## Phase 1: Discovery & Trending Feed

### Task 1: Add token_age_days column to token_analyses

**Files:**
- Modify: `src/services/tokenAnalyzer.ts:505-520` (add `token_age_days` to insert)
- Modify: `src/types/database.ts` (add `token_age_days` to `TokenAnalysis` and `TokenAnalysisInsert`)

**Step 1: Add Supabase migration**

Run via Supabase MCP `apply_migration`:
```sql
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS token_age_days integer;
```

**Step 2: Update TypeScript types**

In `src/types/database.ts`, add `token_age_days: number | null;` to `TokenAnalysis` interface (after `top_holder_concentration`).

**Step 3: Persist token_age_days in tokenAnalyzer.ts**

In the `analysisRow` object in `analyzeToken()`, add:
```typescript
token_age_days: tokenAgeDays,
```

**Step 4: Commit**

```bash
git add src/types/database.ts src/services/tokenAnalyzer.ts
git commit -m "feat: persist token_age_days in token_analyses table"
```

---

### Task 2: Create /api/discover route

**Files:**
- Create: `src/app/api/discover/route.ts`

**Step 1: Implement the API route**

```typescript
/**
 * GET /api/discover?tab=trending|new|trusted&limit=20
 *
 * Discovery feed with three modes:
 * - trending: most frequently analyzed tokens in last 24h
 * - new: recently created tokens (< 48h old)
 * - trusted: highest trust-rated tokens analyzed in last 7 days
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  tab: z.enum(["trending", "new", "trusted"]).default("trending"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = schema.safeParse({
      tab: searchParams.get("tab") ?? "trending",
      limit: searchParams.get("limit") ?? 20,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { tab, limit } = parsed.data;
    const supabase = createServerSupabaseClient();

    if (tab === "trending") {
      // Most recently and frequently analyzed tokens
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("token_analyses")
        .select("mint, name, symbol, image_url, trust_rating, deployer_tier, holder_count, token_age_days, risk_flags, analyzed_at")
        .gte("analyzed_at", since)
        .order("analyzed_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return NextResponse.json({ tab, tokens: data ?? [] });
    }

    if (tab === "new") {
      // Recently created tokens (< 48h old)
      const { data, error } = await supabase
        .from("token_analyses")
        .select("mint, name, symbol, image_url, trust_rating, deployer_tier, holder_count, token_age_days, risk_flags, analyzed_at")
        .not("token_age_days", "is", null)
        .lte("token_age_days", 2)
        .order("trust_rating", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return NextResponse.json({ tab, tokens: data ?? [] });
    }

    // trusted — highest rated tokens analyzed in last 7 days
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("token_analyses")
      .select("mint, name, symbol, image_url, trust_rating, deployer_tier, holder_count, token_age_days, risk_flags, analyzed_at")
      .gte("analyzed_at", since7d)
      .order("trust_rating", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return NextResponse.json({ tab, tokens: data ?? [] });
  } catch (error) {
    console.error("GET /api/discover error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/discover/route.ts
git commit -m "feat: add /api/discover endpoint for trending/new/trusted tokens"
```

---

### Task 3: Create useDiscover hook

**Files:**
- Create: `src/hooks/useDiscover.ts`

**Step 1: Implement the hook**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import type { FairScoreTier, RiskFlag } from "@/types/database";

export interface DiscoverToken {
  mint: string;
  name: string | null;
  symbol: string | null;
  image_url: string | null;
  trust_rating: number;
  deployer_tier: FairScoreTier | null;
  holder_count: number;
  token_age_days: number | null;
  risk_flags: RiskFlag[];
  analyzed_at: string;
}

export type DiscoverTab = "trending" | "new" | "trusted";

export function useDiscover(tab: DiscoverTab, limit: number = 20) {
  const [tokens, setTokens] = useState<DiscoverToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/discover?tab=${tab}&limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setTokens(data.tokens ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setTokens([]);
    } finally {
      setLoading(false);
    }
  }, [tab, limit]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  return { tokens, loading, error, refetch: fetchTokens };
}
```

**Step 2: Commit**

```bash
git add src/hooks/useDiscover.ts
git commit -m "feat: add useDiscover hook for discovery feed"
```

---

### Task 4: Create /discover page

**Files:**
- Create: `src/app/discover/page.tsx`

**Step 1: Build the discover page**

The page should have:
- Header: "Discover Tokens" with description
- Three tabs: Trending, New Launches, Top Trusted (using shadcn Tabs)
- Each tab renders a grid of token cards
- Each card shows: name, symbol, trust rating badge (colored), deployer tier badge, token age, holder count, risk flag count
- Cards link to `/token/[mint]`
- Loading skeletons while fetching
- Empty states per tab

Use existing components: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `Card`, `Badge`, `Skeleton`.

Reuse `TokenCard` component where possible, or create a slightly enhanced `DiscoverTokenCard` if TokenCard lacks the extra fields (volume, token age, risk count).

The page is a `"use client"` component using `useDiscover` hook. Default tab is "trending".

**Step 2: Commit**

```bash
git add src/app/discover/page.tsx
git commit -m "feat: add /discover page with trending, new launches, and top trusted tabs"
```

---

### Task 5: Add Discover link to navigation

**Files:**
- Modify: `src/components/layout/Header.tsx` (or wherever navigation links live)

**Step 1: Find the navigation component and add a "Discover" link**

Add a nav link pointing to `/discover` with a Compass or TrendingUp icon from Lucide. Place it between Search and Dashboard in the nav order.

**Step 2: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: add Discover link to navigation header"
```

---

### Task 6: Enhance cron job for new token discovery

**Files:**
- Modify: `src/app/api/cron/refresh-tokens/route.ts`

**Step 1: Add recent token discovery to the cron job**

After refreshing the existing POPULAR_MINTS list, add a second phase that:
1. Queries Supabase for the 10 most recently analyzed tokens (to keep them fresh)
2. Re-analyzes them (the cache TTL will prevent redundant external API calls)

This ensures the discover feed stays populated even without user traffic.

```typescript
// Phase 2: Re-analyze recent tokens to keep discover feed fresh
const { data: recentTokens } = await supabase
  .from("token_analyses")
  .select("mint")
  .order("analyzed_at", { ascending: false })
  .limit(10);

if (recentTokens) {
  for (const { mint } of recentTokens) {
    if (!POPULAR_MINTS.includes(mint)) {
      try {
        await analyzeToken(mint);
      } catch { /* skip failures */ }
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/cron/refresh-tokens/route.ts
git commit -m "feat: enhance cron to refresh recent tokens for discover feed"
```

---

## Phase 2: Deeper Security Analysis

### Task 7: Add 9 new risk checks to tokenAnalyzer

**Files:**
- Modify: `src/services/tokenAnalyzer.ts` (`detectRiskFlags` function)

**Step 1: Update detectRiskFlags signature**

Add new parameters for LP and liquidity data:

```typescript
function detectRiskFlags(
  deployerScore: number | null,
  deployerTier: FairScoreTier | null,
  holders: TokenHolder[],
  metadata: TokenMetadata,
  connectedHolderCount: number = 0,
  deployerWallet: string | null = null,
  lpVaults: LPVault[] = [],
  dexData: TokenLiquidity | null = null,
  rugCheckResult: RugCheckResult | null = null,
): RiskFlag[] {
```

**Step 2: Add the new checks**

After the existing connected wallets check (#7), add:

```typescript
// 8. Creator still holds supply
if (deployerWallet) {
  const deployerHolding = holders.find((h) => h.owner === deployerWallet);
  if (deployerHolding) {
    if (deployerHolding.percentage > 50) {
      flags.push(makeRiskFlag("high", "Creator Holds Majority", `The token deployer holds ${deployerHolding.percentage.toFixed(1)}% of the sampled supply.`));
    } else if (deployerHolding.percentage > 20) {
      flags.push(makeRiskFlag("medium", "Creator Holds Supply", `The token deployer holds ${deployerHolding.percentage.toFixed(1)}% of the sampled supply.`));
    }
  }
}

// 9. Top 5 concentration
if (holders.length >= 5) {
  const top5Pct = holders.slice(0, 5).reduce((sum, h) => sum + h.percentage, 0);
  if (top5Pct > 80) {
    flags.push(makeRiskFlag("high", "Top 5 Concentration", `The top 5 holders control ${top5Pct.toFixed(1)}% of the sampled supply.`));
  }
}

// 10. Top 10 concentration
if (holders.length >= 10) {
  const top10Pct = holders.slice(0, 10).reduce((sum, h) => sum + h.percentage, 0);
  if (top10Pct > 90) {
    flags.push(makeRiskFlag("medium", "Top 10 Concentration", `The top 10 holders control ${top10Pct.toFixed(1)}% of the sampled supply.`));
  }
}

// 11. No DEX liquidity
if (lpVaults.length === 0 && !dexData) {
  flags.push(makeRiskFlag("high", "No DEX Liquidity", "No liquidity pools or DEX trading pairs detected for this token."));
}

// 12. Low liquidity
if (dexData && dexData.totalLiquidityUsd < 1000) {
  flags.push(makeRiskFlag("medium", "Low Liquidity", `Total DEX liquidity is only $${dexData.totalLiquidityUsd.toFixed(0)}.`));
}

// 13. Single DEX
if (lpVaults.length === 1 && dexData) {
  flags.push(makeRiskFlag("low", "Single DEX", `Liquidity exists on only one DEX (${lpVaults[0].dex}), creating a single point of failure.`));
}

// 14. Metadata mutable (update authority active)
if (metadata.updateAuthority) {
  // updateAuthority being non-null means it exists; for most SPL tokens,
  // the update authority is set during creation and may or may not be revoked
  flags.push(makeRiskFlag("low", "Mutable Metadata", "The token's metadata can be changed by the update authority."));
}

// 15. RugCheck danger
if (rugCheckResult) {
  if (rugCheckResult.riskLevel === "Danger") {
    flags.push(makeRiskFlag("high", "RugCheck: Danger", `RugCheck flagged this token as dangerous with ${rugCheckResult.riskCount} risk(s) detected.`));
  } else if (rugCheckResult.riskCount >= 3) {
    flags.push(makeRiskFlag("medium", "RugCheck: Multiple Warnings", `RugCheck detected ${rugCheckResult.riskCount} risks for this token.`));
  }
}
```

**Step 3: Update the detectRiskFlags call site in analyzeToken()**

Pass the new parameters:

```typescript
const riskFlags = detectRiskFlags(
  deployerScore,
  deployerTier,
  holders,
  metadata,
  connectedHolderCount,
  deployerWallet,
  holderAnalysis.lpVaults,
  dexData,
  rugCheckResult,
);
```

**Step 4: Commit**

```bash
git add src/services/tokenAnalyzer.ts
git commit -m "feat: expand risk detection from 7 to 15 checks"
```

---

### Task 8: Update the cached analysis return to include risk flags from new checks

**Files:**
- Modify: `src/services/tokenAnalyzer.ts` (cached return block around line 394-419)

**Step 1: Ensure cached results include persisted risk flags**

The cached return already reads `risk_flags` from the database, so no code change is needed for this — the new risk flags are persisted via the existing `risk_flags` column in the insert. Just verify the cached return path passes through `risk_flags` correctly (it does).

**Step 2: Commit** (skip if no changes needed)

---

## Phase 3: Smart Money / Top Wallets

### Task 9: Create /api/wallets route

**Files:**
- Create: `src/app/api/wallets/route.ts`

**Step 1: Implement the leaderboard API**

```typescript
/**
 * GET /api/wallets?tier=gold,platinum&limit=20&sort=score
 *
 * Returns top-rated wallets from the cached_scores table.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  tier: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = schema.safeParse({
      limit: searchParams.get("limit") ?? 20,
      tier: searchParams.get("tier") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { limit, tier } = parsed.data;
    const supabase = createServerSupabaseClient();

    let query = supabase
      .from("cached_scores")
      .select("wallet, score_decimal, score_integer, tier, badges, raw_response, fetched_at")
      .order("score_integer", { ascending: false })
      .limit(limit);

    if (tier) {
      const tiers = tier.split(",").map((t) => t.trim());
      query = query.in("tier", tiers);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Extract features from raw_response for display
    const wallets = (data ?? []).map((row) => {
      const raw = row.raw_response as Record<string, unknown> | null;
      const features = (raw?.features ?? null) as Record<string, number> | null;
      return {
        wallet: row.wallet,
        score: row.score_integer,
        tier: row.tier,
        badges: row.badges,
        walletAgeDays: features?.wallet_age_days ?? null,
        txCount: features?.tx_count ?? null,
        activeDays: features?.active_days ?? null,
        fetchedAt: row.fetched_at,
      };
    });

    return NextResponse.json({ wallets });
  } catch (error) {
    console.error("GET /api/wallets error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/wallets/route.ts
git commit -m "feat: add /api/wallets leaderboard endpoint"
```

---

### Task 10: Create useWalletLeaderboard hook

**Files:**
- Create: `src/hooks/useWalletLeaderboard.ts`

**Step 1: Implement the hook**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import type { FairScoreTier, Badge } from "@/types/database";

export interface LeaderboardWallet {
  wallet: string;
  score: number;
  tier: FairScoreTier;
  badges: Badge[];
  walletAgeDays: number | null;
  txCount: number | null;
  activeDays: number | null;
  fetchedAt: string;
}

export function useWalletLeaderboard(tier?: string, limit: number = 20) {
  const [wallets, setWallets] = useState<LeaderboardWallet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWallets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (tier) params.set("tier", tier);
      const res = await fetch(`/api/wallets?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setWallets(data.wallets ?? []);
    } catch {
      setWallets([]);
    } finally {
      setLoading(false);
    }
  }, [tier, limit]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  return { wallets, loading, refetch: fetchWallets };
}
```

**Step 2: Commit**

```bash
git add src/hooks/useWalletLeaderboard.ts
git commit -m "feat: add useWalletLeaderboard hook"
```

---

### Task 11: Create /wallets page

**Files:**
- Create: `src/app/wallets/page.tsx`

**Step 1: Build the wallets leaderboard page**

The page should have:
- Header: "Trusted Wallets" with description explaining FairScale reputation ranking
- Filter buttons: All, Gold, Platinum
- Leaderboard table/list with columns:
  - Rank (#)
  - Wallet address (truncated, with copy button)
  - FairScale tier badge (colored)
  - Score (integer)
  - Wallet age
  - Transactions
  - Active days
  - Link to `/reputation/[wallet]`
- Loading skeletons while fetching
- Empty state if no wallets found

Use existing components: `Card`, `Badge`, `Button`, `Skeleton`, `FairScoreDisplay` (small variant).

The page is a `"use client"` component using `useWalletLeaderboard` hook.

**Step 2: Commit**

```bash
git add src/app/wallets/page.tsx
git commit -m "feat: add /wallets trusted wallet leaderboard page"
```

---

### Task 12: Add notable holders to token page

**Files:**
- Modify: `src/app/token/[mint]/page.tsx`
- Modify: `src/hooks/useHolders.ts` (if holder data doesn't include tier info)

**Step 1: Enhance the Holder Quality section**

In the token page, after the HolderQualityBar, add a "Notable Holders" section that highlights any Gold/Platinum holders:

```tsx
{/* Notable Holders */}
{holders.some((h) => h.tier === "gold" || h.tier === "platinum") && (
  <div className="mt-3 flex flex-col gap-1.5">
    <span className="text-xs font-medium text-foreground">Notable Holders</span>
    {holders
      .filter((h) => h.tier === "gold" || h.tier === "platinum")
      .map((h) => (
        <div key={h.owner} className="flex items-center gap-2">
          <Badge className={tierBadgeClasses(h.tier)}>{h.tier}</Badge>
          <span className="font-mono text-xs text-muted-foreground">
            {truncateAddress(h.owner)}
          </span>
          <span className="text-xs text-muted-foreground">
            {h.percentage.toFixed(1)}%
          </span>
        </div>
      ))}
  </div>
)}
```

This requires the holders hook to return tier data. Check if `useHolders` already enriches with FairScale tier. If not, add a quick score lookup in the API route `/api/token/[mint]/holders`.

**Step 2: Commit**

```bash
git add src/app/token/[mint]/page.tsx src/hooks/useHolders.ts
git commit -m "feat: show notable Gold/Platinum holders on token page"
```

---

### Task 13: Add Wallets link to navigation

**Files:**
- Modify: `src/components/layout/Header.tsx`

**Step 1: Add a "Wallets" nav link**

Add a link to `/wallets` with a Users or Crown icon from Lucide. Place after Discover.

**Step 2: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: add Wallets link to navigation header"
```

---

## Final Steps

### Task 14: Build, test, push, deploy

**Step 1: Run build**

```bash
npx next build
```

Fix any TypeScript errors.

**Step 2: Manual smoke test**

- Visit `/discover` — verify all 3 tabs load
- Visit `/wallets` — verify leaderboard renders
- Visit `/token/[mint]` — verify new risk flags appear
- Check mobile responsiveness

**Step 3: Push and deploy**

```bash
git push
vercel --prod
```
