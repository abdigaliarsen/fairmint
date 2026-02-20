# Historical Score Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Track wallet FairScores and token trust ratings over time, displayed as Recharts line charts on token, deployer, and reputation pages.

**Architecture:** Two Supabase tables (`wallet_score_history`, `token_score_history`) store daily snapshots. Data is collected by piggybacking on existing `getFullScore()` and `analyzeToken()` calls. Two API endpoints serve history data. A shared `ScoreHistoryChart` Recharts component renders on three pages.

**Tech Stack:** Recharts, Supabase (PostgreSQL), Next.js API routes, React hooks

---

### Task 1: Create Supabase tables

**Step 1: Create tables via Supabase SQL editor**

Run the following SQL in the Supabase dashboard SQL editor (project `pxcolqnhttmdjkgprifg`):

```sql
-- Wallet score history
CREATE TABLE IF NOT EXISTS wallet_score_history (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(44) NOT NULL,
  score_decimal DECIMAL,
  score_integer INTEGER,
  tier VARCHAR(20),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallet_score_history_lookup
  ON wallet_score_history (wallet, recorded_at DESC);

-- Token score history
CREATE TABLE IF NOT EXISTS token_score_history (
  id SERIAL PRIMARY KEY,
  mint VARCHAR(44) NOT NULL,
  trust_rating DECIMAL,
  holder_count INTEGER,
  risk_flag_count INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_token_score_history_lookup
  ON token_score_history (mint, recorded_at DESC);

-- RLS policies (allow anon read/write since we use anon key)
ALTER TABLE wallet_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read wallet_score_history"
  ON wallet_score_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert wallet_score_history"
  ON wallet_score_history FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read token_score_history"
  ON token_score_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert token_score_history"
  ON token_score_history FOR INSERT WITH CHECK (true);
```

**Step 2: Verify tables exist**

Run in SQL editor:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE '%_history';
```
Expected: `wallet_score_history`, `token_score_history`

---

### Task 2: Install Recharts

**Step 1: Install**

```bash
npm install recharts
```

**Step 2: Verify**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add recharts dependency for score history charts"
```

---

### Task 3: Add piggyback logging to getFullScore()

**Files:**
- Modify: `src/services/fairscale.ts:245-260`

**Step 1: Add history snapshot after cache upsert**

Insert after the `await supabase.from("cached_scores").upsert(...)` block (after line 249) and before the `return` statement (line 251):

```typescript
  // Log wallet score history (one snapshot per wallet per day)
  const today = new Date().toISOString().slice(0, 10);
  const { data: existingSnapshot } = await supabase
    .from("wallet_score_history")
    .select("id")
    .eq("wallet", wallet)
    .gte("recorded_at", `${today}T00:00:00Z`)
    .lt("recorded_at", `${today}T23:59:59Z`)
    .limit(1)
    .maybeSingle();

  if (!existingSnapshot) {
    await supabase.from("wallet_score_history").insert({
      wallet,
      score_decimal: data.fairscore,
      score_integer: effectiveIntegerScore,
      tier,
    });
  }
```

**Step 2: Verify build**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/services/fairscale.ts
git commit -m "feat: log wallet score history snapshots from getFullScore"
```

---

### Task 4: Add piggyback logging to analyzeToken()

**Files:**
- Modify: `src/services/tokenAnalyzer.ts:413-417`

**Step 1: Add history snapshot after token analysis cache upsert**

Insert after the `await supabase.from("token_analyses").upsert(...)` block (after line 417) and before the `return` statement (line 419):

```typescript
  // Log token score history (one snapshot per token per day)
  const today = new Date().toISOString().slice(0, 10);
  const { data: existingSnapshot } = await supabase
    .from("token_score_history")
    .select("id")
    .eq("mint", mint)
    .gte("recorded_at", `${today}T00:00:00Z`)
    .lt("recorded_at", `${today}T23:59:59Z`)
    .limit(1)
    .maybeSingle();

  if (!existingSnapshot) {
    await supabase.from("token_score_history").insert({
      mint,
      trust_rating: trustRating,
      holder_count: holders.length,
      risk_flag_count: riskFlags.length,
    });
  }
```

**Step 2: Verify build**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/services/tokenAnalyzer.ts
git commit -m "feat: log token score history snapshots from analyzeToken"
```

---

### Task 5: Create history API endpoints

**Files:**
- Create: `src/app/api/history/wallet/route.ts`
- Create: `src/app/api/history/token/route.ts`

**Step 1: Create wallet history endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const querySchema = z.object({
  wallet: z.string().min(32).max(44),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ wallet: searchParams.get("wallet") });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("wallet_score_history")
    .select("score_decimal, score_integer, tier, recorded_at")
    .eq("wallet", parsed.data.wallet)
    .gte("recorded_at", thirtyDaysAgo)
    .order("recorded_at", { ascending: true });

  if (error) {
    console.error("Wallet history query error:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
```

**Step 2: Create token history endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const querySchema = z.object({
  mint: z.string().min(32).max(44),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ mint: searchParams.get("mint") });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid mint" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("token_score_history")
    .select("trust_rating, holder_count, risk_flag_count, recorded_at")
    .eq("mint", parsed.data.mint)
    .gte("recorded_at", thirtyDaysAgo)
    .order("recorded_at", { ascending: true });

  if (error) {
    console.error("Token history query error:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
```

**Step 3: Verify build**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/app/api/history/wallet/route.ts src/app/api/history/token/route.ts
git commit -m "feat: add wallet and token score history API endpoints"
```

---

### Task 6: Create useScoreHistory hook

**Files:**
- Create: `src/hooks/useScoreHistory.ts`

**Step 1: Create the hook**

```typescript
"use client";

import { useState, useEffect } from "react";

export interface ScoreHistoryPoint {
  date: string;
  score: number;
}

interface UseScoreHistoryOptions {
  type: "wallet" | "token";
  subject: string | null; // wallet address or token mint
}

export function useScoreHistory({ type, subject }: UseScoreHistoryOptions) {
  const [data, setData] = useState<ScoreHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!subject) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const param = type === "wallet" ? `wallet=${encodeURIComponent(subject)}` : `mint=${encodeURIComponent(subject)}`;
    fetch(`/api/history/${type}?${param}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: Array<Record<string, unknown>>) => {
        const points: ScoreHistoryPoint[] = rows.map((r) => ({
          date: new Date(r.recorded_at as string).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          score: Number(
            type === "wallet" ? r.score_decimal : r.trust_rating
          ),
        }));
        setData(points);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [type, subject]);

  return { data, loading };
}
```

**Step 2: Verify build**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/hooks/useScoreHistory.ts
git commit -m "feat: add useScoreHistory hook for fetching score history data"
```

---

### Task 7: Create ScoreHistoryChart component

**Files:**
- Create: `src/components/features/ScoreHistoryChart.tsx`

**Step 1: Create the component**

```tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useScoreHistory } from "@/hooks/useScoreHistory";
import type { ScoreHistoryPoint } from "@/hooks/useScoreHistory";

interface ScoreHistoryChartProps {
  type: "wallet" | "token";
  subject: string | null;
  label: string;
  color?: string;
}

function ChartTooltip({
  active,
  payload,
  label: dateLabel,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-sm">
      <p className="font-medium">{dateLabel}</p>
      <p>Score: {payload[0].value}</p>
    </div>
  );
}

export default function ScoreHistoryChart({
  type,
  subject,
  label,
  color = "#059669",
}: ScoreHistoryChartProps) {
  const { data, loading } = useScoreHistory({ type, subject });

  if (!subject) return null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score History</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score History</CardTitle>
          <CardDescription>
            No historical data yet. History will build as {label.toLowerCase()} is tracked over time.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Score History</CardTitle>
        <CardDescription>
          {label} over the last 30 days.
          {data.length === 1 && " Tracking just started — more data points will appear over time."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={30}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="score"
              stroke={color}
              strokeWidth={2}
              dot={data.length === 1}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify build**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/features/ScoreHistoryChart.tsx
git commit -m "feat: add ScoreHistoryChart component with Recharts line chart"
```

---

### Task 8: Add ScoreHistoryChart to token page

**Files:**
- Modify: `src/app/token/[mint]/page.tsx`

**Step 1: Add import**

```typescript
import ScoreHistoryChart from "@/components/features/ScoreHistoryChart";
```

**Step 2: Add chart after Trust Rating section**

Find the comment `{/* Trust Rating */}` (around line 229). After that entire Card closes, insert:

```tsx
          {/* Score History */}
          <ScoreHistoryChart
            type="token"
            subject={data.mint}
            label="Trust Rating"
            color="#059669"
          />
```

**Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add src/app/token/[mint]/page.tsx
git commit -m "feat: add score history chart to token page"
```

---

### Task 9: Add ScoreHistoryChart to deployer page

**Files:**
- Modify: `src/app/deployer/[wallet]/page.tsx`

**Step 1: Add import**

```typescript
import ScoreHistoryChart from "@/components/features/ScoreHistoryChart";
```

**Step 2: Add chart after Score Breakdown section**

Find `{/* Score Breakdown */}` (around line 213). After that `</section>` closes, insert:

```tsx
          {/* Score History */}
          <ScoreHistoryChart
            type="wallet"
            subject={data.wallet}
            label="FairScore"
            color="#7c3aed"
          />
```

**Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add src/app/deployer/[wallet]/page.tsx
git commit -m "feat: add score history chart to deployer page"
```

---

### Task 10: Add ScoreHistoryChart to reputation page

**Files:**
- Modify: `src/app/reputation/[wallet]/page.tsx`

**Step 1: Add import**

```typescript
import ScoreHistoryChart from "@/components/features/ScoreHistoryChart";
```

**Step 2: Add chart after AI Analysis section**

Find `{/* AI Analysis */}` (around line 160). After the `<AISummaryCard>` component, insert:

```tsx
          {/* Score History */}
          <ScoreHistoryChart
            type="wallet"
            subject={data.wallet}
            label="FairScore"
            color="#7c3aed"
          />
```

**Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add src/app/reputation/[wallet]/page.tsx
git commit -m "feat: add score history chart to reputation page"
```

---

### Task 11: Full build, push, deploy

**Step 1: Full build**

```bash
npx next build
```
Expected: builds successfully with `/api/history/wallet` and `/api/history/token` routes listed.

**Step 2: Push and deploy**

```bash
git push origin main
```

**Step 3: Manual verification**

- Visit a token page — "Score History" card appears (empty initially, will populate over time)
- Visit a deployer page — "Score History" card with FairScore label
- Visit a reputation page — "Score History" card with FairScore label
- After the cron runs once, token pages for popular tokens should show a data point
