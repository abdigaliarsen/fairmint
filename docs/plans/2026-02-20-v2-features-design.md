# TokenTrust V2 Features Design

Date: 2026-02-20
Status: Approved

## Context

TokenTrust MVP is deployed. The FAIRathon deadline is March 1, 2026. Judging criteria: FairScore Integration (30%), Technical Quality (25%), Traction (20%), Business Viability (15%), Team (10%). These 5 features maximize FairScale integration depth to differentiate from competitors like FairBounty.

## Approach: FairScale-Deep Integration

Every feature uses FairScore as a core mechanic, not just a display layer. Reputation gates access, weights decisions, and coaches improvement.

---

## Feature 1: Token Comparison

**Route:** `/compare`

**Description:** Side-by-side trust analysis of multiple tokens. Tier-gated: Unrated/Bronze see 2 slots, Silver gets 3, Gold/Platinum get 4.

**UX Flow:**
1. User navigates to Compare page (header nav link)
2. Empty slots with search to add tokens
3. Each slot shows: name, symbol, trust rating bar, deployer tier, holder quality, risk flag count
4. Visual diff highlights which token is stronger per category
5. "Winner" badge on highest trust rating

**FairScale usage:**
- User's own FairScore determines slot count (tier gating)
- Each token's deployer FairScore displayed and compared
- Holder quality scores compared

**New files:**
- `src/app/compare/page.tsx`
- `src/components/features/ComparisonSlot.tsx`
- `src/app/api/compare/route.ts`

---

## Feature 2: Wallet Reputation Page ("Trust Passport")

**Route:** `/reputation/[wallet]`

**Description:** Public shareable reputation profile for any Solana wallet. Designed to be shared on Twitter/Discord as a "trust passport."

**Content:**
- Large FairScore circle with tier badge
- Wallet address with copy button
- Badge collection from FairScale
- On-chain activity summary
- Score Improvement Recommendations (Feature 5)
- Shareable OG image (dynamic via Next.js opengraph-image.tsx)
- "Share your Trust Passport" button

**FairScale usage:** All 3 endpoints (`/score`, `/fairScore`, `/walletScore`) for the fullest possible profile.

**New files:**
- `src/app/reputation/[wallet]/page.tsx`
- `src/app/reputation/[wallet]/opengraph-image.tsx`
- `src/app/api/reputation/[wallet]/route.ts`

---

## Feature 3: Holder Network Graph

**Route:** Embedded on existing `/token/[mint]` page

**Description:** Simplified cluster visualization of top holders colored by FairScore tier.

**Visualization:**
- Central node = the token
- Surrounding nodes = top 10 holders
- Node color = FairScore tier (platinum/gold/silver/bronze/unrated)
- Node size = holding percentage
- Tier legend below

**FairScale usage:** Batch `/fairScore` calls for top 10 holders.

**New files:**
- `src/components/features/HolderGraph.tsx`
- Extend existing holders API to include FairScore data

---

## Feature 4: In-app Alerts

**Location:** Bell icon in header with dropdown notification panel

**Description:** Monitors watchlist tokens for trust score changes and new risk flags.

**How it works:**
- On dashboard visit, checks each watchlist token's current trust rating vs stored value
- Notification created if trust rating changed >5 points or new risk flags detected
- Stored in Supabase `notifications` table
- Bell icon shows unread count badge

**FairScale usage:** Periodic score comparisons surface reputation changes as actionable alerts.

**New files:**
- `src/components/features/NotificationBell.tsx`
- `src/app/api/notifications/route.ts`
- Supabase migration: `notifications` table

---

## Feature 5: Score Improvement Recommendations

**Location:** Wallet Reputation Page + Dashboard (for connected user)

**Description:** Analyzes wallet's FairScore and on-chain activity to generate actionable recommendations for improving reputation.

**Recommendation signals:**

| Signal | Check | Recommendation |
|--------|-------|---------------|
| Account age | Wallet creation date | "Your wallet is new -- keep building history" |
| DeFi activity | Transaction count/variety | "Interact with more DeFi protocols" |
| Holder quality | Holder FairScores | "Attract higher-reputation holders" |
| Distribution | Top holder concentration | "Improve token distribution" |
| Authorities | Mint/freeze authority flags | "Renounce mint authority to signal trust" |
| Social verification | FairScale badges | "Complete social verification on FairScale" |

**FairScale usage:** All 3 endpoints + score breakdown analysis. Deepest possible integration -- uses the scoring system as a coaching tool.

**New files:**
- `src/components/features/ScoreRecommendations.tsx`
- Logic in existing reputation API route

---

## Tier Gating Summary

| Feature | Unrated/Bronze | Silver | Gold/Platinum |
|---------|---------------|--------|--------------|
| Token Comparison | 2 slots | 3 slots | 4 slots |
| Reputation Page | View only | View + share | Full + OG image |
| Holder Graph | Top 5 holders | Top 10 holders | Top 10 + details |
| Alerts | 3 watchlist | 10 watchlist | Unlimited |
| Recommendations | Basic tips | Detailed tips | Full action plan |
