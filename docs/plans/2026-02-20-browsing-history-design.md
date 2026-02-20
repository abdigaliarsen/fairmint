# Browsing History Feature Design

## Goal

Track user browsing history across tokens, deployers, and reputation pages. Show a dedicated `/history` page with rich entries, filtering by type, and text search. Works for both anonymous (localStorage) and authenticated (Supabase-synced) users.

## Architecture

**Storage:** localStorage-first with periodic Supabase sync for authenticated users.

- All visits write to localStorage immediately (instant, works offline/anonymous).
- When authenticated, a periodic sync (every 60 seconds) upserts new entries to Supabase.
- On wallet connect, bulk-sync all localStorage entries to Supabase.
- On history page load when authenticated, server data is the merged source of truth.

## Data Model

### localStorage

Key: `tokentrust_history`
Value: JSON array of `HistoryEntry` objects, capped at 200 entries (FIFO eviction).

```typescript
interface HistoryEntry {
  id: string;                    // UUID
  type: "token" | "deployer" | "reputation";
  subject: string;               // mint or wallet address
  name: string | null;           // token name or null
  symbol: string | null;         // token symbol or null
  score: number | null;          // trust rating (tokens) or decimal FairScore (wallets)
  tier: FairScoreTier | null;    // deployer/wallet tier
  visitedAt: string;             // ISO 8601 timestamp
}
```

### Supabase table: `browsing_history`

| Column     | Type        | Notes                                    |
|------------|-------------|------------------------------------------|
| id         | uuid        | PK, gen_random_uuid()                    |
| wallet     | text        | Authenticated user's wallet address      |
| type       | text        | "token" / "deployer" / "reputation"      |
| subject    | text        | mint or wallet address visited           |
| name       | text        | nullable, display name                   |
| symbol     | text        | nullable, token symbol                   |
| score      | numeric     | nullable, latest score at visit time     |
| tier       | text        | nullable, FairScale tier                 |
| visited_at | timestamptz | When the page was visited                |
| created_at | timestamptz | Row creation time                        |

**Unique constraint:** `(wallet, type, subject)` — revisiting the same page updates `visited_at`, `score`, `tier`, and `name` rather than creating duplicates.

**RLS:** Users can only read/write their own rows (`wallet = auth.jwt()->>'wallet'`). Service role key used from API route for simplicity (matching existing patterns).

## Sync Strategy

1. **On page visit:** Write/update entry in localStorage immediately via `recordVisit()` helper.
2. **Periodic sync (60s interval):** If session is active, diff entries newer than `lastSyncedAt` timestamp and POST to `/api/history/browsing`.
3. **On wallet connect:** Bulk sync all localStorage entries to Supabase.
4. **History page (authenticated):** Fetch from Supabase (complete merged history), update localStorage cache.
5. **History page (anonymous):** Read directly from localStorage.

## API

### `POST /api/history/browsing`

Authenticated endpoint. Accepts array of history entries, upserts into `browsing_history` table.

### `GET /api/history/browsing`

Authenticated endpoint. Returns all history entries for the current user, ordered by `visited_at` DESC. Supports `?type=token` query param for filtering server-side.

## History Page (`/history`)

### Layout
- **Header:** "Browsing History" with entry count
- **Filter bar:** Type pill buttons (All | Tokens | Deployers | Wallets) + text search input
- **Entry list:** Scrollable list of rich history cards
- **Empty state:** Friendly message encouraging exploration

### History Entry Card (Rich)
- Left: Type icon (Coins for tokens, User for deployers, Shield for reputation)
- Center: Name/symbol, truncated address, tier badge
- Right: Score with `/100`, score change indicator (green up / red down arrow + delta), mini sparkline (last 7 data points from existing score history tables)
- Bottom-right: Relative timestamp ("2h ago", "yesterday")

### Navigation
- History icon (Clock) added to Header nav, visible for all users (authenticated and anonymous when localStorage has entries)
- Route: `/history`

## Tech Stack
- localStorage API for client-side storage
- Supabase for server-side persistence
- Recharts (already used) for mini sparklines
- `date-fns` or `Intl.RelativeTimeFormat` for relative timestamps
- Zod for API validation
- React hooks (`useBrowsingHistory`) for state management
