# TokenTrust - Design Document

**Date:** 2026-02-20
**Deadline:** 2026-03-01 (FAIRathon bounty)
**Scope:** Full MVP (Phases 1-3)

## Overview

TokenTrust is a reputation-powered token intelligence platform for Solana. It uses FairScale reputation data to help traders identify trustworthy tokens and avoid scams, with premium features gated by the user's own FairScore.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+ (App Router), TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (PostgreSQL + RLS) |
| Wallet | @solana/wallet-adapter-react |
| RPC/Data | Helius SDK |
| Reputation | FairScale API (proxied) |
| Auth | NextAuth.js + wallet signature |
| Analytics | PostHog |
| Error Tracking | Sentry |
| Deployment | Vercel |
| Design | Figma (designs first, then implement) |
| Project Tracking | Linear |

## Build Approach

Design-First Sequential:
1. Scaffold project + Supabase schema + Figma designs
2. Implement foundation (API routes, services, wallet auth)
3. Build all pages from Figma designs
4. Integration testing, polish, deploy
5. Demo video, pitch deck, Legends.fun listing

## Pages & Routes

| Route | Page | Auth Required |
|-------|------|---------------|
| `/` | Landing — hero, search bar, recent trusted tokens, connect wallet CTA | No |
| `/token/[mint]` | Token Lookup — token info, deployer FairScore, holder quality, trust rating | No (basic), Yes (deep) |
| `/deployer/[wallet]` | Deployer Profile — FairScore breakdown, badges, deployed tokens | No |
| `/dashboard` | User Dashboard — own FairScore, tier, watchlist | Yes |
| `/search` | Search Results — token/deployer search with filters | No |

## Database Schema (Supabase)

### cached_scores
- `wallet` (PK, varchar 44)
- `fairscore_base`, `social_score`, `fairscore` (decimal)
- `tier` (varchar 20)
- `badges` (jsonb), `features` (jsonb)
- `fetched_at`, `expires_at` (timestamp)

### token_analyses
- `mint` (PK, varchar 44)
- `name` (varchar 255), `symbol` (varchar 50)
- `deployer_wallet` (varchar 44)
- `deployer_fairscore` (decimal), `deployer_tier` (varchar 20)
- `holder_quality_score`, `trust_rating` (decimal)
- `risk_flags` (jsonb), `holder_count` (integer)
- `analyzed_at` (timestamp), `helius_metadata` (jsonb)

### users
- `wallet` (PK, varchar 44)
- `fairscore` (decimal), `tier` (varchar 20)
- `daily_lookups_used` (integer), `daily_lookups_reset` (timestamp)
- `created_at` (timestamp)

### watchlist
- `id` (PK, serial)
- `user_wallet` (FK -> users.wallet)
- `token_mint` (varchar 44)
- `added_at` (timestamp)

## Service Layer

### fairscale.ts
- Wraps FairScale API with Supabase cache (1hr TTL)
- Rate limit tracking
- Tier classification helper

### helius.ts
- Token metadata (DAS API)
- Transaction history
- Token holder lists
- Deployer wallet identification

### tokenAnalyzer.ts
- Composite Trust Rating (0-100):
  - Deployer FairScore (40%)
  - Holder Quality Score (25%)
  - Holder Distribution (15%)
  - Token Age (10%)
  - Transaction Patterns (10%)
- Risk flag detection

### supabase.ts
- Server-side and client-side Supabase clients
- Typed helpers for all tables

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/fairscore?wallet=X` | GET | Proxy to FairScale /score (cached) |
| `/api/fairscore/quick?wallet=X` | GET | Proxy to FairScale /fairScore |
| `/api/token/[mint]` | GET | Token data + deployer score + trust rating |
| `/api/token/[mint]/holders` | GET | Top holders with FairScores |
| `/api/deployer/[wallet]` | GET | Deployer profile + tokens |
| `/api/search?q=X` | GET | Search tokens/deployers |
| `/api/watchlist` | GET/POST/DELETE | Watchlist CRUD (auth required) |
| `/api/auth/[...nextauth]` | * | Wallet-based auth |

## Feature Components

| Component | Purpose |
|-----------|---------|
| `FairScoreDisplay` | Wallet FairScore with tier badge and color coding |
| `TrustRating` | Composite 0-100 trust rating gauge |
| `TokenCard` | Token card for search results / watchlist |
| `DeployerCard` | Mini deployer profile card |
| `HolderQualityBar` | Visual holder quality distribution |
| `RiskFlags` | Risk flag display with severity |
| `TierGate` | Feature gating by user's FairScore tier |
| `WalletConnect` | Wallet connection (Phantom/Solflare/Backpack) |
| `TokenSearch` | Search input with autocomplete |

## Auth Flow

1. User clicks "Connect Wallet" -> Solana wallet adapter
2. User signs message proving ownership
3. NextAuth creates session with wallet address
4. Server fetches user's FairScore
5. User record created/updated in Supabase
6. Tier stored in session for TierGate component

## Tier Gating

| Tier | Lookups/day | Features |
|------|------------|----------|
| No wallet | 5 | Basic token search |
| Bronze (0+) | 15 | + Deployer FairScore |
| Silver (300+) | 50 | + Holder analysis |
| Gold (600+) | Unlimited | + Deep analytics, watchlist |
| Platinum (850+) | Unlimited | + All features |

## Trust Score Color System

- Bronze: `text-amber-600` / `bg-amber-100`
- Silver: `text-slate-500` / `bg-slate-100`
- Gold: `text-yellow-500` / `bg-yellow-50`
- Platinum: `text-violet-600` / `bg-violet-50`
- Risk/danger: `text-red-600` / `bg-red-50`
- Trust/safe: `text-emerald-600` / `bg-emerald-50`
