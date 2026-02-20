# Real-Time Token Discovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show new Solana tokens in real-time on the Discover page via Helius webhooks, Supabase Realtime, and curated sources (Jupiter, DexScreener, Pump.fun graduated).

**Architecture:** Helius webhook pushes TOKEN_MINT events to an ingestion API route, which writes lightweight records to a `new_token_events` Supabase table. The frontend subscribes to Supabase Realtime INSERT/UPDATE events for live feed updates. A cron job gradually enriches unanalyzed tokens with full trust analysis.

**Tech Stack:** Next.js 14 App Router, helius-sdk (webhooks), @supabase/supabase-js (Realtime), TypeScript, Tailwind CSS, shadcn/ui

---

## Task 1: Create `new_token_events` Supabase Table

**Files:**
- Create: `supabase/migrations/20260221_create_new_token_events.sql`

**Step 1: Write the SQL migration**

Create `supabase/migrations/20260221_create_new_token_events.sql`:

```sql
-- New token events table for real-time token discovery feed
CREATE TABLE IF NOT EXISTS new_token_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mint text UNIQUE NOT NULL,
  name text,
  symbol text,
  image_url text,
  source text NOT NULL DEFAULT 'helius_webhook',
  metadata jsonb DEFAULT '{}'::jsonb,
  analyzed boolean NOT NULL DEFAULT false,
  trust_rating integer NOT NULL DEFAULT 0,
  deployer_tier text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for feed queries (unanalyzed first, then by recency)
CREATE INDEX idx_new_token_events_feed ON new_token_events (analyzed, created_at DESC);

-- Index for cron enrichment queries
CREATE INDEX idx_new_token_events_unanalyzed ON new_token_events (analyzed) WHERE analyzed = false;

-- Enable RLS
ALTER TABLE new_token_events ENABLE ROW LEVEL SECURITY;

-- Anon users can read (for Supabase Realtime subscriptions)
CREATE POLICY "Anyone can read new_token_events"
  ON new_token_events FOR SELECT
  USING (true);

-- Only service role can write (enforced by Supabase service role key)
CREATE POLICY "Service role can insert new_token_events"
  ON new_token_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update new_token_events"
  ON new_token_events FOR UPDATE
  USING (true);

-- Enable Realtime on this table
ALTER PUBLICATION supabase_realtime ADD TABLE new_token_events;
```

**Step 2: Apply migration via Supabase dashboard or CLI**

Run the SQL in the Supabase SQL editor at `https://supabase.com/dashboard` for the project, or via:

```bash
# If using Supabase CLI locally:
npx supabase db push
```

**Step 3: Verify table exists**

Query `SELECT * FROM new_token_events LIMIT 1;` in the SQL editor. Should return empty result with no errors.

**Step 4: Commit**

```bash
git add supabase/migrations/20260221_create_new_token_events.sql
git commit -m "feat: add new_token_events table migration"
```

---

## Task 2: Add `NewTokenEvent` Type to Database Types

**Files:**
- Modify: `src/types/database.ts:195-249`

**Step 1: Add the NewTokenEvent interface and table mapping**

After the `BrowsingHistoryInsert` type (line 195) and before the `Database` interface (line 201), add:

```typescript
// ---------------------------------------------------------------------------
// New Token Events (Supabase table: new_token_events)
// ---------------------------------------------------------------------------

/** Source of a new token event. */
export type NewTokenSource = "jupiter" | "dexscreener" | "pumpfun_graduated" | "helius_webhook";

export interface NewTokenEvent {
  id: string;
  mint: string;
  name: string | null;
  symbol: string | null;
  image_url: string | null;
  source: NewTokenSource;
  metadata: Record<string, unknown>;
  analyzed: boolean;
  trust_rating: number;
  deployer_tier: string | null;
  created_at: string;
}

export type NewTokenEventInsert = Omit<NewTokenEvent, "id" | "created_at">;
```

Then inside the `Database.public.Tables` interface (line 203-240), add a new entry after `browsing_history`:

```typescript
      new_token_events: {
        Row: NewTokenEvent;
        Insert: NewTokenEventInsert;
        Update: Partial<NewTokenEventInsert>;
        Relationships: [];
      };
```

**Step 2: Verify build**

```bash
npx next build 2>&1 | tail -5
```

Expected: `Compiled successfully`

**Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add NewTokenEvent type definitions"
```

---

## Task 3: Expose Helius Webhook Client

**Files:**
- Modify: `src/services/helius.ts:88-105`

**Step 1: Export the getHelius function and add webhook helper**

Change `function getHelius()` (line 95) from private to exported:

```typescript
export function getHelius(): HeliusClient {
```

Then add a webhook helper after the `getHelius` function (after line 105):

```typescript
/**
 * Get the Helius webhook client for managing webhook subscriptions.
 * Lazy-loaded from the Helius SDK.
 */
export function getWebhookClient() {
  const helius = getHelius();
  return helius.webhooks;
}
```

**Step 2: Verify build**

```bash
npx next build 2>&1 | tail -5
```

**Step 3: Commit**

```bash
git add src/services/helius.ts
git commit -m "feat: expose Helius client and webhook helper"
```

---

## Task 4: Create Webhook Ingestion Endpoint

**Files:**
- Create: `src/app/api/ingest/new-tokens/route.ts`

**Step 1: Create the ingestion API route**

This endpoint handles both Helius webhook POST payloads and internal ingest calls. Create `src/app/api/ingest/new-tokens/route.ts`:

```typescript
/**
 * POST /api/ingest/new-tokens
 *
 * Ingestion endpoint for new token events from multiple sources:
 * - Helius webhook (TOKEN_MINT events)
 * - Internal calls from cron (Jupiter, DexScreener batches)
 *
 * Deduplicates by mint, fetches basic metadata, writes to new_token_events.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTokenMetadata } from "@/services/helius";
import type { NewTokenSource } from "@/types/database";

const PUMPFUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

const WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET;

/** Schema for internal batch ingest calls. */
const batchSchema = z.object({
  tokens: z.array(
    z.object({
      mint: z.string().min(32).max(44),
      name: z.string().nullable().optional(),
      symbol: z.string().nullable().optional(),
      image_url: z.string().nullable().optional(),
      source: z.enum(["jupiter", "dexscreener", "pumpfun_graduated", "helius_webhook"]),
    })
  ),
});

/**
 * Extract mint address from a Helius enhanced webhook payload.
 * TOKEN_MINT events have the mint in tokenTransfers[0].mint.
 */
function extractMintFromWebhook(payload: Record<string, unknown>[]): string[] {
  const mints: string[] = [];
  for (const tx of payload) {
    const transfers = tx.tokenTransfers as Array<{ mint?: string }> | undefined;
    if (transfers) {
      for (const t of transfers) {
        if (t.mint) mints.push(t.mint);
      }
    }
  }
  return [...new Set(mints)];
}

/**
 * Detect if a transaction involves Pump.fun graduation.
 */
function isPumpfunGraduation(tx: Record<string, unknown>): boolean {
  const instructions = tx.instructions as Array<{ programId?: string }> | undefined;
  if (!instructions) return false;
  return instructions.some((ix) => ix.programId === PUMPFUN_PROGRAM);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Determine if this is a Helius webhook or an internal batch call
    const isWebhook = Array.isArray(body);

    if (isWebhook) {
      // Verify webhook auth header
      if (WEBHOOK_SECRET) {
        const authHeader = request.headers.get("authorization");
        if (authHeader !== WEBHOOK_SECRET) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
      }

      const mints = extractMintFromWebhook(body);
      if (mints.length === 0) {
        return NextResponse.json({ ingested: 0 });
      }

      // Determine source — check for Pump.fun graduation
      const hasPumpfun = body.some((tx: Record<string, unknown>) => isPumpfunGraduation(tx));

      const supabase = createServerSupabaseClient();
      let ingested = 0;

      for (const mint of mints) {
        // Fetch lightweight metadata from Helius
        const metadata = await getTokenMetadata(mint);
        const source: NewTokenSource = hasPumpfun ? "pumpfun_graduated" : "helius_webhook";

        const { error } = await supabase
          .from("new_token_events")
          .upsert(
            {
              mint,
              name: metadata?.name ?? null,
              symbol: metadata?.symbol ?? null,
              image_url: metadata?.image ?? null,
              source,
              metadata: metadata?.raw ? { asset: metadata.raw } : {},
              analyzed: false,
              trust_rating: 0,
              deployer_tier: null,
            },
            { onConflict: "mint", ignoreDuplicates: true }
          );

        if (!error) ingested++;
      }

      return NextResponse.json({ ingested, total: mints.length });
    }

    // Internal batch ingest
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    let ingested = 0;

    for (const token of parsed.data.tokens) {
      // If name/symbol missing, fetch from Helius
      let name = token.name ?? null;
      let symbol = token.symbol ?? null;
      let imageUrl = token.image_url ?? null;

      if (!name && !symbol) {
        const metadata = await getTokenMetadata(token.mint);
        name = metadata?.name ?? null;
        symbol = metadata?.symbol ?? null;
        imageUrl = metadata?.image ?? null;
      }

      const { error } = await supabase
        .from("new_token_events")
        .upsert(
          {
            mint: token.mint,
            name,
            symbol,
            image_url: imageUrl,
            source: token.source,
            metadata: {},
            analyzed: false,
            trust_rating: 0,
            deployer_tier: null,
          },
          { onConflict: "mint", ignoreDuplicates: true }
        );

      if (!error) ingested++;
    }

    return NextResponse.json({ ingested, total: parsed.data.tokens.length });
  } catch (error) {
    console.error("POST /api/ingest/new-tokens error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify build**

```bash
npx next build 2>&1 | tail -5
```

Expected: `Compiled successfully`, new route `/api/ingest/new-tokens` appears in route list.

**Step 3: Commit**

```bash
git add src/app/api/ingest/new-tokens/route.ts
git commit -m "feat: add webhook ingestion endpoint for new tokens"
```

---

## Task 5: Create Webhook Registration Script

**Files:**
- Create: `src/scripts/register-webhook.ts`

**Step 1: Write the registration script**

This is a one-time setup script. Create `src/scripts/register-webhook.ts`:

```typescript
/**
 * One-time script to register a Helius webhook for TOKEN_MINT events.
 *
 * Usage:
 *   npx tsx src/scripts/register-webhook.ts
 *
 * Required env vars:
 *   HELIUS_API_KEY — Helius API key
 *   NEXTAUTH_URL — Base URL of the deployed app (e.g. https://fairmint-sigma.vercel.app)
 *   HELIUS_WEBHOOK_SECRET — Secret to verify webhook deliveries
 */

import { makeWebhookClient } from "helius-sdk/webhooks/client";

async function main() {
  const apiKey = process.env.HELIUS_API_KEY;
  const baseUrl = process.env.NEXTAUTH_URL;
  const webhookSecret = process.env.HELIUS_WEBHOOK_SECRET;

  if (!apiKey) {
    console.error("Missing HELIUS_API_KEY");
    process.exit(1);
  }
  if (!baseUrl) {
    console.error("Missing NEXTAUTH_URL");
    process.exit(1);
  }

  const webhooks = makeWebhookClient(apiKey);

  // Check existing webhooks
  const existing = await webhooks.getAll();
  console.log(`Found ${existing.length} existing webhook(s)`);

  const webhookURL = `${baseUrl}/api/ingest/new-tokens`;

  // Check if our webhook already exists
  const alreadyExists = existing.find((w) => w.webhookURL === webhookURL);
  if (alreadyExists) {
    console.log(`Webhook already registered: ${alreadyExists.webhookID}`);
    console.log(`  URL: ${alreadyExists.webhookURL}`);
    console.log(`  Types: ${alreadyExists.transactionTypes.join(", ")}`);
    return;
  }

  // Metaplex Token Metadata Program
  const METAPLEX_METADATA = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

  const webhook = await webhooks.create({
    webhookURL,
    transactionTypes: ["TOKEN_MINT"],
    accountAddresses: [METAPLEX_METADATA],
    webhookType: "enhanced",
    authHeader: webhookSecret ?? "",
  });

  console.log("Webhook registered successfully!");
  console.log(`  ID: ${webhook.webhookID}`);
  console.log(`  URL: ${webhook.webhookURL}`);
  console.log(`  Types: ${webhook.transactionTypes.join(", ")}`);
  console.log(`  Addresses: ${webhook.accountAddresses.length} monitored`);
}

main().catch((err) => {
  console.error("Failed to register webhook:", err);
  process.exit(1);
});
```

**Step 2: Add HELIUS_WEBHOOK_SECRET to .env.local**

Add to `.env.local`:
```
HELIUS_WEBHOOK_SECRET=your-generated-secret-here
```

Generate a secret:
```bash
openssl rand -hex 32
```

**Step 3: Commit (do NOT commit .env.local)**

```bash
git add src/scripts/register-webhook.ts
git commit -m "feat: add Helius webhook registration script"
```

---

## Task 6: Update Discover API to Read from `new_token_events`

**Files:**
- Modify: `src/app/api/discover/route.ts:55-134`

**Step 1: Replace the `tab === "new"` branch**

Replace the entire `if (tab === "new") { ... }` block (lines 55-134) with:

```typescript
    if (tab === "new") {
      // Read from the new_token_events table (populated by webhook + cron)
      const { data, error } = await supabase
        .from("new_token_events")
        .select("mint, name, symbol, image_url, source, analyzed, trust_rating, deployer_tier, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Map to the standard DiscoverToken shape
      const tokens = (data ?? []).map((row) => ({
        mint: row.mint,
        name: row.name,
        symbol: row.symbol,
        image_url: row.image_url,
        trust_rating: row.trust_rating,
        deployer_tier: row.deployer_tier,
        holder_count: 0,
        token_age_days: null,
        risk_flags: [],
        analyzed_at: row.analyzed ? row.created_at : null,
        source: row.source,
        created_at: row.created_at,
      }));

      return NextResponse.json({ tab, tokens });
    }
```

Also remove the now-unused imports at the top of the file:

```typescript
// Remove these two imports:
import { fetchRecentTokens } from "@/services/jupiter";
import { fetchLatestProfiles } from "@/services/dexscreener";
```

**Step 2: Verify build**

```bash
npx next build 2>&1 | tail -5
```

**Step 3: Commit**

```bash
git add src/app/api/discover/route.ts
git commit -m "feat: discover tab=new reads from new_token_events table"
```

---

## Task 7: Update Cron to Ingest + Enrich `new_token_events`

**Files:**
- Modify: `src/app/api/cron/refresh-tokens/route.ts:90-130`

**Step 1: Replace Phase 2 and add Phase 3**

After the Phase 1 results (line 88), replace the existing Phase 2 block and the return statement with:

```typescript
  // Phase 2: Ingest new tokens from Jupiter + DexScreener into new_token_events
  let ingested = 0;
  try {
    const [jupiterTokens, dexProfiles] = await Promise.all([
      fetchRecentTokens(20),
      fetchLatestProfiles(20),
    ]);

    const supabase = createServerSupabaseClient();
    const tokens: Array<{ mint: string; name: string | null; symbol: string | null; image_url: string | null; source: string }> = [];

    for (const t of jupiterTokens) {
      tokens.push({
        mint: t.mint,
        name: t.name ?? null,
        symbol: t.symbol ?? null,
        image_url: t.logoURI ?? null,
        source: "jupiter",
      });
    }

    for (const p of dexProfiles) {
      if (!tokens.some((t) => t.mint === p.tokenAddress)) {
        tokens.push({
          mint: p.tokenAddress,
          name: null,
          symbol: null,
          image_url: p.icon ?? null,
          source: "dexscreener",
        });
      }
    }

    for (const token of tokens) {
      const { error } = await supabase
        .from("new_token_events")
        .upsert(
          {
            mint: token.mint,
            name: token.name,
            symbol: token.symbol,
            image_url: token.image_url,
            source: token.source,
            metadata: {},
            analyzed: false,
            trust_rating: 0,
            deployer_tier: null,
          },
          { onConflict: "mint", ignoreDuplicates: true }
        );
      if (!error) ingested++;
    }
  } catch (error) {
    console.error("Phase 2 (ingest new tokens) failed:", error);
  }

  // Phase 3: Enrich unanalyzed tokens in new_token_events with full trust analysis
  let enriched = 0;
  try {
    const supabase = createServerSupabaseClient();
    const { data: unanalyzed } = await supabase
      .from("new_token_events")
      .select("mint")
      .eq("analyzed", false)
      .order("created_at", { ascending: false })
      .limit(5);

    for (const row of unanalyzed ?? []) {
      try {
        const analysis = await analyzeToken(row.mint);
        if (analysis) {
          await supabase
            .from("new_token_events")
            .update({
              analyzed: true,
              trust_rating: analysis.trustRating,
              deployer_tier: analysis.deployerTier ?? null,
              name: analysis.name ?? undefined,
              symbol: analysis.symbol ?? undefined,
              image_url: analysis.image ?? undefined,
            })
            .eq("mint", row.mint);
          enriched++;
        }
      } catch (error) {
        console.error(`Failed to enrich token ${row.mint}:`, error);
      }
    }
  } catch (error) {
    console.error("Phase 3 (enrich new tokens) failed:", error);
  }

  return NextResponse.json({
    refreshed: succeeded,
    failed,
    ingested,
    enriched,
    total: allMints.length,
    popular: POPULAR_MINTS.length,
    stale: staleMints.length,
    results,
    timestamp: new Date().toISOString(),
  });
```

Also add the DexScreener import at the top of the file:

```typescript
import { fetchLatestProfiles } from "@/services/dexscreener";
```

**Step 2: Check the analyzeToken return type**

Read `src/services/tokenAnalyzer.ts` to verify the return shape includes `trustRating`, `deployerTier`, `name`, `symbol`, `image`. Adjust field names in the update if they differ.

**Step 3: Verify build**

```bash
npx next build 2>&1 | tail -5
```

**Step 4: Commit**

```bash
git add src/app/api/cron/refresh-tokens/route.ts
git commit -m "feat: cron ingests + enriches new_token_events"
```

---

## Task 8: Add `source` and `created_at` to `DiscoverToken` Type

**Files:**
- Modify: `src/hooks/useDiscover.ts:6-20`

**Step 1: Update the DiscoverToken interface**

Add `source` and `created_at` fields:

```typescript
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
  analyzed_at: string | null;
  liquidity_usd?: number;
  price_usd?: number;
  market_cap?: number;
  source?: string;
  created_at?: string;
}
```

**Step 2: Commit**

```bash
git add src/hooks/useDiscover.ts
git commit -m "feat: add source and created_at to DiscoverToken type"
```

---

## Task 9: Create `useNewTokenFeed` Hook with Supabase Realtime

**Files:**
- Create: `src/hooks/useNewTokenFeed.ts`

**Step 1: Write the Realtime subscription hook**

Create `src/hooks/useNewTokenFeed.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { DiscoverToken } from "@/hooks/useDiscover";

interface UseNewTokenFeedReturn {
  tokens: DiscoverToken[];
  loading: boolean;
  error: string | null;
  /** Number of new tokens received since last acknowledged. */
  newCount: number;
  /** Mark new tokens as seen (resets newCount). */
  acknowledge: () => void;
  refetch: () => Promise<void>;
}

/**
 * Hook for the "New Launches" tab with Supabase Realtime subscription.
 *
 * 1. On mount: fetches initial tokens from /api/discover?tab=new
 * 2. Subscribes to INSERT and UPDATE on new_token_events via Supabase Realtime
 * 3. INSERTs prepend new tokens to the list
 * 4. UPDATEs update existing tokens in-place (e.g. trust score enrichment)
 */
export function useNewTokenFeed(limit: number = 20): UseNewTokenFeedReturn {
  const [tokens, setTokens] = useState<DiscoverToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const initialLoadDone = useRef(false);

  const fetchInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/discover?tab=new&limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setTokens(data.tokens ?? []);
      initialLoadDone.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setTokens([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  // Supabase Realtime subscription
  useEffect(() => {
    const supabase = getSupabaseClient();

    const channel = supabase
      .channel("new_token_events_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "new_token_events" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const token: DiscoverToken = {
            mint: row.mint as string,
            name: (row.name as string) ?? null,
            symbol: (row.symbol as string) ?? null,
            image_url: (row.image_url as string) ?? null,
            trust_rating: (row.trust_rating as number) ?? 0,
            deployer_tier: (row.deployer_tier as string) ?? null,
            holder_count: 0,
            token_age_days: null,
            risk_flags: [],
            analyzed_at: row.analyzed ? (row.created_at as string) : null,
            source: (row.source as string) ?? undefined,
            created_at: (row.created_at as string) ?? undefined,
          };

          setTokens((prev) => {
            // Deduplicate
            if (prev.some((t) => t.mint === token.mint)) return prev;
            return [token, ...prev];
          });

          if (initialLoadDone.current) {
            setNewCount((c) => c + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "new_token_events" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          setTokens((prev) =>
            prev.map((t) =>
              t.mint === (row.mint as string)
                ? {
                    ...t,
                    trust_rating: (row.trust_rating as number) ?? t.trust_rating,
                    deployer_tier: (row.deployer_tier as string) ?? t.deployer_tier,
                    name: (row.name as string) ?? t.name,
                    symbol: (row.symbol as string) ?? t.symbol,
                    image_url: (row.image_url as string) ?? t.image_url,
                    analyzed_at: row.analyzed ? (row.created_at as string) : null,
                  }
                : t
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const acknowledge = useCallback(() => {
    setNewCount(0);
  }, []);

  return { tokens, loading, error, newCount, acknowledge, refetch: fetchInitial };
}
```

**Step 2: Verify build**

```bash
npx next build 2>&1 | tail -5
```

**Step 3: Commit**

```bash
git add src/hooks/useNewTokenFeed.ts
git commit -m "feat: add useNewTokenFeed hook with Supabase Realtime"
```

---

## Task 10: Update Discover Page Frontend

**Files:**
- Modify: `src/app/discover/page.tsx`

**Step 1: Add imports and helper**

At the top of the file, add the new import and a relative-time helper:

```typescript
import { useNewTokenFeed } from "@/hooks/useNewTokenFeed";
```

After the existing `truncateAddress` helper (line 42), add:

```typescript
function timeAgo(isoDate: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const SOURCE_LABELS: Record<string, { label: string; className: string }> = {
  jupiter: { label: "Jupiter", className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
  dexscreener: { label: "DexScreener", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  pumpfun_graduated: { label: "Pump.fun", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  helius_webhook: { label: "On-chain", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};
```

**Step 2: Update DiscoverTokenCard to show source badge + relative time**

In the `DiscoverTokenCard` component, after the deployer_tier Badge (around line 93), add a source badge:

```typescript
              {token.source && SOURCE_LABELS[token.source] && (
                <Badge className={cn("text-xs", SOURCE_LABELS[token.source].className)}>
                  {SOURCE_LABELS[token.source].label}
                </Badge>
              )}
```

In the Stats section (around line 98-115), add relative time for new tokens and wrap in a conditional:

Replace the existing stats section with:

```typescript
          {/* Stats */}
          <div className="hidden flex-col items-end gap-1 sm:flex">
            {token.created_at && isUnanalyzed && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {timeAgo(token.created_at)}
              </div>
            )}
            {!isUnanalyzed && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="size-3" />
                {token.holder_count} holders
              </div>
            )}
            {!isUnanalyzed && token.token_age_days != null && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {token.token_age_days}d old
              </div>
            )}
            {riskCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-yellow-600">
                <AlertTriangle className="size-3" />
                {riskCount} risk{riskCount !== 1 ? "s" : ""}
              </div>
            )}
          </div>
```

**Step 3: Add NewLaunchesContent component**

After `TabContent`, add a new component for the "new" tab:

```typescript
function NewLaunchesContent() {
  const { tokens, loading, error, newCount, acknowledge } = useNewTokenFeed();

  if (loading) return <DiscoverSkeleton />;

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Failed to load tokens. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (tokens.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No new tokens found yet. Tokens appear here in real-time.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {newCount > 0 && (
        <button
          onClick={acknowledge}
          className="w-full rounded-lg bg-sky-50 px-4 py-2 text-center text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100 dark:bg-sky-950/30 dark:text-sky-400 dark:hover:bg-sky-950/50"
        >
          {newCount} new token{newCount !== 1 ? "s" : ""} — click to see
        </button>
      )}
      {tokens.map((token) => (
        <DiscoverTokenCard key={token.mint} token={token} />
      ))}
    </div>
  );
}
```

**Step 4: Wire the new component into the page**

In the `DiscoverPage` component, replace:

```tsx
        <TabsContent value="new">
          <TabContent tab="new" />
        </TabsContent>
```

with:

```tsx
        <TabsContent value="new">
          <NewLaunchesContent />
        </TabsContent>
```

**Step 5: Verify build**

```bash
npx next build 2>&1 | tail -5
```

**Step 6: Commit**

```bash
git add src/app/discover/page.tsx
git commit -m "feat: real-time New Launches tab with source badges and relative time"
```

---

## Task 11: Verification & Final Commit

**Step 1: Full build**

```bash
npx next build
```

Verify: all routes compile, no TypeScript errors.

**Step 2: Manual smoke test**

Start the dev server:

```bash
npx next dev
```

- Visit `/discover` and click "New Launches" tab
- Verify it loads (empty or with tokens if table is populated)
- Check browser console for Supabase Realtime connection (no errors)
- Visit `/api/discover?tab=new` — should return JSON with `tab: "new"` and `tokens: []`
- Verify `tab=trending` and `tab=trusted` still work unchanged

**Step 3: Register the Helius webhook**

```bash
npx tsx src/scripts/register-webhook.ts
```

Expected: "Webhook registered successfully!" with webhook ID.

**Step 4: Final commit with all loose changes**

```bash
git add -A
git commit -m "feat: complete real-time token discovery pipeline"
```

---

## Summary of All Files

| Action | File |
|--------|------|
| Create | `supabase/migrations/20260221_create_new_token_events.sql` |
| Create | `src/app/api/ingest/new-tokens/route.ts` |
| Create | `src/hooks/useNewTokenFeed.ts` |
| Create | `src/scripts/register-webhook.ts` |
| Modify | `src/types/database.ts` |
| Modify | `src/services/helius.ts` |
| Modify | `src/app/api/discover/route.ts` |
| Modify | `src/app/api/cron/refresh-tokens/route.ts` |
| Modify | `src/hooks/useDiscover.ts` |
| Modify | `src/app/discover/page.tsx` |
