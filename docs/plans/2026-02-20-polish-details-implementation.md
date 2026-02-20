# Polish & High-Impact Details Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 12 small details that create outsized impact on trust, credibility, and user delight — including score animations, transparency explainers, authority badges, Jupiter verification, RugCheck integration, token age detection, deployer timelines, smart money indicators, OG images, and data source attribution.

**Architecture:** All items are additive — no existing behavior changes. New external services (Jupiter, RugCheck) follow the DexScreener pattern: fetch → cache → silent fallback. UI changes are component-level. Token page gets the most changes (authority badges, Jupiter badge, token age, RugCheck, progress, explainer). Deployer page gets a timeline. HolderGraph gets smart money icons.

**Tech Stack:** Next.js App Router, Supabase, Helius DAS API, Jupiter Token API, RugCheck API, React hooks, Lucide icons, CSS transitions.

---

### Task 1: Create `rugcheck_cache` Supabase table

**Step 1:** Use the Supabase MCP `apply_migration` tool:

```sql
CREATE TABLE IF NOT EXISTS rugcheck_cache (
  mint text PRIMARY KEY,
  data jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rugcheck_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON rugcheck_cache FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON rugcheck_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON rugcheck_cache FOR UPDATE USING (true);
```

**Step 2:** Verify with `execute_sql`:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'rugcheck_cache';
```

---

### Task 2: Create Jupiter and RugCheck services

**Files:**
- Create: `src/services/jupiter.ts`
- Create: `src/services/rugcheck.ts`

**Step 1:** Create `src/services/jupiter.ts`:

```typescript
/**
 * Jupiter service — checks if a token is in Jupiter's verified token list.
 * Free API, no key required. Results cached in-memory for 1 hour.
 */

let cachedTokens: Set<string> | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function isJupiterVerified(mint: string): Promise<boolean> {
  try {
    const now = Date.now();
    if (cachedTokens && now - cachedAt < CACHE_TTL_MS) {
      return cachedTokens.has(mint);
    }

    const res = await fetch("https://lite-api.jup.ag/tokens/v1", {
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return false;

    const tokens = (await res.json()) as Array<{ address: string }>;
    cachedTokens = new Set(tokens.map((t) => t.address));
    cachedAt = now;

    return cachedTokens.has(mint);
  } catch {
    return false;
  }
}
```

**Step 2:** Create `src/services/rugcheck.ts`:

```typescript
/**
 * RugCheck service — fetches token risk assessment from RugCheck.xyz.
 * Free API, no key required. Cached in Supabase with 1-hour TTL.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface RugCheckResult {
  riskLevel: "Good" | "Warning" | "Danger" | "Unknown";
  riskCount: number;
  score: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;

export async function getRugCheckReport(mint: string): Promise<RugCheckResult | null> {
  try {
    const supabase = createServerSupabaseClient();

    // Check cache
    const { data: cached } = await supabase
      .from("rugcheck_cache")
      .select("data, fetched_at")
      .eq("mint", mint)
      .maybeSingle();

    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < CACHE_TTL_MS) {
        return cached.data as RugCheckResult;
      }
    }

    // Fetch fresh data
    const res = await fetch(
      `https://api.rugcheck.xyz/v1/tokens/${encodeURIComponent(mint)}/report/summary`,
      { signal: AbortSignal.timeout(10_000) }
    );

    if (!res.ok) return null;

    const raw = await res.json();
    const result: RugCheckResult = {
      riskLevel: classifyRugCheckRisk(raw.score ?? 0),
      riskCount: raw.risks?.length ?? 0,
      score: raw.score ?? 0,
    };

    // Upsert cache
    await supabase
      .from("rugcheck_cache")
      .upsert(
        { mint, data: result as unknown as Record<string, unknown>, fetched_at: new Date().toISOString() },
        { onConflict: "mint" }
      );

    return result;
  } catch {
    return null;
  }
}

function classifyRugCheckRisk(score: number): RugCheckResult["riskLevel"] {
  if (score >= 700) return "Good";
  if (score >= 400) return "Warning";
  if (score > 0) return "Danger";
  return "Unknown";
}
```

**Step 3:** Run `npx tsc --noEmit` — expect no errors.

**Step 4:** Commit:
```bash
git add src/services/jupiter.ts src/services/rugcheck.ts
git commit -m "feat: add Jupiter verified and RugCheck services"
```

---

### Task 3: Add token authority, Jupiter, RugCheck, and token age to the token API

**Files:**
- Modify: `src/app/api/token/[mint]/route.ts`
- Modify: `src/services/tokenAnalyzer.ts` (add fields to TrustAnalysis)

**Step 1:** Add new fields to `TrustAnalysis` interface in `src/services/tokenAnalyzer.ts`:

After the `lpVaults` field, add:

```typescript
  /** Whether the token is in Jupiter's verified list. */
  jupiterVerified: boolean;
  /** RugCheck risk assessment, if available. */
  rugCheck: RugCheckResult | null;
  /** Token creation timestamp (ISO), if detected. */
  tokenCreatedAt: string | null;
  /** Token age in days. */
  tokenAgeDays: number | null;
  /** Whether mint authority is still active. */
  mintAuthorityActive: boolean;
  /** Whether freeze authority is still active. */
  freezeAuthorityActive: boolean;
```

**Step 2:** Import the new services at the top of `tokenAnalyzer.ts`:

```typescript
import { isJupiterVerified } from "@/services/jupiter";
import { getRugCheckReport, type RugCheckResult } from "@/services/rugcheck";
```

**Step 3:** In the `analyzeToken()` function, where it currently runs `Promise.all` for deployer + DexScreener, add Jupiter + RugCheck in parallel:

Find the existing `Promise.all` call and add:
```typescript
const [deployerScore, dexScreenerData, jupiterVerified, rugCheckResult] = await Promise.all([
  deployerWallet ? getQuickScore(deployerWallet) : Promise.resolve(null),
  getTokenLiquidity(mint),
  isJupiterVerified(mint),
  getRugCheckReport(mint),
]);
```

**Step 4:** Before the return statement, compute token age from metadata:

```typescript
const tokenCreatedAt = metadata.raw?.created_at ?? null;
const tokenAgeDays = tokenCreatedAt
  ? Math.floor((Date.now() - new Date(tokenCreatedAt).getTime()) / (1000 * 60 * 60 * 24))
  : null;
```

**Step 5:** Add the new fields to the returned `TrustAnalysis` object:

```typescript
jupiterVerified,
rugCheck: rugCheckResult,
tokenCreatedAt: tokenCreatedAt ? new Date(tokenCreatedAt).toISOString() : null,
tokenAgeDays,
mintAuthorityActive: !!metadata.mintAuthority,
freezeAuthorityActive: !!metadata.freezeAuthority,
```

**Step 6:** Run `npx tsc --noEmit` — expect no errors.

**Step 7:** Commit:
```bash
git add src/services/tokenAnalyzer.ts
git commit -m "feat: add Jupiter, RugCheck, token age, authority status to token analysis"
```

---

### Task 4: Create `ScoringMethodology` explainer component

**Files:**
- Create: `src/components/features/ScoringMethodology.tsx`

**Step 1:** Create the component:

```typescript
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const FACTORS = [
  { label: "Deployer Reputation", weight: 15, description: "FairScale score of the token deployer" },
  { label: "Holder Quality", weight: 25, description: "Average FairScale reputation of top holders" },
  { label: "Distribution", weight: 20, description: "How evenly the token supply is spread" },
  { label: "Wallet Age", weight: 10, description: "Age and activity of the deployer wallet" },
  { label: "Safety Signals", weight: 20, description: "Risk flags like authority status and holder patterns" },
  { label: "Liquidity", weight: 10, description: "DEX liquidity depth and LP vault health" },
];

export default function ScoringMethodology() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        How is this calculated?
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1.5 rounded-md border bg-muted/30 p-3">
          {FACTORS.map((f) => (
            <div key={f.label} className="flex items-center gap-2">
              <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${f.weight * 2}px` }} />
              <span className="text-xs font-medium text-foreground">{f.weight}%</span>
              <span className="text-xs text-muted-foreground">{f.label}</span>
              <span className="hidden text-[10px] text-muted-foreground/60 sm:inline">
                — {f.description}
              </span>
            </div>
          ))}
          <p className="mt-1 text-[10px] text-muted-foreground/60">
            Powered by FairScale + Helius on-chain data
          </p>
        </div>
      )}
    </div>
  );
}
```

**Step 2:** Run `npx tsc --noEmit`.

**Step 3:** Commit:
```bash
git add src/components/features/ScoringMethodology.tsx
git commit -m "feat: add scoring methodology explainer component"
```

---

### Task 5: Create `AuthorityBadges` component

**Files:**
- Create: `src/components/features/AuthorityBadges.tsx`

**Step 1:** Create the component:

```typescript
"use client";

import { ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthorityBadgesProps {
  mintAuthorityActive: boolean;
  freezeAuthorityActive: boolean;
}

function AuthorityBadge({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        active
          ? "border-red-300 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
          : "border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
      )}
    >
      {active ? (
        <ShieldAlert className="size-3" />
      ) : (
        <ShieldCheck className="size-3" />
      )}
      {label}: {active ? "Active" : "Renounced"}
    </div>
  );
}

export default function AuthorityBadges({
  mintAuthorityActive,
  freezeAuthorityActive,
}: AuthorityBadgesProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <AuthorityBadge label="Mint" active={mintAuthorityActive} />
      <AuthorityBadge label="Freeze" active={freezeAuthorityActive} />
    </div>
  );
}
```

**Step 2:** Run `npx tsc --noEmit`.

**Step 3:** Commit:
```bash
git add src/components/features/AuthorityBadges.tsx
git commit -m "feat: add token authority status badges component"
```

---

### Task 6: Create `DeployerTimeline` component

**Files:**
- Create: `src/components/features/DeployerTimeline.tsx`

**Step 1:** Create the component:

```typescript
"use client";

import { CalendarDays, Coins, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface DeployedTokenSummary {
  trust_rating: number;
  analyzed_at: string;
}

interface DeployerTimelineProps {
  tokens: DeployedTokenSummary[];
}

export default function DeployerTimeline({ tokens }: DeployerTimelineProps) {
  if (tokens.length === 0) return null;

  const sorted = [...tokens].sort(
    (a, b) => new Date(a.analyzed_at).getTime() - new Date(b.analyzed_at).getTime()
  );

  const firstDate = new Date(sorted[0].analyzed_at);
  const latestDate = new Date(sorted[sorted.length - 1].analyzed_at);
  const riskyCount = tokens.filter((t) => t.trust_rating < 20).length;

  const daysSinceFirst = Math.max(
    1,
    Math.floor((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const stats = [
    {
      icon: CalendarDays,
      label: "First deployment",
      value: `${daysSinceFirst}d ago`,
    },
    {
      icon: Coins,
      label: "Tokens deployed",
      value: tokens.length.toString(),
    },
    {
      icon: Clock,
      label: "Latest",
      value: latestDate.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    },
    ...(riskyCount > 0
      ? [{
          icon: AlertTriangle,
          label: "Low-trust tokens",
          value: riskyCount.toString(),
        }]
      : []),
  ];

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 py-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-1.5">
            <stat.icon className="size-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{stat.label}:</span>
            <span className="text-xs font-semibold text-foreground">{stat.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

**Step 2:** Run `npx tsc --noEmit`.

**Step 3:** Commit:
```bash
git add src/components/features/DeployerTimeline.tsx
git commit -m "feat: add deployer risk timeline component"
```

---

### Task 7: Add score animation to FairScoreDisplay

**Files:**
- Modify: `src/components/features/FairScoreDisplay.tsx`

**Step 1:** Add `useState`, `useEffect`, and `useRef` imports. Add animation logic:

Replace the component function to add count-up animation. The key changes:
1. Import `{ useState, useEffect, useRef }` from React
2. Add an `animate` prop (default true)
3. Use `requestAnimationFrame` to animate from 0 to target score over 600ms
4. Animate the SVG ring using the animated value

Replace the entire file content of `src/components/features/FairScoreDisplay.tsx`:

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import type { FairScoreTier } from "@/types/database";

interface FairScoreDisplayProps {
  score: number;
  tier: string;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
}

const sizeConfig = {
  sm: {
    container: "size-16",
    score: "text-lg font-bold",
    ring: "size-16",
    strokeWidth: 3,
    badgeSize: "text-[10px] px-1.5 py-0",
  },
  md: {
    container: "size-24",
    score: "text-2xl font-bold",
    ring: "size-24",
    strokeWidth: 4,
    badgeSize: "text-xs px-2 py-0.5",
  },
  lg: {
    container: "size-32",
    score: "text-3xl font-bold",
    ring: "size-32",
    strokeWidth: 5,
    badgeSize: "text-sm px-2.5 py-0.5",
  },
} as const;

function useAnimatedValue(target: number, duration: number, enabled: boolean): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || target === 0) {
      setValue(target);
      return;
    }

    startRef.current = null;
    let rafId: number;

    function step(timestamp: number) {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(target * eased);
      if (progress < 1) rafId = requestAnimationFrame(step);
    }

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration, enabled]);

  return value;
}

export default function FairScoreDisplay({
  score,
  tier,
  size = "md",
  animate = true,
}: FairScoreDisplayProps) {
  const tierKey = tier as FairScoreTier;
  const colors = getTierColor(tierKey);
  const config = sizeConfig[size];

  const animatedScore = useAnimatedValue(
    Math.min(Math.max(score, 0), 100),
    600,
    animate
  );

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset =
    circumference - (animatedScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn("relative", config.container)}>
        <svg
          className={cn("rotate-[-90deg]", config.ring)}
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            className="text-muted/30"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn("transition-colors duration-500", colors.text)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(config.score, "transition-colors duration-500", colors.text)}
            aria-label={`FairScore: ${score}`}
          >
            {Math.round(animatedScore)}
          </span>
        </div>
      </div>

      <Badge
        className={cn(
          "border capitalize",
          colors.bg,
          colors.text,
          colors.border,
          config.badgeSize
        )}
      >
        {tier}
      </Badge>
    </div>
  );
}
```

**Step 2:** Run `npx tsc --noEmit`.

**Step 3:** Commit:
```bash
git add src/components/features/FairScoreDisplay.tsx
git commit -m "feat: add count-up animation to FairScoreDisplay"
```

---

### Task 8: Add score animation to TrustRating

**Files:**
- Modify: `src/components/features/TrustRating.tsx`

**Step 1:** Add animation to TrustRating. Replace the full file:

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface TrustRatingProps {
  rating: number;
  animate?: boolean;
}

function getRatingColor(rating: number): {
  bar: string;
  text: string;
  label: string;
} {
  if (rating >= 60) {
    return { bar: "bg-emerald-500", text: "text-emerald-600", label: "Trusted" };
  }
  if (rating >= 30) {
    return { bar: "bg-yellow-500", text: "text-yellow-600", label: "Caution" };
  }
  return { bar: "bg-red-500", text: "text-red-600", label: "Risky" };
}

function useAnimatedValue(target: number, duration: number, enabled: boolean): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || target === 0) {
      setValue(target);
      return;
    }

    startRef.current = null;
    let rafId: number;

    function step(timestamp: number) {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) rafId = requestAnimationFrame(step);
    }

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration, enabled]);

  return value;
}

export default function TrustRating({ rating, animate = true }: TrustRatingProps) {
  const clamped = Math.min(Math.max(rating, 0), 100);
  const animatedValue = useAnimatedValue(clamped, 600, animate);
  const colors = getRatingColor(clamped);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Trust Rating
        </span>
        <div className="flex items-center gap-1.5">
          <span className={cn("text-sm font-semibold", colors.text)}>
            {Math.round(animatedValue)}
          </span>
          <span className={cn("text-xs", colors.text)}>{colors.label}</span>
        </div>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Trust rating: ${clamped} out of 100`}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-700", colors.bar)}
          style={{ width: `${animatedValue}%` }}
        />
      </div>
    </div>
  );
}
```

**Step 2:** Run `npx tsc --noEmit`.

**Step 3:** Commit:
```bash
git add src/components/features/TrustRating.tsx
git commit -m "feat: add count-up animation to TrustRating"
```

---

### Task 9: Add smart money indicators to HolderGraph

**Files:**
- Modify: `src/components/features/HolderGraph.tsx`

**Step 1:** In the HolderGraph component, after the node rendering (the `<circle>` elements), add a small star icon for Gold/Platinum holders. Find the section that renders each holder node circle and add a star indicator:

After each holder `<circle>` element, add a conditional star for high-tier holders:

```typescript
{/* Smart money indicator */}
{(node.tier === "gold" || node.tier === "platinum") && (
  <text
    x={node.cx + node.r * 0.6}
    y={node.cy - node.r * 0.6}
    fontSize="10"
    fill="#eab308"
    textAnchor="middle"
    dominantBaseline="central"
    style={{ pointerEvents: "none" }}
  >
    ★
  </text>
)}
```

**Step 2:** After the graph SVG, add a summary stat line below:

```typescript
{(() => {
  const smartCount = holders.filter(
    (h) => h.tier === "gold" || h.tier === "platinum"
  ).length;
  if (smartCount === 0) return null;
  return (
    <p className="mt-2 text-center text-xs text-muted-foreground">
      {smartCount} of {holders.length} top holders have high reputation
    </p>
  );
})()}
```

**Step 3:** Run `npx tsc --noEmit`.

**Step 4:** Commit:
```bash
git add src/components/features/HolderGraph.tsx
git commit -m "feat: add smart money star indicators to holder graph"
```

---

### Task 10: Create token OG image

**Files:**
- Create: `src/app/token/[mint]/opengraph-image.tsx`

**Step 1:** Create the OG image following the exact pattern from `src/app/reputation/[wallet]/opengraph-image.tsx`:

```typescript
import { ImageResponse } from "next/og";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "edge";
export const alt = "Token Trust Analysis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const RATING_COLORS: Record<string, string> = {
  trusted: "#10b981",
  caution: "#eab308",
  risky: "#ef4444",
};

export default async function Image({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = await params;
  const truncated = `${mint.slice(0, 6)}...${mint.slice(-4)}`;

  let name = "Unknown Token";
  let symbol = "";
  let trustRating = 0;
  let deployerTier = "unrated";

  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase
      .from("token_analyses")
      .select("name, symbol, trust_rating, deployer_tier")
      .eq("mint", mint)
      .maybeSingle();

    if (data) {
      name = data.name ?? "Unknown Token";
      symbol = data.symbol ?? "";
      trustRating = data.trust_rating ?? 0;
      deployerTier = data.deployer_tier ?? "unrated";
    }
  } catch {
    // Use defaults
  }

  const ratingLabel = trustRating >= 60 ? "trusted" : trustRating >= 30 ? "caution" : "risky";
  const ratingColor = RATING_COLORS[ratingLabel] ?? RATING_COLORS.risky;

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
        {/* Token name */}
        <div style={{ fontSize: 40, fontWeight: 700, color: "white", marginBottom: 4 }}>
          {name}
        </div>
        {symbol && (
          <div style={{ fontSize: 22, color: "#94a3b8", marginBottom: 24 }}>
            ${symbol}
          </div>
        )}

        {/* Trust Rating circle */}
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: "50%",
            border: `6px solid ${ratingColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 44, fontWeight: 700, color: "white" }}>
            {Math.round(trustRating)}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>/ 100</div>
        </div>

        {/* Rating label */}
        <div
          style={{
            padding: "6px 20px",
            borderRadius: 9999,
            background: ratingColor,
            color: "white",
            fontSize: 18,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 2,
            marginBottom: 12,
          }}
        >
          {ratingLabel}
        </div>

        {/* Mint address */}
        <div style={{ color: "#64748b", fontSize: 16 }}>{truncated}</div>

        {/* Deployer tier */}
        {deployerTier !== "unrated" && (
          <div style={{ color: "#94a3b8", fontSize: 14, marginTop: 8 }}>
            Deployer: {deployerTier.charAt(0).toUpperCase() + deployerTier.slice(1)} Tier
          </div>
        )}

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
          TokenTrust — Token Analysis
        </div>
      </div>
    ),
    { ...size }
  );
}
```

**Step 2:** Run `npx tsc --noEmit`.

**Step 3:** Commit:
```bash
git add src/app/token/\[mint\]/opengraph-image.tsx
git commit -m "feat: add dynamic OG image for token pages"
```

---

### Task 11: Integrate everything into the token page

**Files:**
- Modify: `src/app/token/[mint]/page.tsx`

This is the biggest integration task. Add:
1. Import new components: `AuthorityBadges`, `ScoringMethodology`
2. Add Jupiter Verified badge next to token name
3. Add authority badges below token header
4. Add token age badge
5. Add RugCheck "Second Opinion" badge
6. Add ScoringMethodology under Trust Rating card
7. Add data source attribution labels

**Step 1:** Add imports at top of file:

```typescript
import AuthorityBadges from "@/components/features/AuthorityBadges";
import ScoringMethodology from "@/components/features/ScoringMethodology";
import { BadgeCheck, Clock, ShieldCheck } from "lucide-react";
```

**Step 2:** In the Token Header section, after the symbol span and before the `CopyButton`, add the Jupiter Verified badge:

```typescript
{data.jupiterVerified && (
  <Badge className="ml-2 border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400">
    <BadgeCheck className="mr-0.5 size-3" />
    Jupiter Verified
  </Badge>
)}
```

**Step 3:** After the token header `<div>` (the one with name/symbol/address), add token age + authority badges:

```typescript
{/* Token Age */}
{data.tokenAgeDays !== null && data.tokenAgeDays !== undefined && (
  <div className="flex items-center gap-2">
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="size-3" />
      Token Age: {data.tokenAgeDays}d
    </div>
    {data.tokenAgeDays < 2 && (
      <Badge className="border-red-300 bg-red-50 text-red-600 text-[10px]">Very New</Badge>
    )}
    {data.tokenAgeDays >= 2 && data.tokenAgeDays < 7 && (
      <Badge className="border-yellow-300 bg-yellow-50 text-yellow-600 text-[10px]">New Token</Badge>
    )}
  </div>
)}

{/* Authority Status */}
<AuthorityBadges
  mintAuthorityActive={data.mintAuthorityActive}
  freezeAuthorityActive={data.freezeAuthorityActive}
/>
```

**Step 4:** After the Trust Rating card's `<TrustRating>` component, add the scoring methodology:

```typescript
<ScoringMethodology />
```

**Step 5:** After the Trust Rating card, add the RugCheck second opinion (before Score History):

```typescript
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
    <span className="text-[10px] text-muted-foreground">
      ({data.rugCheck.riskCount} risk{data.rugCheck.riskCount !== 1 ? "s" : ""} detected)
    </span>
  </div>
)}
```

**Step 6:** Run `npx tsc --noEmit`.

**Step 7:** Commit:
```bash
git add src/app/token/\[mint\]/page.tsx
git commit -m "feat: integrate authority badges, Jupiter, RugCheck, token age, explainer on token page"
```

---

### Task 12: Add DeployerTimeline to deployer page

**Files:**
- Modify: `src/app/deployer/[wallet]/page.tsx`

**Step 1:** Add import:
```typescript
import DeployerTimeline from "@/components/features/DeployerTimeline";
```

**Step 2:** Before the "Deployed Tokens" section (around line 370), add:
```typescript
{/* Deployer Timeline */}
<DeployerTimeline tokens={data.deployedTokens} />
```

**Step 3:** Run `npx tsc --noEmit`.

**Step 4:** Commit:
```bash
git add src/app/deployer/\[wallet\]/page.tsx
git commit -m "feat: add deployer risk timeline to deployer page"
```

---

### Task 13: Build, push, and deploy

**Step 1:** Run `npm run build` — expect clean build.

**Step 2:** Run `git push origin main`.

**Step 3:** Run `vercel --prod --yes`.

Expected: All 12 improvements live on production.
