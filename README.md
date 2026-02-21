# TokenTrust — Reputation-Powered Token Intelligence for Solana

**Live:** [tokentrust.app](https://fairmint-sigma.vercel.app) | **Built with:** [FairScale](https://fairscale.xyz)

TokenTrust is a production-ready token intelligence platform that makes FairScale reputation the foundation of every trading decision on Solana. Instead of relying on hype or social signals, TokenTrust lets users analyze any token through the lens of on-chain reputation — scoring deployers, evaluating holder quality, and detecting risk patterns before a single trade is made.

---

## The Problem

Solana traders face a constant stream of new tokens with no reliable way to evaluate trust. Rug pulls, low-quality deployers, and Sybil-farmed holder bases are rampant. Existing tools check smart contract code but ignore the most important signal: **who deployed it, and who holds it?**

## The Solution

TokenTrust turns FairScale reputation into actionable intelligence:

- **Deployer Reputation** — Every token's deployer is scored via FairScale. A Platinum deployer with years of on-chain history is fundamentally different from a fresh wallet.
- **Holder Quality Analysis** — Top holders are individually scored. A token held by high-reputation wallets is more trustworthy than one held by brand-new addresses.
- **Composite Trust Rating** — A 0-100 score combining deployer reputation (15%), holder quality (25%), distribution health (20%), wallet age (10%), behavior patterns (20%), and liquidity depth (10%).
- **Tier-Gated Features** — Users' own FairScore unlocks premium capabilities: more comparison slots, deeper recommendations, and advanced analytics.

---

## FairScore Integration

FairScore is not a decorative badge — it is the core scoring engine. Every major feature depends on it:

### Scoring Engine (50% of Trust Rating)
The token analyzer uses three FairScale endpoints to build the composite trust score:

| Component | Weight | FairScale Endpoint | How It's Used |
|-----------|--------|-------------------|---------------|
| Deployer Reputation | 15% | `/score` (full profile) | Deployer wallet's FairScore normalized to 0-100 |
| Holder Quality | 25% | `/fairScore` (batch) | Average FairScore of top 10 holders |
| Wallet Age & Activity | 10% | `/score` features | `wallet_age_score`, `active_days`, `tx_count` from deployer profile |

### Access Control (Tier-Gated Features)
Users' own FairScore tier determines what they can access:

| Feature | Bronze | Silver | Gold | Platinum |
|---------|--------|--------|------|----------|
| Comparison Slots | 2 | 3 | 4 | 4 |
| Recommendations | Top 3 | Top 5 | All | All |
| Feature Gates | Basic | Standard | Full | Full + Priority |

### Risk Management
FairScale signals directly trigger risk flags:
- Deployer score < 100 → "Low Deployer Score" flag
- Fresh deployer wallet → "New Deployer" warning
- Connected holder wallets (Sybil detection) → "Connected Wallets" flag
- Low average holder quality → "Weak Holder Base" flag

### Wallet Reputation Profiles
Every wallet gets a Trust Passport powered by FairScale:
- Full score breakdown (decimal 0-100, integer 0-1000+)
- Tier classification with visual badge
- Feature radar chart (SOL balance, stablecoins, LSTs, activity, tx volume)
- Historical score tracking with daily snapshots
- Personalized improvement recommendations

---

## Features

### Token Analysis (`/token/[mint]`)
- Composite trust rating (0-100) with weighted breakdown
- Deployer reputation profile with FairScore and tier
- Top holder network graph colored by FairScore tier
- Notable holders showcase (Gold/Platinum wallets highlighted)
- Risk flag detection (15+ risk patterns)
- Jupiter verification status and RugCheck integration
- Token age and authority status badges
- Liquidity depth from Jupiter + DexScreener
- AI-powered contextual summary (Groq/Llama 3.3)
- Historical score tracking chart

### Wallet Reputation (`/reputation/[wallet]`)
- Trust Passport with FairScore, badges, and tier
- Wallet analytics radar chart (6 on-chain dimensions)
- Score history with daily snapshots
- Personalized tier-gated recommendations

### Deployer Profiles (`/deployer/[wallet]`)
- Deployer score with all deployed tokens indexed
- Token network visualization (interactive graph)
- Deployment timeline scatter plot
- Badge portfolio and wallet analytics

### Discovery (`/discover`)
- **Trending** — Top tokens by trust rating (last 24h)
- **New Launches** — Real-time feed via Supabase subscriptions
- **Top Trusted** — Highest-scored tokens with proven deployers

### Multi-Entity Comparison (`/compare`)
- Side-by-side comparison of tokens, wallets, or deployers
- Tier-gated slot count (2-4 based on user's FairScore)
- Winner highlighting and feature-by-feature breakdown
- Drag-and-drop from watchlist

### Wallet Leaderboard (`/wallets`)
- Top 30 wallets ranked by FairScore
- Filter by tier (Platinum, Gold, Silver)
- Activity metrics (wallet age, tx count, active days)

### Dashboard (`/dashboard`)
- Personal FairScore with tier benefits breakdown
- Watchlist management (tokens, wallets, deployers)
- Score improvement recommendations
- Quick token lookup

### Additional Features
- **Browsing History** — Local + cloud sync with search and filters
- **Watchlist** — Multi-entity type support (tokens, wallets, deployers)
- **Interactive Onboarding** — Welcome dialog + spotlight tour for new users
- **Dark Mode** — Full theme support
- **Notifications** — In-app alert system
- **OG Images** — Dynamic social preview cards for tokens and wallets

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Next.js App Router                │
│  ┌───────────┐  ┌───────────┐  ┌─────────────────┐  │
│  │  Pages     │  │  API       │  │  Components     │  │
│  │  /token    │  │  /api/     │  │  /features      │  │
│  │  /compare  │  │  fairscore │  │  /layout        │  │
│  │  /discover │  │  token     │  │  /ui (shadcn)   │  │
│  │  /wallets  │  │  compare   │  │                 │  │
│  │  /dashboard│  │  deployer  │  │                 │  │
│  └───────────┘  └─────┬─────┘  └─────────────────┘  │
│                       │                              │
│              ┌────────┴────────┐                     │
│              │    Services     │                     │
│              │  fairscale.ts   │ ← FairScale API     │
│              │  helius.ts      │ ← Helius RPC        │
│              │  tokenAnalyzer  │ ← Trust Engine       │
│              │  jupiter.ts     │ ← Verification       │
│              │  rugcheck.ts    │ ← Risk Analysis      │
│              │  dexscreener.ts │ ← Liquidity Data     │
│              └────────┬────────┘                     │
│                       │                              │
│              ┌────────┴────────┐                     │
│              │    Supabase     │                     │
│              │  cached_scores  │ ← 1h TTL cache      │
│              │  token_analyses │ ← Analysis cache     │
│              │  score_history  │ ← Daily snapshots    │
│              └─────────────────┘                     │
└─────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui |
| Auth | NextAuth.js + Solana Wallet Adapter |
| Database | Supabase (PostgreSQL) |
| Reputation | FairScale API |
| Blockchain | Helius SDK (Solana RPC + DAS) |
| AI | Groq (Llama 3.3 70B) |
| Analytics | PostHog |
| Errors | Sentry |
| Hosting | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A Supabase project
- API keys for FairScale and Helius

### 1. Clone and Install

```bash
git clone https://github.com/FairScaleOrg/tokentrust.git
cd tokentrust
npm install
```

### 2. Environment Variables

Create `.env.local` in the project root:

```bash
# Required
FAIRSCALE_API_KEY=zpka_xxxxxxxxxxxxx          # FairScale API key (https://sales.fairscale.xyz)
HELIUS_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxx  # Helius API key (https://helius.dev)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000

# Optional
GROQ_API_KEY=gsk_xxxxxxxxxxxxx                # AI summaries (https://console.groq.com)
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxx              # Analytics (https://posthog.com)
NEXT_PUBLIC_SENTRY_DSN=https://...             # Error tracking (https://sentry.io)
```

### 3. Database Setup

Create the following tables in your Supabase project:

- `cached_scores` — FairScale score cache (wallet, score_decimal, score_integer, tier, badges, raw_response, fetched_at)
- `token_analyses` — Token trust analysis cache
- `wallet_score_history` — Daily wallet score snapshots
- `token_score_history` — Daily token score snapshots
- `dexscreener_cache` — DexScreener data cache
- `rugcheck_cache` — RugCheck report cache
- `users` — Authenticated users (wallet address, tier)

### 4. Run

```bash
npm run dev       # Development server at localhost:3000
npm run build     # Production build
npm start         # Start production server
npm run lint      # ESLint check
```

---

## API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/fairscore?wallet=` | GET | Full FairScore profile (score, tier, badges, features) |
| `/api/fairscore/quick?wallet=` | GET | Lightweight score lookup |
| `/api/token/[mint]` | GET | Comprehensive token trust analysis |
| `/api/token/[mint]/holders` | GET | Top holders with FairScore enrichment |
| `/api/token/[mint]/liquidity` | GET | DEX liquidity data |
| `/api/deployer/[wallet]` | GET | Deployer profile with deployed tokens |
| `/api/reputation/[wallet]` | GET | Full wallet reputation profile |
| `/api/compare?mints=` | GET | Multi-token comparison |
| `/api/compare/wallets?addresses=` | GET | Multi-wallet comparison |
| `/api/compare/deployers?addresses=` | GET | Multi-deployer comparison |
| `/api/discover` | GET | Trending, new, and top-trusted tokens |
| `/api/search?q=` | GET | Token search by name/symbol/mint |
| `/api/watchlist` | GET/POST/DELETE | Watchlist management |
| `/api/ai/summary` | POST | AI-powered contextual analysis |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages + API routes
│   ├── api/                # Server-side API endpoints
│   ├── compare/            # Multi-entity comparison page
│   ├── dashboard/          # Personal dashboard
│   ├── deployer/[wallet]/  # Deployer profile page
│   ├── discover/           # Token discovery feed
│   ├── history/            # Browsing history
│   ├── reputation/[wallet]/# Wallet reputation page
│   ├── search/             # Token search
│   ├── token/[mint]/       # Token analysis page
│   └── wallets/            # Wallet leaderboard
├── components/
│   ├── features/           # Feature components (30+)
│   ├── layout/             # Header, Footer
│   └── ui/                 # shadcn/ui primitives
├── hooks/                  # Custom React hooks (16+)
├── lib/                    # Utilities, auth config, recommendations
├── providers/              # Context providers (Wallet, Session, Onboarding, Theme)
├── services/               # External API integrations
│   ├── fairscale.ts        # FairScale reputation API
│   ├── helius.ts           # Helius Solana RPC
│   ├── tokenAnalyzer.ts    # Core trust engine
│   ├── jupiter.ts          # Token verification
│   ├── rugcheck.ts         # Risk analysis
│   └── dexscreener.ts      # Liquidity data
└── types/                  # TypeScript type definitions
```

---

## Business Model

### Revenue Paths
1. **Premium Tiers** — Advanced analytics, unlimited comparison slots, and priority analysis for paying users
2. **API Access** — Token trust scores as a B2B service for DEXs, wallets, and trading platforms
3. **Data Partnerships** — Aggregated trust intelligence for institutional traders and funds

### Target Audience
- Solana token traders who want to avoid rug pulls
- DeFi users evaluating new token launches
- Project teams wanting to demonstrate deployer credibility
- Wallet providers seeking trust signals for their users

### Go-to-Market
1. **0-100 users** — Launch on Solana Twitter, engage with trading communities, list on Legends.fun
2. **100-1,000** — Integrate with popular Solana wallets and DEX aggregators as a trust signal provider
3. **1,000-10,000** — API partnerships with trading platforms, embed trust scores in DEX UIs

---

## Team

**Arsen Abdigali** — Software Engineer

- BS Computer Science, Nazarbayev University (2025)
- Currently at ITS Partner / Signify — designing Kubernetes pipelines serving 20M+ users
- Experience building distributed systems in Go, AWS, and Kubernetes at production scale
- GitHub: [abdigaliarsen](https://github.com/abdigaliarsen) | X: [@ArsAbdigali](https://x.com/ArsAbdigali)

**Blockchain Track Record:**
- Winner, Solana Day ($25,000)
- 3rd Place, Decentrathon 2.0 ($50,000)
- 2nd Place, Blockchain Hackathon Day ($4,000)
- Winner, ISSAI GenerativeAI 2024 ($4,000)

---

## Resources

- **FairScale API Docs:** https://docs.fairscale.xyz
- **FairScale Website:** https://fairscale.xyz
- **Helius SDK:** https://docs.helius.dev
- **Supabase:** https://supabase.com/docs

---

## License

MIT
