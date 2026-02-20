# Browsing History Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Track user browsing history across tokens, deployers, and reputation pages with localStorage-first storage, periodic Supabase sync for authenticated users, and a dedicated `/history` page with type filtering and search.

**Architecture:** localStorage-first approach where every page visit writes to `tokentrust_history` in localStorage immediately. A `useBrowsingHistory` hook manages read/write/sync. Authenticated users get periodic (60s) background sync to a Supabase `browsing_history` table. The `/history` page reads from localStorage (anonymous) or merged server data (authenticated), with type pill filters and text search.

**Tech Stack:** Next.js App Router, Supabase (server-side), localStorage (client-side), Zod validation, Recharts (mini sparklines), React hooks, Lucide icons.

---

### Task 1: Create Supabase `browsing_history` table

**Files:**
- None (Supabase MCP migration)

**Step 1: Create the table via Supabase MCP**

Run the `apply_migration` Supabase MCP tool with this SQL:

```sql
CREATE TABLE IF NOT EXISTS browsing_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet text NOT NULL,
  type text NOT NULL CHECK (type IN ('token', 'deployer', 'reputation')),
  subject text NOT NULL,
  name text,
  symbol text,
  score numeric,
  tier text,
  visited_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet, type, subject)
);

CREATE INDEX idx_browsing_history_wallet ON browsing_history (wallet, visited_at DESC);

ALTER TABLE browsing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON browsing_history
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON browsing_history
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON browsing_history
  FOR UPDATE USING (true);
```

**Step 2: Verify table was created**

Use the Supabase MCP `execute_sql` tool:
```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'browsing_history' ORDER BY ordinal_position;
```

Expected: 10 columns (id, wallet, type, subject, name, symbol, score, tier, visited_at, created_at).

**Step 3: Commit**

```bash
git commit --allow-empty -m "feat: create browsing_history Supabase table"
```

---

### Task 2: Add `BrowsingHistoryEntry` type to `database.ts`

**Files:**
- Modify: `src/types/database.ts`

**Step 1: Add the interface and insert type**

Add after the Notifications section (around line 173), before the Database Type Map:

```typescript
// ---------------------------------------------------------------------------
// Browsing History (Supabase table: browsing_history)
// ---------------------------------------------------------------------------

export type BrowsingHistoryType = "token" | "deployer" | "reputation";

export interface BrowsingHistoryEntry {
  id: string;
  wallet: string;
  type: BrowsingHistoryType;
  subject: string;
  name: string | null;
  symbol: string | null;
  score: number | null;
  tier: FairScoreTier | null;
  visited_at: string;
  created_at: string;
}

export type BrowsingHistoryInsert = Omit<BrowsingHistoryEntry, "id" | "created_at">;
```

**Step 2: Add to the Database type map**

Inside the `Tables` object in the `Database` interface, add:

```typescript
browsing_history: {
  Row: BrowsingHistoryEntry;
  Insert: BrowsingHistoryInsert;
  Update: Partial<BrowsingHistoryInsert>;
  Relationships: [];
};
```

**Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add BrowsingHistoryEntry type definition"
```

---

### Task 3: Create `useBrowsingHistory` hook with localStorage management

**Files:**
- Create: `src/hooks/useBrowsingHistory.ts`

**Step 1: Create the hook**

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import type { BrowsingHistoryType } from "@/types/database";
import type { FairScoreTier } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocalHistoryEntry {
  id: string;
  type: BrowsingHistoryType;
  subject: string;
  name: string | null;
  symbol: string | null;
  score: number | null;
  tier: FairScoreTier | null;
  visitedAt: string;
}

interface UseBrowsingHistoryReturn {
  entries: LocalHistoryEntry[];
  recordVisit: (entry: Omit<LocalHistoryEntry, "id" | "visitedAt">) => void;
  clearHistory: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "tokentrust_history";
const MAX_ENTRIES = 200;
const SYNC_INTERVAL_MS = 60_000;
const LAST_SYNCED_KEY = "tokentrust_history_last_synced";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return crypto.randomUUID();
}

function readLocalHistory(): LocalHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalHistoryEntry[];
  } catch {
    return [];
  }
}

function writeLocalHistory(entries: LocalHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage might be full — silently fail
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBrowsingHistory(): UseBrowsingHistoryReturn {
  const { data: session } = useSession();
  const wallet = session?.user?.wallet ?? null;
  const [entries, setEntries] = useState<LocalHistoryEntry[]>([]);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setEntries(readLocalHistory());
  }, []);

  // Record a visit
  const recordVisit = useCallback(
    (entry: Omit<LocalHistoryEntry, "id" | "visitedAt">) => {
      setEntries((prev) => {
        // Check for existing entry with same type+subject
        const existingIndex = prev.findIndex(
          (e) => e.type === entry.type && e.subject === entry.subject
        );

        const now = new Date().toISOString();
        let updated: LocalHistoryEntry[];

        if (existingIndex >= 0) {
          // Update existing: move to front, update fields
          const existing = prev[existingIndex];
          const updatedEntry: LocalHistoryEntry = {
            ...existing,
            name: entry.name ?? existing.name,
            symbol: entry.symbol ?? existing.symbol,
            score: entry.score ?? existing.score,
            tier: entry.tier ?? existing.tier,
            visitedAt: now,
          };
          updated = [
            updatedEntry,
            ...prev.slice(0, existingIndex),
            ...prev.slice(existingIndex + 1),
          ];
        } else {
          // New entry: prepend
          const newEntry: LocalHistoryEntry = {
            id: generateId(),
            ...entry,
            visitedAt: now,
          };
          updated = [newEntry, ...prev];
        }

        // Cap at MAX_ENTRIES
        if (updated.length > MAX_ENTRIES) {
          updated = updated.slice(0, MAX_ENTRIES);
        }

        writeLocalHistory(updated);
        return updated;
      });
    },
    []
  );

  // Clear all history
  const clearHistory = useCallback(() => {
    setEntries([]);
    writeLocalHistory([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(LAST_SYNCED_KEY);
    }
  }, []);

  // Periodic sync to Supabase for authenticated users
  useEffect(() => {
    if (!wallet) {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      return;
    }

    async function syncToServer() {
      if (!wallet) return;
      const current = readLocalHistory();
      if (current.length === 0) return;

      const lastSynced = localStorage.getItem(LAST_SYNCED_KEY);
      const entriesToSync = lastSynced
        ? current.filter((e) => e.visitedAt > lastSynced)
        : current;

      if (entriesToSync.length === 0) return;

      try {
        const res = await fetch("/api/history/browsing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet, entries: entriesToSync }),
        });
        if (res.ok) {
          localStorage.setItem(LAST_SYNCED_KEY, new Date().toISOString());
        }
      } catch {
        // Silently fail — will retry next interval
      }
    }

    // Sync immediately on auth
    syncToServer();

    // Then periodically
    syncTimerRef.current = setInterval(syncToServer, SYNC_INTERVAL_MS);

    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [wallet]);

  return { entries, recordVisit, clearHistory };
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/hooks/useBrowsingHistory.ts
git commit -m "feat: add useBrowsingHistory hook with localStorage + periodic sync"
```

---

### Task 4: Create `POST /api/history/browsing` and `GET /api/history/browsing` API routes

**Files:**
- Create: `src/app/api/history/browsing/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const entrySchema = z.object({
  id: z.string(),
  type: z.enum(["token", "deployer", "reputation"]),
  subject: z.string().min(1).max(64),
  name: z.string().nullable(),
  symbol: z.string().nullable(),
  score: z.number().nullable(),
  tier: z.string().nullable(),
  visitedAt: z.string(),
});

const postSchema = z.object({
  wallet: z.string().min(32).max(44),
  entries: z.array(entrySchema).min(1).max(200),
});

const getSchema = z.object({
  wallet: z.string().min(32).max(44),
  type: z.enum(["token", "deployer", "reputation"]).optional(),
});

// ---------------------------------------------------------------------------
// POST — Sync local history entries to Supabase
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = postSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { wallet, entries } = parsed.data;
    const supabase = createServerSupabaseClient();

    // Upsert all entries (on conflict update visited_at, score, tier, name, symbol)
    const rows = entries.map((e) => ({
      wallet,
      type: e.type,
      subject: e.subject,
      name: e.name,
      symbol: e.symbol,
      score: e.score,
      tier: e.tier,
      visited_at: e.visitedAt,
    }));

    const { error } = await supabase
      .from("browsing_history")
      .upsert(rows, { onConflict: "wallet,type,subject" });

    if (error) {
      console.error("Browsing history sync error:", error);
      return NextResponse.json(
        { error: "Failed to sync history" },
        { status: 500 }
      );
    }

    return NextResponse.json({ synced: rows.length });
  } catch (error) {
    console.error("POST /api/history/browsing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET — Fetch browsing history from Supabase
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = getSchema.safeParse({
      wallet: searchParams.get("wallet"),
      type: searchParams.get("type") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { wallet, type } = parsed.data;
    const supabase = createServerSupabaseClient();

    let query = supabase
      .from("browsing_history")
      .select("*")
      .eq("wallet", wallet)
      .order("visited_at", { ascending: false })
      .limit(200);

    if (type) {
      query = query.eq("type", type);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Browsing history fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch history" },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("GET /api/history/browsing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/api/history/browsing/route.ts
git commit -m "feat: add browsing history API routes (GET + POST)"
```

---

### Task 5: Add `recordVisit` calls to Token, Deployer, and Reputation pages

**Files:**
- Modify: `src/app/token/[mint]/page.tsx`
- Modify: `src/app/deployer/[wallet]/page.tsx`
- Modify: `src/app/reputation/[wallet]/page.tsx`

**Step 1: Add to Token page**

In `src/app/token/[mint]/page.tsx`:

1. Add import at top:
```typescript
import { useBrowsingHistory } from "@/hooks/useBrowsingHistory";
```

2. Inside `TokenPage()`, after the `useHolders` call (around line 149), add:
```typescript
const { recordVisit } = useBrowsingHistory();
```

3. Add a useEffect that records the visit when data loads (after the existing hooks, before `return`). Import `useEffect` from React if not already imported:
```typescript
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
}, [data, loading]);
```

**Step 2: Add to Deployer page**

In `src/app/deployer/[wallet]/page.tsx`:

1. Add import at top:
```typescript
import { useBrowsingHistory } from "@/hooks/useBrowsingHistory";
```

2. Inside `DeployerPage()`, after the `useDeployerProfile` call (line 142), add:
```typescript
const { recordVisit } = useBrowsingHistory();
```

3. Add useEffect:
```typescript
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
}, [data, loading]);
```

Note: Import `useEffect` from React — check if it's already imported; the deployer page uses `useState` but may not import `useEffect`.

**Step 3: Add to Reputation page**

In `src/app/reputation/[wallet]/page.tsx`:

1. Add import at top:
```typescript
import { useBrowsingHistory } from "@/hooks/useBrowsingHistory";
```

2. Inside `ReputationPage()`, after the state declarations (around line 79), add:
```typescript
const { recordVisit } = useBrowsingHistory();
```

3. Add useEffect (after the existing `useEffect` that fetches data):
```typescript
useEffect(() => {
  if (data && !loading) {
    recordVisit({
      type: "reputation",
      subject: wallet,
      name: null,
      symbol: null,
      score: data.fairScore?.decimalScore ?? null,
      tier: data.fairScore?.tier ?? null,
    });
  }
}, [data, loading]);
```

**Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 5: Commit**

```bash
git add src/app/token/\[mint\]/page.tsx src/app/deployer/\[wallet\]/page.tsx src/app/reputation/\[wallet\]/page.tsx
git commit -m "feat: record browsing history visits on token, deployer, reputation pages"
```

---

### Task 6: Create the `/history` page

**Files:**
- Create: `src/app/history/page.tsx`

**Step 1: Create the History page component**

```typescript
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Clock, Coins, User, ShieldCheck, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import { useBrowsingHistory, type LocalHistoryEntry } from "@/hooks/useBrowsingHistory";
import type { BrowsingHistoryType, FairScoreTier } from "@/types/database";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_FILTERS: { value: BrowsingHistoryType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "token", label: "Tokens" },
  { value: "deployer", label: "Deployers" },
  { value: "reputation", label: "Wallets" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getTypeIcon(type: BrowsingHistoryType) {
  switch (type) {
    case "token":
      return Coins;
    case "deployer":
      return User;
    case "reputation":
      return ShieldCheck;
  }
}

function getTypeHref(type: BrowsingHistoryType, subject: string): string {
  switch (type) {
    case "token":
      return `/token/${subject}`;
    case "deployer":
      return `/deployer/${subject}`;
    case "reputation":
      return `/reputation/${subject}`;
  }
}

// ---------------------------------------------------------------------------
// History Entry Card
// ---------------------------------------------------------------------------

function HistoryEntryCard({ entry }: { entry: LocalHistoryEntry }) {
  const Icon = getTypeIcon(entry.type);
  const href = getTypeHref(entry.type, entry.subject);
  const tierColors = entry.tier ? getTierColor(entry.tier as FairScoreTier) : null;

  return (
    <Link href={href} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-3 py-3">
          {/* Type icon */}
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
            <Icon className="size-4 text-muted-foreground" />
          </div>

          {/* Name + Address */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {entry.name ?? truncateAddress(entry.subject)}
              {entry.symbol && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ${entry.symbol}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {truncateAddress(entry.subject)}
            </p>
          </div>

          {/* Score + Tier */}
          <div className="flex shrink-0 items-center gap-2">
            {entry.score !== null && (
              <span className="text-sm font-semibold text-foreground">
                {entry.type === "token"
                  ? entry.score.toFixed(0)
                  : entry.score.toFixed(1)}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                  /100
                </span>
              </span>
            )}
            {entry.tier && tierColors && (
              <Badge
                className={cn(
                  "border capitalize",
                  tierColors.bg,
                  tierColors.text,
                  tierColors.border
                )}
              >
                {entry.tier}
              </Badge>
            )}
          </div>

          {/* Timestamp */}
          <span className="shrink-0 text-xs text-muted-foreground">
            {relativeTime(entry.visitedAt)}
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// History Page
// ---------------------------------------------------------------------------

export default function HistoryPage() {
  const { entries, clearHistory } = useBrowsingHistory();
  const { data: session } = useSession();
  const [typeFilter, setTypeFilter] = useState<BrowsingHistoryType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let result = entries;

    if (typeFilter !== "all") {
      result = result.filter((e) => e.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          (e.name?.toLowerCase().includes(q)) ||
          (e.symbol?.toLowerCase().includes(q)) ||
          e.subject.toLowerCase().includes(q)
      );
    }

    return result;
  }, [entries, typeFilter, searchQuery]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Browsing History
          </h1>
          <p className="text-sm text-muted-foreground">
            {entries.length} {entries.length === 1 ? "page" : "pages"} visited
            {!session && " (stored locally)"}
          </p>
        </div>
        {entries.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearHistory}
            className="text-muted-foreground"
          >
            <Trash2 className="size-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Type pills */}
        <div className="flex gap-1">
          {TYPE_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              variant={typeFilter === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter(filter.value)}
              className="text-xs"
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, symbol, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Entry list */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-2">
          {filtered.map((entry) => (
            <HistoryEntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      ) : entries.length > 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No results match your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Clock className="size-10 text-muted-foreground/50" />
            <div>
              <p className="font-medium text-foreground">No history yet</p>
              <p className="text-sm text-muted-foreground">
                Start exploring tokens and wallets to build your history.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/search">Search Tokens</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/history/page.tsx
git commit -m "feat: add /history page with type filters and search"
```

---

### Task 7: Add History link to Header navigation

**Files:**
- Modify: `src/components/layout/Header.tsx`

**Step 1: Add Clock icon import**

In the Lucide import line (line 7), add `Clock`:

```typescript
import { Shield, Search, LayoutDashboard, LogOut, Scale, Sun, Moon, Clock } from "lucide-react";
```

**Step 2: Add History nav link for desktop**

In the `<nav>` element (around line 49), add the History button after the Compare button and before the Dashboard conditional (around line 61):

```typescript
<Button variant="ghost" size="sm" asChild>
  <Link href="/history">
    <Clock className="size-4" />
    History
  </Link>
</Button>
```

**Step 3: Add History nav link for mobile**

In the mobile nav `<div>` (around line 85), add after the Compare icon button and before the Dashboard conditional:

```typescript
<Button variant="ghost" size="icon" asChild>
  <Link href="/history" aria-label="History">
    <Clock className="size-4" />
  </Link>
</Button>
```

**Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 5: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: add History link to header navigation"
```

---

### Task 8: Build, push, and deploy

**Step 1: Build**

Run: `npm run build`
Expected: Build completes with no errors.

**Step 2: Push**

Run: `git push origin main`

**Step 3: Deploy**

Run: `vercel --prod --yes`
Expected: Deployment succeeds with production URL.

---

### Task 9 (Optional): Fetch server-side history on `/history` page for authenticated users

**Files:**
- Modify: `src/hooks/useBrowsingHistory.ts`
- Modify: `src/app/history/page.tsx`

**Step 1: Add server fetch to the hook**

In `useBrowsingHistory`, add a `fetchServerHistory` function that calls `GET /api/history/browsing?wallet=...` when authenticated and merges the results with localStorage entries (server entries as base, local entries override by type+subject). This is an enhancement — the localStorage-only version from Tasks 1-8 is fully functional.

**Step 2: On history page load, if authenticated, call the fetch and merge**

Add a `useEffect` in the history page that fetches server-side history when session is available and merges into `entries`.

This task is optional and can be implemented after the core feature ships.
