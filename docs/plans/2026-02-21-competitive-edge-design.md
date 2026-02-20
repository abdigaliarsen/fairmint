# TokenTrust Competitive Edge — Design Document

**Date:** 2026-02-21
**Deadline:** 2026-03-01 (FAIRathon)
**Goal:** Close the gaps identified in competitive analysis against RugCheck, BullX, GMGN, Birdeye, SolSniffer, Bubblemaps, GoPlus, DexTools, and DEXScreener.

---

## Competitive Analysis Summary

### Our Unique Moats (no competitor has these)

1. **Deployer reputation scoring** — only tool answering "has this deployer launched scams before?"
2. **Holder quality scoring** — FairScale reputation of a token's top holders
3. **Wallet trust passport** — shareable reputation profiles
4. **AI-powered plain-English summaries** — contextual narrative analysis
5. **Unified composite trust score** — 6-dimension weighted formula with transparent methodology

### Gaps to Close

| Gap | Competitors | Priority |
|---|---|---|
| Token discovery / trending feed | BullX (Pump Vision), GMGN, DEXScreener | **P0** |
| Deeper risk detection (15+ checks) | GoPlus (30+), SolSniffer (20+), RugCheck | **P0** |
| Smart money / whale tracking | GMGN, Nansen | **P1** |
| Holder clustering visualization | Bubblemaps | **P2** (existing graph covers basic case) |
| Trading integration | BullX, GMGN | **P3** (out of scope for FAIRathon) |

---

## Phase 1: Discovery & Trending Feed

### Problem

TokenTrust only analyzes tokens the user already knows about. BullX and GMGN dominate "find something new to buy." We need a discovery experience that combines their speed with our trust intelligence.

### Design

**New page:** `/discover` with three tabs:

#### Tab 1: Trending

- Tokens with the most lookups in the last 24h from our `token_analyses` table
- Sorted by a composite "trending score" = `lookup_count * 0.6 + trust_rating * 0.4`
- Shows: name, symbol, trust rating badge, deployer tier, 24h volume (from DexScreener), token age

**Data source:** New `trending_tokens` materialized view or query against `token_analyses` ordered by `analyzed_at` frequency in last 24h. We already re-analyze tokens on each visit, so popular tokens will have recent `analyzed_at` timestamps.

**Simpler approach:** Query `token_analyses` for tokens analyzed in the last 24h, group by mint, count analyses, sort by count. This avoids any new table.

#### Tab 2: New Launches

- Recently created tokens (< 48h old) that have been analyzed
- Pre-scored with trust rating and risk flags
- Sorted by trust rating descending (safest new tokens first)
- Badge: "Very New" (< 2 days), "New" (2-7 days)

**Data source:** Existing `token_analyses` table filtered by `analyzed_at` in last 48h where `token_age_days` (from metadata) is < 2. We need to store `token_age_days` in the `token_analyses` table (it's currently computed but not persisted).

**Enhancement:** Add a background job that fetches new token mints from Helius and pre-analyzes the top ones by holder count. This populates the "New Launches" tab even when users haven't searched for those tokens yet.

#### Tab 3: Top Trusted

- Highest-rated tokens sorted by `trust_rating` descending
- Only tokens analyzed in the last 7 days (freshness filter)
- Shows: full TokenCard with all badges

**Data source:** Simple query on `token_analyses` ordered by `trust_rating DESC` with recency filter.

### New Components

- `DiscoverPage` — page with tabs
- `TrendingTokenCard` — compact card with volume and trending indicators
- Reuse existing `TokenCard`, `TrustRating` badge, `AuthorityBadges`

### New API Route

- `GET /api/discover?tab=trending|new|trusted&limit=20` — returns sorted, enriched token list

### Database Changes

- Add `token_age_days` column to `token_analyses` table (nullable integer)
- Persist it during analysis (already computed in `tokenAnalyzer.ts` but not saved)

### Cron Enhancement

- Expand `refresh-tokens` cron to also fetch and analyze recently created tokens from Helius
- Use Helius `searchAssets` or `getAssetsByGroup` to find new fungible tokens

---

## Phase 2: Deeper Security Analysis

### Problem

We have 6 risk checks. GoPlus has 30+. SolSniffer has 20+. Our risk flags section looks thin compared to dedicated security tools.

### New Risk Checks to Add

Expanding from 6 to 15 checks. Grouped by data source:

#### From Existing Data (no new API calls)

7. **Creator still holds supply** — Check if deployer wallet is in the top holders list. Flag severity by percentage held.
8. **Supply concentration (top 5)** — Cumulative % of top 5 holders. > 80% = high risk.
9. **Supply concentration (top 10)** — Cumulative % of top 10 holders. > 90% = high risk.
10. **No DEX liquidity** — Flag if no LP vaults detected in holder analysis and no DexScreener data.
11. **Low liquidity** — Flag if total DEX liquidity < $1,000 USD.
12. **Single DEX** — Flag if liquidity exists on only one DEX (single point of failure).
13. **Metadata mutable** — Check if update authority is still active (can change token name/image).

#### From RugCheck Data (already fetched)

14. **RugCheck danger** — If RugCheck returns "Danger" risk level, surface as a high-severity flag.
15. **RugCheck warnings** — If RugCheck has 3+ risks, surface as medium-severity flag.

#### From New Helius Analysis

16. **Bundled buys at launch** — Check first N transactions of the token for multiple buys in the same block/slot. Indicates insider/sniper activity. Uses Helius transaction history for the token mint.

### Implementation

All checks go into `detectRiskFlags()` in `tokenAnalyzer.ts`. Most use data already available in the function's scope (holders, metadata, dexData, rugCheckResult). Only #16 requires a new API call.

For #16 (bundled buys), we'll add a lightweight function in `helius.ts` that fetches the first ~20 transactions for the token and checks for multiple buys in the same slot.

### Trust Rating Impact

More risk flags feed into the existing `computePatternComponent()` which already deducts points per flag severity. No formula changes needed — more flags naturally lower the trust rating for risky tokens.

---

## Phase 3: Smart Money / Top Wallets

### Problem

GMGN tracks "smart money" by PnL. Nansen labels wallets. Nobody ranks wallets by trust reputation. We have FairScale data that no competitor can access.

### Design

**New page:** `/wallets` — "Trusted Wallets" leaderboard

#### Leaderboard View

- Shows top wallets by FairScale score from our `cached_scores` table
- Columns: wallet (truncated), FairScale tier, score, wallet age, transaction count
- Click to go to `/reputation/[wallet]` for full profile
- Filter by tier (Gold, Platinum)

**Data source:** `cached_scores` table already has all scored wallets. Query for highest scores, enrich with feature data.

#### "Who Holds This Token" Enhancement

On the token page (`/token/[mint]`), enhance the Holder Quality section:
- Add a "Notable Holders" sub-section listing any Gold/Platinum holders by name (truncated address + tier badge)
- "X of Y top holders are Gold/Platinum rated" — already partially done in HolderGraph, make it more prominent

#### "What Are Trusted Wallets Buying?"

On the `/wallets` page, add a "Recent Activity" tab:
- For top 10 wallets by score, fetch their recent token holdings
- Show tokens that multiple high-reputation wallets hold
- This is a trust-filtered signal: "3 Platinum wallets hold this token"

**Data source:** For each top wallet, use Helius `getTokenAccounts` to find their token holdings. Cross-reference with `token_analyses` for trust data.

### New Components

- `WalletsPage` — leaderboard page
- `WalletLeaderboardRow` — compact row with tier badge and stats
- `NotableHolders` — sub-section on token page

### New API Routes

- `GET /api/wallets?sort=score&tier=gold,platinum&limit=20` — leaderboard data
- `GET /api/wallets/activity?limit=10` — recent activity of top wallets

### Caching

- Wallet leaderboard cached in Supabase for 1 hour
- Activity data cached for 30 minutes

---

## Architecture Notes

### No New External APIs

All three phases use data sources we already have:
- Helius (token metadata, holders, transactions)
- FairScale (wallet scores)
- DexScreener (volume, liquidity)
- RugCheck (risk assessment)
- Supabase (cached analyses)

### Performance Constraints

- FairScale: 1,000 req/month free tier — aggressive caching critical
- Helius: generous free tier but rate-limited — batch where possible
- DexScreener: no auth needed, 300 req/min
- All new queries should hit cached Supabase data first

### Mobile Responsiveness

All new pages must work on mobile (Tailwind responsive breakpoints, mobile-first design).

---

## Success Criteria

After implementation, TokenTrust should:

1. **Discovery**: Users can find new tokens without knowing addresses — closes the BullX/GMGN gap
2. **Security credibility**: 15 risk checks puts us on par with SolSniffer, ahead of RugCheck's basic flags
3. **Unique smart money angle**: Trust-ranked wallet leaderboard that no competitor offers
4. **Deeper FairScale integration**: Using FairScale for discovery (wallet leaderboard), analysis (holder quality), and trust scoring — maximizes FAIRathon judging criteria (30% weight on FairScore integration)
