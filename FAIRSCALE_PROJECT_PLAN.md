# FairScale FAIRathon - Complete Project Plan & Research

## Table of Contents
1. [Bounty Overview](#bounty-overview)
2. [FairScale API Complete Reference](#fairscale-api-complete-reference)
3. [Competitive Landscape](#competitive-landscape)
4. [Project Idea: TokenTrust - Reputation-Powered Token Intelligence](#project-idea)
5. [Architecture & Tech Stack](#architecture--tech-stack)
6. [Component Breakdown](#component-breakdown)
7. [FairScore Integration Plan](#fairscore-integration-plan)
8. [Helius Integration Plan](#helius-integration-plan)
9. [Database Schema](#database-schema)
10. [Step-by-Step Build Order](#step-by-step-build-order)
11. [Business Model & Traction Strategy](#business-model--traction-strategy)
12. [Submission Checklist](#submission-checklist)
13. [Key Resources & Links](#key-resources--links)

---

## Bounty Overview

- **Prize:** 5,000 USDC (winner via futarchy market - FAIR token holders vote)
- **Deadline:** March 1, 2026
- **Winner Announcement:** March 15, 2026
- **Current Submissions:** 12 (as of Feb 2026)
- **Top 3 bonus:** 3 months free Pro API access (~$500/month)
- **Top 10 on Legends.fun:** DePitch Academy Pass + 50% Pro discount

### Judging Criteria
| Criteria | Weight | What They Want |
|----------|--------|----------------|
| FairScore Integration | 30% | Core to product logic, not decorative |
| Technical Quality | 25% | Production-ready, functional, well-coded |
| Traction & Users | 20% | Active marketing, real user engagement |
| Business Viability | 15% | Clear revenue model, go-to-market strategy |
| Team & Commitment | 10% | Fast iteration, regular updates |

### Required Submissions
1. Live platform URL (mainnet)
2. GitHub repo (pushed to FairScale's GitHub org) with clear README
3. Demo video (max 5 min, YouTube/Loom)
4. Pitch slides
5. Evidence of traction (X/Twitter account, tweets, user count, analytics)
6. Team info (names, roles, contact, experience)
7. Legends.fun product page URL (use invite code: FAIRAT)

---

## FairScale API Complete Reference

### Base Info
- **Base URL:** `https://api.fairscale.xyz`
- **Auth:** API key via `fairkey` header
- **Blockchain:** Solana ONLY
- **Get API key:** https://sales.fairscale.xyz
- **No official SDK** - use standard HTTP fetch
- **All endpoints are GET requests**

### Endpoint 1: `/score` (Full Score + Details)
```
GET https://api.fairscale.xyz/score?wallet=WALLET_ADDRESS
Header: fairkey: YOUR_API_KEY
```
**Response:**
```json
{
  "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "fairscore_base": 58.1,
  "social_score": 36.0,
  "fairscore": 65.3,
  "tier": "gold",
  "badges": [
    {
      "id": "diamond_hands",
      "label": "Diamond Hands",
      "description": "Long-term holder with conviction",
      "tier": "platinum"
    }
  ],
  "actions": [],
  "timestamp": "2026-01-21T13:13:53.608725Z",
  "features": {
    "lst_percentile_score": 0.75,
    "major_percentile_score": 0.82,
    "native_sol_percentile": 0.68,
    "stable_percentile_score": 0.45,
    "tx_count": 1250,
    "active_days": 180,
    "median_gap_hours": 12.5,
    "wallet_age_days": 365
  }
}
```

**Key fields:**
- `fairscore_base` (number) - Base score without social factors
- `social_score` (number) - Social reputation score
- `fairscore` (number) - Combined score (wallet + social)
- `tier` (string) - `bronze` | `silver` | `gold` | `platinum`
- `badges` (array) - Earned achievement badges
- `features` (object) - 15+ detailed metrics about the wallet

### Endpoint 2: `/fairScore` (Score Only - Lightweight)
```
GET https://api.fairscale.xyz/fairScore?wallet=WALLET_ADDRESS
Header: fairkey: YOUR_API_KEY
```
**Response:**
```json
{
  "fair_score": 272
}
```
NOTE: This returns an INTEGER score (different scale from /score endpoint decimals)

### Endpoint 3: `/walletScore` (Wallet-Only Score - No Social)
```
GET https://api.fairscale.xyz/walletScore?wallet=WALLET_ADDRESS
Header: fairkey: YOUR_API_KEY
```
**Response:**
```json
{
  "wallet_score": 134
}
```

### Rate Limits
| Tier | Rate Limit | Monthly Requests | Price |
|------|-----------|-----------------|-------|
| Free | 10 req/min | 1,000/month | $0 |
| Builder | 100 req/min | 20,000/month | $100/mo |
| Scale | 300 req/min | 50,000/month | $250/mo |
| Pro | 600 req/min | 100,000/month | $500/mo |
| Enterprise | 10+ req/sec | 100,000+ | Custom |

### Error Responses
- `401`: `{"message": "No API key found in request"}`
- `429`: `{"message": "Rate limit exceeded"}`
- `404`: New/unknown wallet (handle gracefully, default to score 0)

### Security Best Practices
- Store API key in env vars (NEVER client-side)
- Proxy through backend API route
- HTTPS only
- Implement caching to reduce API calls
- Use `/fairScore` or `/walletScore` for lightweight checks

### Integration Code (Next.js API Route Proxy)
```typescript
// src/app/api/fairscore/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  if (!wallet) {
    return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.fairscale.xyz/score?wallet=${wallet}`,
      { headers: { fairkey: process.env.FAIRSCALE_API_KEY! } }
    );
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch score' }, { status: 500 });
  }
}
```

### React Hook
```typescript
// src/hooks/useFairScore.ts
import { useState, useEffect } from 'react';

interface FairScoreData {
  wallet: string;
  fairscore_base: number;
  social_score: number;
  fairscore: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  badges: Array<{ id: string; label: string; description: string; tier: string }>;
  features: Record<string, number>;
  timestamp: string;
}

export function useFairScore(wallet: string | null) {
  const [data, setData] = useState<FairScoreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!wallet) return;
    setLoading(true);
    fetch(`/api/fairscore?wallet=${wallet}`)
      .then(res => res.json())
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [wallet]);

  return { data, loading, error };
}
```

---

## Competitive Landscape

### Existing FairScale Projects (Competitors)

#### 1. FairScoreGate
- **What:** Content gating by FairScore tier
- **Stack:** Next.js 16, Tailwind CSS v4, Solana Wallet Adapter
- **Integration:** Proxies FairScale API through Next.js route, gates content by tier
- **Tiers:** Bronze (0+), Silver (300+), Gold (600+), Platinum (850+)
- **Live at:** fair-score-gate.vercel.app
- **Weakness:** Very simple - just shows/hides content. No real business use case. No database. Demo-quality.
- **GitHub:** https://github.com/Iktiarshovo/FairScoreGate

#### 2. FairBounty
- **What:** Reputation-gated bounty board
- **Integration:** Higher FairScore = bigger bounties, weighted votes, bonus rewards
- **Live at:** fairbounty.vercel.app
- **Weakness:** Limited information, appears basic

#### 3. TrustChain
- **What:** Trust-aware DEX on Solana (reputation + integrity layer)
- **Integration:** Daily claims, verifiable trust scores for DeFi interactions
- **Applied for:** Solana Foundation $30k grant
- **GitHub:** https://github.com/Freedomwithin/TrustChain

### What's Missing (Our Opportunity)
- None of these solve a **high-frequency, urgent user need**
- None have **real revenue models**
- None use **Helius for rich on-chain data**
- None combine reputation with **token/market intelligence**
- The biggest pain point in Solana: **rug pulls and scam tokens** - nobody addresses this with FairScale

### Broader Reputation Ecosystem (Not FairScale-specific)
- **Cred Protocol** - On-chain credit risk scoring (multi-chain)
- **Spectral** - MACRO score (300-850, like FICO for crypto)
- **Providence** (Andre Cronje) - 60B+ transactions analyzed
- **Gitcoin Passport** - Sybil resistance / identity verification

---

## Project Idea

### TokenTrust - Reputation-Powered Token Intelligence for Solana

**One-liner:** TokenTrust uses FairScale reputation data to help Solana traders identify trustworthy tokens and avoid scams, with premium features gated by the user's own FairScore.

### The Problem
- Solana has thousands of new tokens launched daily (especially memecoins)
- Rug pulls and scam tokens cost traders millions
- No easy way to check if a token deployer is trustworthy
- No way to see if a token's holders are real users or sybil accounts
- Existing tools (Rugcheck, BirdEye) don't use reputation scoring

### The Solution
TokenTrust is a token intelligence platform that:
1. **Scores token deployers** - Fetches the deployer wallet's FairScore to assess trustworthiness
2. **Analyzes holder quality** - Aggregates FairScores of top holders to detect sybil/bot wallets
3. **Provides trust ratings** for tokens based on deployer rep + holder quality + on-chain metrics
4. **Gates premium features** by the user's own FairScore tier:
   - Bronze: Basic token lookup
   - Silver: Real-time alerts for new high-trust tokens
   - Gold: Deep holder analysis, historical deployer data
   - Platinum: API access, custom alerts, whale tracking
5. **Uses Helius** for real-time token data, transaction history, and deployer analysis

### Why This Wins
- **FairScore Integration (30%):** FairScore is THE core mechanism - scoring deployers, analyzing holders, AND gating features. Triple integration.
- **Technical Quality (25%):** Full-stack production app with Helius real-time data, caching, database.
- **Traction (20%):** Every Solana trader needs this. Easy to market on CT (Crypto Twitter).
- **Business Viability (15%):** Freemium model. Free tier attracts users, premium tiers for serious traders.
- **Solves a REAL problem:** Rug pulls are Solana's biggest reputation issue.

### Target Audience
- Solana memecoin traders
- DeFi users evaluating new tokens
- Token launch platforms wanting to verify deployers
- DAOs evaluating token allocations

---

## Architecture & Tech Stack

### Tech Stack Decision

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Next.js 14+ (App Router) | Industry standard for Solana dApps, SSR for SEO |
| **Language** | TypeScript | Type safety, better DX |
| **Styling** | Tailwind CSS + shadcn/ui | Fast development, professional look |
| **Wallet** | @solana/wallet-adapter-react | Standard Solana wallet connection |
| **RPC/Data** | Helius SDK | Enhanced APIs, transaction history, DAS API |
| **Reputation** | FairScale API | Core integration (proxied through backend) |
| **Database** | PostgreSQL (via Prisma or Drizzle) | Store cached scores, token data, user preferences |
| **Cache** | Redis (Upstash) or in-memory | Cache FairScale responses (rate limit management) |
| **Auth** | NextAuth.js + Wallet Signature | Web3-native authentication |
| **Deployment** | Vercel | Easy, fast, free tier available |
| **Analytics** | PostHog or Plausible | Track usage for traction evidence |

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                       │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Token   │  │ Deployer │  │ User     │  │ Real-time    │  │
│  │ Search  │  │ Profile  │  │ Dashboard│  │ Alerts       │  │
│  └────┬────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │            │             │                │           │
│  ┌────▼────────────▼─────────────▼────────────────▼───────┐  │
│  │            Wallet Adapter (Phantom, etc.)               │  │
│  └────────────────────────┬───────────────────────────────┘  │
└───────────────────────────┼──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                   BACKEND (Next.js API Routes)                │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ /api/token   │  │ /api/score   │  │ /api/alerts        │  │
│  │  - lookup    │  │  - fairscore │  │  - subscribe       │  │
│  │  - analyze   │  │  - deployer  │  │  - manage          │  │
│  │  - trending  │  │  - holders   │  │  - notifications   │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬───────────┘  │
│         │                │                     │              │
│  ┌──────▼────────────────▼─────────────────────▼───────────┐ │
│  │                   Service Layer                          │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │ │
│  │  │ Helius      │  │ FairScale    │  │ Token         │  │ │
│  │  │ Service     │  │ Service      │  │ Analyzer      │  │ │
│  │  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │ │
│  └─────────┼───────────────┼────────────────────┼──────────┘ │
└────────────┼───────────────┼────────────────────┼────────────┘
             │               │                    │
    ┌────────▼───┐  ┌───────▼──────┐  ┌──────────▼──────────┐
    │  Helius    │  │  FairScale   │  │  PostgreSQL +       │
    │  RPC/API   │  │  API         │  │  Redis Cache        │
    └────────────┘  └──────────────┘  └─────────────────────┘
```

---

## Component Breakdown

### 1. Frontend Pages

#### Landing Page (`/`)
- Hero section explaining what TokenTrust does
- "Check any token" search bar
- Recent high-trust token launches
- Connect wallet CTA

#### Token Lookup Page (`/token/[mint]`)
- Token basic info (name, symbol, supply, price from Helius)
- **Deployer FairScore** card (the deployer wallet's reputation)
- **Holder Quality Score** (average FairScore of top 20 holders)
- **Trust Rating** (composite: deployer rep + holder quality + on-chain signals)
- Transaction history highlights
- Risk flags (concentrated holdings, fresh deployer wallet, etc.)
- Feature gating based on user's tier

#### Deployer Profile (`/deployer/[wallet]`)
- FairScore breakdown (base, social, combined)
- Badges earned
- Features breakdown (tx_count, active_days, wallet_age, etc.)
- All tokens deployed by this wallet
- Historical trust track record

#### User Dashboard (`/dashboard`)
- User's own FairScore display
- Current tier and benefits
- Watchlist of tokens
- Alert settings (gated by tier)
- Score history / progress

#### Trending / Discovery (`/trending`)
- Highest trust new tokens (last 24h, 7d)
- Top-rated deployers
- Leaderboard of most-trusted tokens
- Filter by minimum deployer FairScore

#### Alerts Page (`/alerts`) [Silver+ tier]
- Configure alerts for new token launches by deployers with min FairScore
- Real-time notifications when high-trust deployers launch
- Rug pull warning alerts

### 2. Backend API Routes

```
/api/fairscore?wallet=X          → Proxy to FairScale /score endpoint (cached)
/api/fairscore/quick?wallet=X    → Proxy to FairScale /fairScore (lightweight)
/api/token/[mint]                → Get token data via Helius + deployer FairScore
/api/token/[mint]/holders        → Get top holders + their FairScores
/api/deployer/[wallet]           → Get deployer profile + all their tokens
/api/trending                    → Get trending high-trust tokens
/api/alerts                      → CRUD for user alerts (auth required)
/api/auth/[...nextauth]          → Wallet-based authentication
```

### 3. Services

#### FairScale Service (`src/services/fairscale.ts`)
- Wrapper around FairScale API
- Caching layer (Redis/memory) - cache scores for 1 hour
- Rate limit tracking
- Batch processing helper (queue multiple wallet lookups)
- Tier classification helper

#### Helius Service (`src/services/helius.ts`)
- Token metadata lookup (DAS API)
- Transaction history for wallets
- Token holder lists
- Real-time token data
- Deployer wallet identification from token mint

#### Token Analyzer (`src/services/tokenAnalyzer.ts`)
- Combines Helius data + FairScale scores
- Calculates composite Trust Rating:
  - Deployer FairScore (40% weight)
  - Holder Quality Score (25% weight)
  - Token age (10% weight)
  - Holder distribution / concentration (15% weight)
  - Transaction patterns (10% weight)
- Risk flag detection

#### Cache Service (`src/services/cache.ts`)
- Redis or in-memory caching
- TTL-based expiration
- FairScale score caching (critical for rate limits)
- Token data caching

---

## FairScore Integration Plan

### Integration Points (Critical for 30% of judging)

#### 1. Deployer Reputation Assessment (Core Feature)
- For every token lookup, fetch the deployer's wallet FairScore
- Display full breakdown: base score, social score, combined, tier, badges
- Show features (wallet age, tx count, active days) as trust signals
- **This is the PRIMARY value proposition**

#### 2. Holder Quality Analysis (Advanced Feature)
- For a given token, fetch top 20-50 holders via Helius
- Batch-fetch FairScores for each holder wallet
- Calculate average/median holder FairScore
- Detect clusters of low-score (potential sybil) wallets
- Higher holder quality = more trustworthy token

#### 3. User Tier Gating (Access Control)
- User connects wallet → fetch their FairScore
- Gate features based on tier:
  | Tier | Features |
  |------|----------|
  | No wallet | Basic token search only |
  | Bronze (0+) | Token lookup with deployer score |
  | Silver (300+) | + Holder analysis, basic alerts |
  | Gold (600+) | + Deep analytics, trending feed, advanced alerts |
  | Platinum (850+) | + API access, whale tracking, unlimited lookups |

#### 4. Trust Score Calculation (Core Algorithm)
- Composite score using FairScale data as primary input
- Weight deployer reputation heavily
- Factor in holder quality
- Create a simple 0-100 "Trust Score" that's easy to understand

#### 5. Dynamic Rewards (Engagement)
- Higher FairScore users get more daily free lookups
- Platinum users can submit community reviews
- Gold+ users can flag suspicious tokens

### How to Explain Integration to Judges
- "FairScore is the engine that powers our trust analysis"
- "Without FairScore, TokenTrust cannot assess deployer credibility"
- "We use ALL three endpoints for different purposes: /score for full profiles, /fairScore for quick checks in batch operations, /walletScore for holder-only analysis"
- "Feature gating by FairScore creates a self-reinforcing loop: trusted users get better tools"

---

## Helius Integration Plan

### Why Helius
- Best Solana RPC provider with enhanced APIs
- DAS API for token/NFT metadata
- Transaction history API (getTransactionsForAddress)
- Fast, reliable, free tier available (1M credits)
- Official SDK: `helius-sdk`

### Helius Endpoints We Need

#### 1. Get Token Metadata (DAS API)
```typescript
// Get token info (name, symbol, supply, image, etc.)
const response = await helius.rpc.getAsset({ id: mintAddress });
```

#### 2. Get Token Holders
```typescript
// Get all holders of a token
const response = await helius.rpc.getAssetsByOwner({
  ownerAddress: walletAddress,
  page: 1,
});
// Or use getTokenAccounts for SPL tokens
```

#### 3. Get Transaction History
```typescript
// Get transaction history for a wallet (deployer)
const response = await fetch(
  `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${HELIUS_KEY}`
);
```

#### 4. Get Parsed Transactions (Enhanced)
```typescript
// Human-readable transaction data
const response = await fetch(
  `https://api.helius.xyz/v0/transactions/?api-key=${HELIUS_KEY}`,
  {
    method: 'POST',
    body: JSON.stringify({ transactions: [txSignature] })
  }
);
```

### Helius Setup
```bash
npm install helius-sdk
```
```typescript
import { Helius } from 'helius-sdk';
const helius = new Helius(process.env.HELIUS_API_KEY!);
```

### Free Tier: 1,000,000 credits (no credit card needed)
Get key at: https://dev.helius.xyz/

---

## Database Schema

### PostgreSQL Tables

```sql
-- Cached FairScale scores (reduce API calls)
CREATE TABLE cached_scores (
  wallet VARCHAR(44) PRIMARY KEY,
  fairscore_base DECIMAL,
  social_score DECIMAL,
  fairscore DECIMAL,
  tier VARCHAR(20),
  badges JSONB,
  features JSONB,
  fetched_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Token analysis results
CREATE TABLE token_analyses (
  mint VARCHAR(44) PRIMARY KEY,
  name VARCHAR(255),
  symbol VARCHAR(50),
  deployer_wallet VARCHAR(44),
  deployer_fairscore DECIMAL,
  deployer_tier VARCHAR(20),
  holder_quality_score DECIMAL,
  trust_rating DECIMAL,
  risk_flags JSONB,
  total_supply BIGINT,
  holder_count INTEGER,
  created_at TIMESTAMP,
  analyzed_at TIMESTAMP DEFAULT NOW(),
  helius_metadata JSONB
);

-- User accounts (wallet-based auth)
CREATE TABLE users (
  wallet VARCHAR(44) PRIMARY KEY,
  fairscore DECIMAL,
  tier VARCHAR(20),
  last_score_check TIMESTAMP,
  daily_lookups_used INTEGER DEFAULT 0,
  daily_lookups_reset TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User watchlist
CREATE TABLE watchlist (
  id SERIAL PRIMARY KEY,
  user_wallet VARCHAR(44) REFERENCES users(wallet),
  token_mint VARCHAR(44),
  added_at TIMESTAMP DEFAULT NOW()
);

-- User alerts (Silver+ tier)
CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  user_wallet VARCHAR(44) REFERENCES users(wallet),
  alert_type VARCHAR(50), -- 'new_token', 'rug_warning', 'deployer_activity'
  min_deployer_score DECIMAL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Analytics / page views (for traction evidence)
CREATE TABLE page_views (
  id SERIAL PRIMARY KEY,
  path VARCHAR(255),
  wallet VARCHAR(44),
  timestamp TIMESTAMP DEFAULT NOW()
);
```

---

## Step-by-Step Build Order

### Phase 1: Foundation (Day 1-2)
1. **Initialize project** with `npx create-next-app@latest tokentrust --typescript --tailwind --app`
2. **Set up Solana wallet adapter** (Phantom, Solflare, Backpack)
3. **Set up environment variables** (FAIRSCALE_API_KEY, HELIUS_API_KEY)
4. **Create FairScale API proxy route** (`/api/fairscore`)
5. **Create basic Helius service** (token metadata lookup)
6. **Set up database** (PostgreSQL + Prisma/Drizzle ORM)
7. **Deploy to Vercel** (get live URL early for traction)

### Phase 2: Core Features (Day 3-5)
8. **Build Token Lookup page** (`/token/[mint]`)
   - Fetch token metadata via Helius
   - Identify deployer wallet
   - Fetch deployer FairScore
   - Display trust analysis
9. **Build Deployer Profile page** (`/deployer/[wallet]`)
   - Full FairScore breakdown
   - All deployed tokens
   - Trust history
10. **Implement Token Analyzer service**
    - Composite trust rating algorithm
    - Risk flag detection
11. **Add caching layer** for FairScale responses

### Phase 3: User Features (Day 6-7)
12. **Implement wallet-based auth** (NextAuth + wallet signature)
13. **Build User Dashboard** with FairScore display
14. **Implement tier-based feature gating**
15. **Build Watchlist functionality**
16. **Add holder quality analysis** (batch FairScore lookups for holders)

### Phase 4: Premium Features (Day 8-9)
17. **Build Trending page** (highest trust new tokens)
18. **Implement alert system** (Silver+ tier)
19. **Add search with autocomplete**
20. **Build discovery/explore features**

### Phase 5: Polish & Traction (Day 10-14)
21. **UI/UX polish** - responsive design, animations, loading states
22. **Create X/Twitter account** and start posting
23. **List on Legends.fun** with code FAIRAT
24. **Record demo video** (max 5 min)
25. **Create pitch slides**
26. **Write README and documentation**
27. **Push to FairScale's GitHub organization**
28. **Collect traction evidence** (screenshots, analytics, user count)

---

## Business Model & Traction Strategy

### Revenue Model
1. **Freemium tiers** - Basic free, premium features for higher FairScore tiers
2. **Future API access** - Platinum users can access TokenTrust API
3. **B2B** - Token launch platforms can integrate TokenTrust ratings
4. **Data licensing** - Trust scores for tokens as a service
5. **Premium subscriptions** - For users who want Gold/Platinum features but don't have the FairScore (pay to unlock)

### User Acquisition Strategy

#### First 100 Users
- Post on Crypto Twitter about rug pull prevention
- Share in Solana Discord communities
- Post token trust analyses of trending tokens (free alpha)
- Engage with FairScale community (Telegram, X)

#### First 1,000 Users
- Create a Twitter bot that auto-analyzes trending Solana tokens
- Partner with Solana influencers for reviews
- Submit to Solana ecosystem directories
- Create educational threads about on-chain reputation

#### First 10,000 Users
- Browser extension for quick token checks on DEX aggregators
- Telegram bot integration
- Partnership with DEX platforms for embedded trust scores
- Featured on DeFi directories

### Traction Actions (Do ASAP)
1. Create X/Twitter account: @TokenTrustSol or similar
2. Tweet about the project daily
3. Post token analyses as free content
4. Engage with @fairscalexyz posts
5. Join FairScale Telegram and be active
6. List on Legends.fun immediately with FAIRAT code
7. Create a simple landing page early for collecting emails/waitlist

---

## Submission Checklist

- [ ] Live platform URL on Vercel (mainnet, accessible to real users)
- [ ] GitHub repo pushed to FairScale's GitHub org
- [ ] Clear README with:
  - [ ] Project description
  - [ ] Setup instructions
  - [ ] Integration documentation
  - [ ] Screenshots
- [ ] Demo video (YouTube/Loom, max 5 min)
- [ ] Pitch slides (Google Slides / PDF)
- [ ] X/Twitter account with:
  - [ ] Profile set up
  - [ ] Multiple tweets/threads
  - [ ] Engagement with FairScale
- [ ] Legends.fun listing (invite code: FAIRAT)
  - [ ] Demo video on listing
  - [ ] Public traction evidence
  - [ ] Founder's card
- [ ] Team info document
- [ ] Analytics screenshots (PostHog/Plausible)
- [ ] User count evidence

---

## Key Resources & Links

### FairScale
- Website: https://fairscale.xyz/
- App: https://app.fairscale.xyz
- API Docs: https://docs.fairscale.xyz/
- Get API Key: https://sales.fairscale.xyz/
- Tech Support Telegram: https://t.me/+XF23ay9aY1AzYzlk
- Main Telegram: https://t.me/+WQlko_c5blJhN2E0
- Twitter: https://x.com/fairscalexyz

### Helius (Solana RPC)
- Website: https://www.helius.dev
- Docs: https://www.helius.dev/docs
- SDK: https://github.com/helius-labs/helius-sdk
- Get API Key: https://dev.helius.xyz/
- Free tier: 1M credits, no credit card

### Legends.fun
- Platform: https://legends.fun
- Use invite code: FAIRAT
- FAIRathon deadline: March 1, 2026
- Top 10 get DePitch Academy Pass + 50% Pro discount

### Bounty Listing
- Superteam: https://superteam.fun/earn/listing/fairathon/

### Team Formation
- Find teammates: https://airtable.com/appTQbl8cyJwe2moE/shrsu24w7bHA8XKLJ/tblLBhDnNlK2oMTUz
- Register as available: https://airtable.com/appTQbl8cyJwe2moE/pagjsUKmOH7ObCwMN/form

### Existing Competitor Projects
- FairScoreGate: https://github.com/Iktiarshovo/FairScoreGate (fair-score-gate.vercel.app)
- FairBounty: https://fairbounty.vercel.app/
- TrustChain: https://github.com/Freedomwithin/TrustChain

### Solana Development
- Wallet Adapter Guide: https://solana.com/developers/guides/wallets/add-solana-wallet-adapter-to-nextjs
- create-solana-dapp: `npx create-solana-dapp@latest`
- Scaffold: https://github.com/solana-developers/solana-dapp-next

### On-Chain Reputation / Credit Scoring References
- Cred Protocol: https://credprotocol.com/
- On-Chain Credit Scores article: https://onchain.org/magazine/what-is-onchain-credit-score-crypto-lending-platform/
- Crypto Credit Scores: https://cryptocreditscores.org/

---

## Important Notes for the Agent Building This

1. **API Key Security:** NEVER expose the FairScale API key on the client. Always proxy through Next.js API routes.
2. **Caching is Critical:** Free tier only gives 1,000 FairScale requests/month. Cache aggressively (1-hour TTL for scores).
3. **Helius Free Tier:** 1M credits is generous. Use DAS API for token metadata, Enhanced Transactions for history.
4. **Score Scales Differ:** The `/score` endpoint returns decimals (0-100 range), while `/fairScore` returns integers (0-1000+ range). Handle both.
5. **Tier Thresholds:** Based on FairScoreGate's approach: Bronze (0+), Silver (300+), Gold (600+), Platinum (850+). These use the integer scale from `/fairScore`.
6. **Deploy Early:** Get a Vercel URL up ASAP to start collecting traction data.
7. **Legends.fun:** Must list with code FAIRAT before the deadline.
8. **GitHub:** Code must be pushed to FairScale's GitHub organization (not personal repo).
9. **Demo Video:** Keep under 5 minutes. Show the core flow: search token → see deployer FairScore → trust rating → tier gating.
10. **The winning formula:** Deep FairScore integration + real utility + visible traction + clear business model.
