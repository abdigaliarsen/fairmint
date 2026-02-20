# Polish & High-Impact Details Design

## Goal

Add 12 small details that create outsized impact on trust, credibility, and user delight. Grouped into 5 sections: micro-interactions, trust transparency, token intelligence, deployer intelligence, and shareable OG images.

## Architecture

All items are additive — no existing behavior changes. New services (Jupiter, RugCheck) follow the same pattern as DexScreener (fetch + cache + silent fallback). UI changes are component-level with no routing changes.

## Items

### Section 1: Micro-Interactions & UX Polish

**1. Score Count-Up Animation**
- `AnimatedScore` wrapper component using `requestAnimationFrame`
- Counts from 0 to target over 500ms with ease-out
- FairScoreDisplay SVG ring fills via CSS transition on `stroke-dashoffset`
- Tier color transitions from gray to final tier color
- Applied on token trust rating, deployer/reputation FairScore

**5. Data Source Attribution**
- Small `text-[10px] text-muted-foreground/60` labels next to data
- Trust Rating: "Powered by FairScale + Helius"
- Liquidity: "via DexScreener"
- Holders: "via Helius"

**6. Multi-Step Analysis Progress**
- New `AnalysisProgress` component replaces `TokenPageSkeleton`
- Steps: "Fetching metadata" → "Checking deployer" → "Analyzing holders" → "Computing trust score"
- Timed 400ms intervals with spinner → checkmark per step
- Final step fades into real content

### Section 2: Trust Transparency

**2. Scoring Methodology Explainer**
- `ScoringMethodology` collapsible component
- "How is this calculated?" link below Trust Rating and FairScore
- Expands to show weight bars: Deployer 15%, Holder Quality 25%, Distribution 20%, Age 10%, Safety 20%, Liquidity 10%
- One-line description per factor

**3. Token Authority Status Badges**
- Fetch from Helius DAS `getAsset` API (mint authority, freeze authority, update authority)
- 3 small badges below token header: green checkmark "Renounced" / red warning "Active"
- Also inject as risk flags in tokenAnalyzer if authorities are still active

**4. Jupiter Verified Badge**
- New service `src/services/jupiter.ts`
- Fetches `https://lite-api.jup.ag/tokens/v1` (full verified list), cached 1 hour
- Blue checkmark "Jupiter Verified" badge next to token name
- Absent if not verified (not punitive)

### Section 3: Enhanced Token Intelligence

**10. Token Age + First Trade**
- Use Helius to find token creation timestamp
- Display "Token Age: X days" in token header
- <7 days: yellow "New Token" badge
- <48 hours: red "Very New" badge
- Factor real creation date into tokenAnalyzer age component

**11. RugCheck Integration**
- New service `src/services/rugcheck.ts`
- Calls `GET https://api.rugcheck.xyz/v1/tokens/{mint}/report/summary`
- Returns risk level: Good/Warning/Danger
- "Second Opinion" badge on token page with RugCheck attribution
- Cache in Supabase `rugcheck_cache` table (1-hour TTL)

### Section 4: Deployer Intelligence

**8. Deployer Risk Timeline**
- Horizontal timeline on deployer page above "Deployed Tokens"
- Shows: first deployment, total deployed, latest deployment, tokens with trust rating <20 (potential rugs)
- Calculated from existing `deployedTokens` data — no new API calls

**9. Smart Money Indicator**
- Brain/star icon next to Gold/Platinum holders in HolderGraph
- Stat line: "X of 10 top holders are high-reputation wallets"
- Uses existing holder FairScore data

**12. Wallet Relationship Flags**
- In `analyzeHolders()`, check top holder pairs for direct SOL transfers
- Uses Helius `getSignaturesForAddress` (limited recent txns)
- New risk flag: "Connected Wallets: X of top holders share transfer history"
- Catches basic Sybil attacks

### Section 5: Token OG Image

**7. Shareable Trust Score Cards**
- `src/app/token/[mint]/opengraph-image.tsx`
- Dynamic OG image via `ImageResponse` (1200x630)
- Shows: token name, symbol, trust rating arc, deployer tier, top risk flag
- "Analyzed by TokenTrust" branding
- Same pattern as existing `/reputation/[wallet]/opengraph-image.tsx`

## New Services

| Service | API | Cost | Rate Limit | Cache TTL |
|---------|-----|------|------------|-----------|
| Jupiter | `lite-api.jup.ag/tokens/v1` | Free | Generous | 1 hour |
| RugCheck | `api.rugcheck.xyz/v1/tokens/{mint}/report/summary` | Free | Unknown | 1 hour |

## New Supabase Table

`rugcheck_cache`: mint (text, UNIQUE), data (jsonb), fetched_at (timestamptz)

## Files Created

- `src/components/features/AnimatedScore.tsx`
- `src/components/features/AnalysisProgress.tsx`
- `src/components/features/ScoringMethodology.tsx`
- `src/components/features/AuthorityBadges.tsx`
- `src/components/features/DeployerTimeline.tsx`
- `src/services/jupiter.ts`
- `src/services/rugcheck.ts`
- `src/app/token/[mint]/opengraph-image.tsx`

## Files Modified

- `src/components/features/FairScoreDisplay.tsx` (add animation support)
- `src/components/features/TrustRating.tsx` (add animation + attribution)
- `src/components/features/HolderGraph.tsx` (smart money indicators)
- `src/components/features/LiquidityCard.tsx` (data attribution)
- `src/app/token/[mint]/page.tsx` (authority badges, Jupiter badge, token age, RugCheck, progress, explainer)
- `src/app/deployer/[wallet]/page.tsx` (timeline, attribution)
- `src/services/tokenAnalyzer.ts` (authority risk flags, wallet relationship check, real token age)
- `src/services/helius.ts` (getAsset for authorities, token creation date, relationship detection)
