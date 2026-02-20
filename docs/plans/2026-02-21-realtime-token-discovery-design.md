# Real-Time Token Discovery — Design Document

**Date:** 2026-02-21
**Status:** Approved

## Problem

The "New Launches" tab on `/discover` fetches from Jupiter and DexScreener APIs on each request, but tokens appear with up to 5 minutes of delay due to in-memory caching, and there is no live update mechanism. Users must refresh the page to see new tokens.

## Goals

1. Show new Solana tokens within seconds of on-chain creation
2. Curated feed: Jupiter-verified, DexScreener-listed, and Pump.fun graduated tokens only
3. Real-time frontend updates via Supabase Realtime (websocket)
4. Lightweight ingestion with gradual enrichment (full trust analysis runs async)

## Non-Goals

- Raw firehose of all Solana mints (too noisy)
- Full trust analysis at ingestion time (too slow, rate limits)
- Mobile push notifications (future work)

---

## Architecture

### Data Flow

```
Helius Webhook ──► POST /api/ingest/new-tokens ──► new_token_events (Supabase)
                          ▲                                  │
Jupiter polling ──────────┘                                  │ Supabase Realtime
DexScreener polling ──────┘                                  │ (websocket)
                                                             ▼
Cron (enrichment) ──► analyzeToken() ──► UPDATE          useNewTokenFeed()
                      on unanalyzed rows                  (React hook)
```

### Ingestion Layer

Three curated sources feed a single `new_token_events` table:

**1. Helius Webhook (real-time, seconds)**
- Registered programmatically via `helius-sdk` WebhookClient
- Listens for `TOKEN_MINT` on Metaplex Token Metadata Program (`metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`)
- Posts enhanced transaction payloads to `POST /api/ingest/new-tokens`
- Pump.fun graduated tokens detected by checking if transaction involves program `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` with a graduation/migration instruction
- Secured with auth header verification

**2. Jupiter v2 API (polled, every 20 min via cron)**
- Existing `fetchRecentTokens()` function
- Catches Jupiter-verified tokens the webhook may not tag
- Source: `"jupiter"`

**3. DexScreener Latest Profiles (polled, every 20 min via cron)**
- Existing `fetchLatestProfiles()` function
- Catches tokens listed on DexScreener
- Source: `"dexscreener"`

### Ingestion Endpoint: `POST /api/ingest/new-tokens`

- Accepts webhook payloads and internal calls from cron
- Deduplicates by mint address (UPSERT on mint)
- For webhook-sourced tokens: extracts mint from `transferTokens[0].mint`
- Fetches basic metadata via `Helius.getAsset()` (name, symbol, image)
- Tags source: `"jupiter"` | `"dexscreener"` | `"pumpfun_graduated"` | `"helius_webhook"`
- Writes to `new_token_events` table
- Secured: webhook requests verified by auth header, cron requests by CRON_SECRET

### Database Schema

**New table: `new_token_events`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default `gen_random_uuid()` |
| mint | text | UNIQUE constraint |
| name | text | From Helius getAsset |
| symbol | text | From Helius getAsset |
| image_url | text | From Helius getAsset |
| source | text | `"jupiter"`, `"dexscreener"`, `"pumpfun_graduated"`, `"helius_webhook"` |
| metadata | jsonb | Raw webhook payload / API response |
| analyzed | boolean | Default `false`, set `true` after full analysis |
| trust_rating | integer | Default 0, populated after analysis |
| deployer_tier | text | Populated after analysis |
| created_at | timestamptz | Default `now()` |

**Supabase Realtime enabled** on this table for INSERT and UPDATE events.

**Retention:** rows older than 7 days with `analyzed = true` are candidates for cleanup (their data lives in `token_analyses`).

### Webhook Registration

One-time setup via a management script or API route:

```typescript
const helius = getHelius();
await helius.webhooks.create({
  webhookURL: `${process.env.NEXTAUTH_URL}/api/ingest/new-tokens`,
  transactionTypes: ["TOKEN_MINT"],
  accountAddresses: ["metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"],
  webhookType: "enhanced",
});
```

### Enrichment Flow

The existing cron job (`/api/cron/refresh-tokens`) is extended:
- **Phase 2 (existing):** seed 5 unanalyzed tokens from Jupiter
- **Phase 3 (new):** query `new_token_events` where `analyzed = false`, run `analyzeToken()` on up to 5, UPDATE the row with `trust_rating`, `deployer_tier`, and `analyzed = true`
- Also upserts into `token_analyses` for full data persistence

### Frontend

**New hook: `useNewTokenFeed()`**
1. On mount: fetches last 20 tokens from `/api/discover?tab=new` (reads from `new_token_events`)
2. Subscribes to Supabase Realtime INSERT + UPDATE on `new_token_events`
3. INSERTs prepend new tokens to the list
4. UPDATEs update existing tokens in-place (e.g., NEW badge → trust score)

**Updated `DiscoverTokenCard` component:**
- Source badge: small tag showing "jupiter", "dexscreener", "pumpfun"
- Relative time: "just now", "2m ago" instead of "Xd old" for new tokens
- Entry animation: new tokens slide in with brief highlight
- NEW badge → trust score circle: seamless transition on Realtime UPDATE

**"N new tokens" banner:**
- Appears when new tokens arrive while user has scrolled down
- Click scrolls to top and reveals new tokens

**Updated `/api/discover?tab=new` route:**
- Reads from `new_token_events` instead of querying `token_analyses`
- Returns mix of analyzed and unanalyzed tokens
- Sorted: analyzed first (by trust_rating), then unanalyzed (by created_at desc)

---

## Files to Create/Modify

### New Files
- `src/app/api/ingest/new-tokens/route.ts` — webhook + internal ingestion endpoint
- `src/hooks/useNewTokenFeed.ts` — Supabase Realtime subscription hook
- `src/scripts/register-webhook.ts` — one-time Helius webhook setup script

### Modified Files
- `src/services/helius.ts` — expose webhook client getter
- `src/app/api/discover/route.ts` — `tab=new` reads from `new_token_events`
- `src/app/api/cron/refresh-tokens/route.ts` — add Phase 3 for enriching `new_token_events`
- `src/app/discover/page.tsx` — source badges, relative time, entry animation, new tokens banner
- `src/hooks/useDiscover.ts` — add source field to `DiscoverToken`
- `src/types/database.ts` — add `NewTokenEvent` type and table mapping

### Database Migration
- Create `new_token_events` table with Supabase migration
- Enable Realtime on `new_token_events`

---

## Security

- Webhook endpoint verifies Helius auth header
- No API keys exposed client-side (Supabase Realtime uses anon key with RLS)
- RLS policy on `new_token_events`: read-only for anon, write via service role only
- Mint addresses validated with Zod before processing

## Performance

- Webhook ingestion: 1 Helius getAsset call per token (lightweight)
- Full analysis deferred to cron (5 tokens per 20-min run)
- Supabase Realtime: single websocket connection, no polling
- 7-day retention on `new_token_events` prevents table bloat

## Rate Limits

- Helius webhooks: 1 credit per event (within existing plan)
- Helius getAsset: 1 call per ingested token
- FairScale: only consumed during cron enrichment, not ingestion
- Jupiter/DexScreener: unchanged (polled every 20 min)

---

## Sources

- [Helius Webhooks Documentation](https://www.helius.dev/docs/webhooks)
- [How to Fetch Newly Minted Tokens with Helius](https://www.helius.dev/blog/how-to-fetch-newly-minted-tokens-with-helius)
- [Helius gRPC Streaming](https://www.helius.dev/docs/grpc)
- [Pump.fun API & Graduated Tokens](https://docs.moralis.com/web3-data-api/solana/tutorials/get-graduated-pump-fun-tokens)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
