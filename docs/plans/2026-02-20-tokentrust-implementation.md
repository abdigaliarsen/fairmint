# TokenTrust Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build TokenTrust — a reputation-powered token intelligence platform for Solana using FairScale API, for the FAIRathon bounty (deadline: March 1, 2026).

**Architecture:** Next.js 14+ App Router with TypeScript. Supabase for PostgreSQL + auth. FairScale API for reputation scoring (proxied through API routes). Helius for on-chain Solana data. Figma designs implemented 1:1 with shadcn/ui components.

**Tech Stack:** Next.js 14+, TypeScript, Tailwind CSS, shadcn/ui, Supabase, FairScale API, Helius SDK, NextAuth.js, Solana Wallet Adapter, PostHog, Sentry, Vercel.

---

## Task 1: Project Scaffolding

**Files:**
- Create: entire Next.js project structure
- Create: `.env.local`
- Create: `src/lib/utils.ts`

**Step 1: Scaffold Next.js project**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

(Run in `/home/arsen/projects/fairmint/`)

**Step 2: Install core dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr helius-sdk @solana/web3.js @solana/wallet-adapter-base @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-wallets next-auth@beta bs58 zod class-variance-authority clsx tailwind-merge lucide-react
```

**Step 3: Install dev dependencies**

```bash
npm install -D @types/bs58
```

**Step 4: Initialize shadcn/ui**

```bash
npx shadcn@latest init -d
```

Then add components:
```bash
npx shadcn@latest add button card input badge dialog dropdown-menu separator skeleton tabs tooltip avatar sheet
```

**Step 5: Create environment file**

Create `.env.local`:
```env
FAIRSCALE_API_KEY=<your-fairscale-api-key>
HELIUS_API_KEY=<your-helius-api-key>
NEXT_PUBLIC_SUPABASE_URL=<from supabase project>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase project>
SUPABASE_SERVICE_ROLE_KEY=<from supabase project>
NEXTAUTH_SECRET=<generate with openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
```

**Step 6: Verify project runs**

```bash
npm run dev
```

Expected: Next.js dev server starts on http://localhost:3000

**Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js project with dependencies"
```

---

## Task 2: Create Supabase Project & Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql` (reference only — applied via MCP)

**Step 1: Create Supabase project via MCP**

Use `mcp__plugin_supabase_supabase__create_project` with:
- name: `tokentrust`
- region: `us-east-1`
- plan: `free`

**Step 2: Get project URL and keys**

Use `mcp__plugin_supabase_supabase__get_project` to retrieve:
- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- Anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Service role key → `SUPABASE_SERVICE_ROLE_KEY`

Update `.env.local` with these values.

**Step 3: Apply database schema**

Use `mcp__plugin_supabase_supabase__execute_sql` to run:

```sql
-- Cached FairScale scores (reduce API calls)
CREATE TABLE cached_scores (
  wallet VARCHAR(44) PRIMARY KEY,
  fairscore_base DECIMAL,
  social_score DECIMAL,
  fairscore DECIMAL,
  tier VARCHAR(20),
  badges JSONB DEFAULT '[]',
  features JSONB DEFAULT '{}',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour')
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
  risk_flags JSONB DEFAULT '[]',
  holder_count INTEGER,
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  helius_metadata JSONB DEFAULT '{}'
);

-- User accounts (wallet-based)
CREATE TABLE users (
  wallet VARCHAR(44) PRIMARY KEY,
  fairscore DECIMAL DEFAULT 0,
  tier VARCHAR(20) DEFAULT 'bronze',
  daily_lookups_used INTEGER DEFAULT 0,
  daily_lookups_reset TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User watchlist
CREATE TABLE watchlist (
  id SERIAL PRIMARY KEY,
  user_wallet VARCHAR(44) REFERENCES users(wallet) ON DELETE CASCADE,
  token_mint VARCHAR(44),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_wallet, token_mint)
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_analyses ENABLE ROW LEVEL SECURITY;

-- RLS policies: cached_scores and token_analyses are readable by all, writable by service role only
CREATE POLICY "cached_scores_read" ON cached_scores FOR SELECT USING (true);
CREATE POLICY "token_analyses_read" ON token_analyses FOR SELECT USING (true);

-- Users can read their own record
CREATE POLICY "users_read_own" ON users FOR SELECT USING (true);
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Watchlist: users manage their own
CREATE POLICY "watchlist_read_own" ON watchlist FOR SELECT USING (user_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address');
CREATE POLICY "watchlist_insert_own" ON watchlist FOR INSERT WITH CHECK (user_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address');
CREATE POLICY "watchlist_delete_own" ON watchlist FOR DELETE USING (user_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address');
```

**Step 4: Verify tables exist**

Use `mcp__plugin_supabase_supabase__list_tables` to confirm all 4 tables are created.

---

## Task 3: Supabase Client Utilities

**Files:**
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/client.ts`
- Create: `src/types/database.ts`

**Step 1: Create database types**

`src/types/database.ts`:
```typescript
export interface CachedScore {
  wallet: string;
  fairscore_base: number | null;
  social_score: number | null;
  fairscore: number | null;
  tier: string | null;
  badges: Badge[];
  features: Record<string, number>;
  fetched_at: string;
  expires_at: string;
}

export interface Badge {
  id: string;
  label: string;
  description: string;
  tier: string;
}

export interface TokenAnalysis {
  mint: string;
  name: string | null;
  symbol: string | null;
  deployer_wallet: string | null;
  deployer_fairscore: number | null;
  deployer_tier: string | null;
  holder_quality_score: number | null;
  trust_rating: number | null;
  risk_flags: RiskFlag[];
  holder_count: number | null;
  analyzed_at: string;
  helius_metadata: Record<string, unknown>;
}

export interface RiskFlag {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface User {
  wallet: string;
  fairscore: number;
  tier: string;
  daily_lookups_used: number;
  daily_lookups_reset: string;
  created_at: string;
}

export interface WatchlistItem {
  id: number;
  user_wallet: string;
  token_mint: string;
  added_at: string;
}

export type FairScoreTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface FairScoreData {
  wallet: string;
  fairscore_base: number;
  social_score: number;
  fairscore: number;
  tier: FairScoreTier;
  badges: Badge[];
  actions: unknown[];
  timestamp: string;
  features: Record<string, number>;
}
```

**Step 2: Create server-side Supabase client**

`src/lib/supabase/server.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

**Step 3: Create client-side Supabase client**

`src/lib/supabase/client.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
```

**Step 4: Commit**

```bash
git add src/types/database.ts src/lib/supabase/
git commit -m "feat: add Supabase client utilities and database types"
```

---

## Task 4: FairScale Service

**Files:**
- Create: `src/services/fairscale.ts`
- Create: `src/services/__tests__/fairscale.test.ts`

**Step 1: Write the service**

`src/services/fairscale.ts`:
```typescript
import { createServerClient } from '@/lib/supabase/server';
import type { FairScoreData, CachedScore, FairScoreTier } from '@/types/database';

const FAIRSCALE_BASE_URL = 'https://api.fairscale.xyz';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function classifyTier(score: number): FairScoreTier {
  if (score >= 850) return 'platinum';
  if (score >= 600) return 'gold';
  if (score >= 300) return 'silver';
  return 'bronze';
}

export function getTierColor(tier: FairScoreTier) {
  const colors = {
    bronze: { text: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-300' },
    silver: { text: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-300' },
    gold: { text: 'text-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-300' },
    platinum: { text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-300' },
  };
  return colors[tier];
}

async function fetchFromCache(wallet: string): Promise<CachedScore | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('cached_scores')
    .select('*')
    .eq('wallet', wallet)
    .single();

  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  return data as CachedScore;
}

async function saveToCache(score: FairScoreData): Promise<void> {
  const supabase = createServerClient();
  await supabase.from('cached_scores').upsert({
    wallet: score.wallet,
    fairscore_base: score.fairscore_base,
    social_score: score.social_score,
    fairscore: score.fairscore,
    tier: score.tier,
    badges: score.badges,
    features: score.features,
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
  });
}

export async function getFullScore(wallet: string): Promise<FairScoreData | null> {
  // Check cache first
  const cached = await fetchFromCache(wallet);
  if (cached) {
    return {
      wallet: cached.wallet,
      fairscore_base: cached.fairscore_base ?? 0,
      social_score: cached.social_score ?? 0,
      fairscore: cached.fairscore ?? 0,
      tier: (cached.tier as FairScoreTier) ?? 'bronze',
      badges: cached.badges ?? [],
      actions: [],
      timestamp: cached.fetched_at,
      features: cached.features ?? {},
    };
  }

  // Fetch from API
  const response = await fetch(`${FAIRSCALE_BASE_URL}/score?wallet=${wallet}`, {
    headers: { fairkey: process.env.FAIRSCALE_API_KEY! },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`FairScale API error: ${response.status}`);

  const data: FairScoreData = await response.json();
  await saveToCache(data);
  return data;
}

export async function getQuickScore(wallet: string): Promise<number | null> {
  const response = await fetch(`${FAIRSCALE_BASE_URL}/fairScore?wallet=${wallet}`, {
    headers: { fairkey: process.env.FAIRSCALE_API_KEY! },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`FairScale API error: ${response.status}`);

  const data = await response.json();
  return data.fair_score;
}

export async function getWalletScore(wallet: string): Promise<number | null> {
  const response = await fetch(`${FAIRSCALE_BASE_URL}/walletScore?wallet=${wallet}`, {
    headers: { fairkey: process.env.FAIRSCALE_API_KEY! },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`FairScale API error: ${response.status}`);

  const data = await response.json();
  return data.wallet_score;
}
```

**Step 2: Write unit tests**

`src/services/__tests__/fairscale.test.ts`:
```typescript
import { classifyTier, getTierColor } from '../fairscale';

describe('classifyTier', () => {
  it('returns bronze for scores below 300', () => {
    expect(classifyTier(0)).toBe('bronze');
    expect(classifyTier(299)).toBe('bronze');
  });

  it('returns silver for scores 300-599', () => {
    expect(classifyTier(300)).toBe('silver');
    expect(classifyTier(599)).toBe('silver');
  });

  it('returns gold for scores 600-849', () => {
    expect(classifyTier(600)).toBe('gold');
    expect(classifyTier(849)).toBe('gold');
  });

  it('returns platinum for scores 850+', () => {
    expect(classifyTier(850)).toBe('platinum');
    expect(classifyTier(1000)).toBe('platinum');
  });
});

describe('getTierColor', () => {
  it('returns amber colors for bronze', () => {
    const colors = getTierColor('bronze');
    expect(colors.text).toBe('text-amber-600');
    expect(colors.bg).toBe('bg-amber-100');
  });

  it('returns violet colors for platinum', () => {
    const colors = getTierColor('platinum');
    expect(colors.text).toBe('text-violet-600');
    expect(colors.bg).toBe('bg-violet-50');
  });
});
```

**Step 3: Run tests**

```bash
npm test -- --watchAll=false
```

Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/services/fairscale.ts src/services/__tests__/
git commit -m "feat: add FairScale service with caching and tier classification"
```

---

## Task 5: Helius Service

**Files:**
- Create: `src/services/helius.ts`

**Step 1: Write the service**

`src/services/helius.ts`:
```typescript
import { Helius } from 'helius-sdk';

let heliusClient: Helius | null = null;

function getHelius(): Helius {
  if (!heliusClient) {
    heliusClient = new Helius(process.env.HELIUS_API_KEY!);
  }
  return heliusClient;
}

export interface TokenMetadata {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  supply: number;
  decimals: number;
  authorities: Array<{ address: string; scopes: string[] }>;
}

export interface TokenHolder {
  owner: string;
  amount: number;
  percentage: number;
}

export async function getTokenMetadata(mint: string): Promise<TokenMetadata | null> {
  try {
    const helius = getHelius();
    const response = await helius.rpc.getAsset({ id: mint });

    if (!response) return null;

    return {
      mint: response.id,
      name: response.content?.metadata?.name ?? 'Unknown',
      symbol: response.content?.metadata?.symbol ?? '???',
      description: response.content?.metadata?.description ?? '',
      image: response.content?.links?.image ?? '',
      supply: response.token_info?.supply ?? 0,
      decimals: response.token_info?.decimals ?? 0,
      authorities: response.authorities ?? [],
    };
  } catch {
    return null;
  }
}

export async function getTokenHolders(mint: string, limit = 20): Promise<TokenHolder[]> {
  try {
    const response = await fetch(
      `https://api.helius.xyz/v0/token-accounts?api-key=${process.env.HELIUS_API_KEY!}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mint,
          limit,
          showZeroBalance: false,
        }),
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const totalAmount = data.token_accounts?.reduce(
      (sum: number, acc: { amount: number }) => sum + acc.amount,
      0
    ) ?? 0;

    return (data.token_accounts ?? []).map((acc: { owner: string; amount: number }) => ({
      owner: acc.owner,
      amount: acc.amount,
      percentage: totalAmount > 0 ? (acc.amount / totalAmount) * 100 : 0,
    }));
  } catch {
    return [];
  }
}

export async function getWalletTransactions(wallet: string, limit = 20) {
  try {
    const response = await fetch(
      `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${process.env.HELIUS_API_KEY!}&limit=${limit}`
    );

    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

export function identifyDeployer(metadata: TokenMetadata): string | null {
  const updateAuthority = metadata.authorities?.find(
    (a) => a.scopes?.includes('full') || a.scopes?.includes('metadata')
  );
  return updateAuthority?.address ?? null;
}
```

**Step 2: Commit**

```bash
git add src/services/helius.ts
git commit -m "feat: add Helius service for token metadata and holder data"
```

---

## Task 6: Token Analyzer Service

**Files:**
- Create: `src/services/tokenAnalyzer.ts`
- Create: `src/services/__tests__/tokenAnalyzer.test.ts`

**Step 1: Write the service**

`src/services/tokenAnalyzer.ts`:
```typescript
import { getFullScore, getQuickScore, classifyTier } from './fairscale';
import { getTokenMetadata, getTokenHolders, identifyDeployer } from './helius';
import { createServerClient } from '@/lib/supabase/server';
import type { RiskFlag, TokenAnalysis, FairScoreData } from '@/types/database';

export interface TrustAnalysis {
  token: {
    mint: string;
    name: string;
    symbol: string;
    image: string;
    supply: number;
  };
  deployer: {
    wallet: string;
    fairscore: FairScoreData | null;
  };
  trustRating: number;
  holderQualityScore: number;
  riskFlags: RiskFlag[];
  holderCount: number;
}

function detectRiskFlags(
  deployerScore: FairScoreData | null,
  holders: Array<{ owner: string; percentage: number }>,
  tokenAge: number
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (!deployerScore || deployerScore.fairscore < 20) {
    flags.push({
      type: 'low_deployer_score',
      severity: 'high',
      description: 'Deployer has a very low or unknown reputation score',
    });
  }

  if (deployerScore && deployerScore.features?.wallet_age_days < 30) {
    flags.push({
      type: 'new_deployer_wallet',
      severity: 'high',
      description: 'Deployer wallet is less than 30 days old',
    });
  }

  const topHolder = holders[0];
  if (topHolder && topHolder.percentage > 50) {
    flags.push({
      type: 'concentrated_holdings',
      severity: 'high',
      description: `Top holder owns ${topHolder.percentage.toFixed(1)}% of supply`,
    });
  }

  const top5Pct = holders.slice(0, 5).reduce((sum, h) => sum + h.percentage, 0);
  if (top5Pct > 80) {
    flags.push({
      type: 'top5_concentration',
      severity: 'medium',
      description: `Top 5 holders own ${top5Pct.toFixed(1)}% of supply`,
    });
  }

  if (tokenAge < 1) {
    flags.push({
      type: 'very_new_token',
      severity: 'medium',
      description: 'Token was created less than 24 hours ago',
    });
  }

  return flags;
}

function calculateTrustRating(
  deployerScore: number,
  holderQuality: number,
  holderDistribution: number,
  tokenAgeDays: number
): number {
  const deployerComponent = (deployerScore / 100) * 40;
  const holderQualityComponent = (holderQuality / 100) * 25;
  const distributionComponent = holderDistribution * 15;
  const ageComponent = Math.min(tokenAgeDays / 365, 1) * 10;
  const patternComponent = 5; // baseline for now

  return Math.round(
    deployerComponent + holderQualityComponent + distributionComponent + ageComponent + patternComponent
  );
}

export async function analyzeToken(mint: string): Promise<TrustAnalysis | null> {
  const metadata = await getTokenMetadata(mint);
  if (!metadata) return null;

  const deployerWallet = identifyDeployer(metadata);
  const deployerScore = deployerWallet ? await getFullScore(deployerWallet) : null;
  const holders = await getTokenHolders(mint, 20);

  // Calculate holder quality (avg FairScore of top holders)
  let holderQualityScore = 0;
  if (holders.length > 0) {
    const holderScores = await Promise.all(
      holders.slice(0, 10).map(async (h) => {
        const score = await getQuickScore(h.owner);
        return score ?? 0;
      })
    );
    const validScores = holderScores.filter((s) => s > 0);
    holderQualityScore = validScores.length > 0
      ? validScores.reduce((a, b) => a + b, 0) / validScores.length
      : 0;
  }

  // Holder distribution score (0-1, higher = more distributed)
  const holderDistribution = holders.length > 0
    ? 1 - (holders[0]?.percentage ?? 0) / 100
    : 0;

  const tokenAgeDays = 30; // default, would calculate from on-chain data

  const trustRating = calculateTrustRating(
    deployerScore?.fairscore ?? 0,
    holderQualityScore,
    holderDistribution,
    tokenAgeDays
  );

  const riskFlags = detectRiskFlags(deployerScore, holders, tokenAgeDays);

  // Cache analysis in Supabase
  const supabase = createServerClient();
  await supabase.from('token_analyses').upsert({
    mint,
    name: metadata.name,
    symbol: metadata.symbol,
    deployer_wallet: deployerWallet,
    deployer_fairscore: deployerScore?.fairscore ?? null,
    deployer_tier: deployerScore?.tier ?? null,
    holder_quality_score: holderQualityScore,
    trust_rating: trustRating,
    risk_flags: riskFlags,
    holder_count: holders.length,
    analyzed_at: new Date().toISOString(),
    helius_metadata: metadata,
  });

  return {
    token: {
      mint,
      name: metadata.name,
      symbol: metadata.symbol,
      image: metadata.image,
      supply: metadata.supply,
    },
    deployer: {
      wallet: deployerWallet ?? '',
      fairscore: deployerScore,
    },
    trustRating,
    holderQualityScore,
    riskFlags,
    holderCount: holders.length,
  };
}
```

**Step 2: Write unit tests for pure functions**

`src/services/__tests__/tokenAnalyzer.test.ts`:
```typescript
// Test the pure calculation functions (extracted or tested indirectly)
describe('Token Analyzer', () => {
  it('module loads without error', async () => {
    // Basic smoke test — service module exists and exports analyzeToken
    const mod = await import('../tokenAnalyzer');
    expect(typeof mod.analyzeToken).toBe('function');
  });
});
```

**Step 3: Run tests**

```bash
npm test -- --watchAll=false
```

**Step 4: Commit**

```bash
git add src/services/tokenAnalyzer.ts src/services/__tests__/tokenAnalyzer.test.ts
git commit -m "feat: add Token Analyzer service with trust rating algorithm"
```

---

## Task 7: API Routes

**Files:**
- Create: `src/app/api/fairscore/route.ts`
- Create: `src/app/api/fairscore/quick/route.ts`
- Create: `src/app/api/token/[mint]/route.ts`
- Create: `src/app/api/token/[mint]/holders/route.ts`
- Create: `src/app/api/deployer/[wallet]/route.ts`
- Create: `src/app/api/search/route.ts`

**Step 1: FairScore proxy route**

`src/app/api/fairscore/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getFullScore } from '@/services/fairscale';
import { z } from 'zod';

const walletSchema = z.string().min(32).max(44);

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  const parsed = walletSchema.safeParse(wallet);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Valid wallet address required' }, { status: 400 });
  }

  try {
    const data = await getFullScore(parsed.data);
    if (!data) {
      return NextResponse.json({ wallet: parsed.data, fairscore: 0, tier: 'bronze', badges: [], features: {} });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch score' }, { status: 500 });
  }
}
```

**Step 2: Quick score route**

`src/app/api/fairscore/quick/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getQuickScore } from '@/services/fairscale';
import { z } from 'zod';

const walletSchema = z.string().min(32).max(44);

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  const parsed = walletSchema.safeParse(wallet);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Valid wallet address required' }, { status: 400 });
  }

  try {
    const score = await getQuickScore(parsed.data);
    return NextResponse.json({ fair_score: score ?? 0 });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch score' }, { status: 500 });
  }
}
```

**Step 3: Token analysis route**

`src/app/api/token/[mint]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { analyzeToken } from '@/services/tokenAnalyzer';
import { z } from 'zod';

const mintSchema = z.string().min(32).max(44);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  const parsed = mintSchema.safeParse(mint);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Valid token mint address required' }, { status: 400 });
  }

  try {
    const analysis = await analyzeToken(parsed.data);
    if (!analysis) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }
    return NextResponse.json(analysis);
  } catch {
    return NextResponse.json({ error: 'Failed to analyze token' }, { status: 500 });
  }
}
```

**Step 4: Token holders route**

`src/app/api/token/[mint]/holders/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getTokenHolders } from '@/services/helius';
import { getQuickScore } from '@/services/fairscale';
import { z } from 'zod';

const mintSchema = z.string().min(32).max(44);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  const parsed = mintSchema.safeParse(mint);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Valid token mint address required' }, { status: 400 });
  }

  try {
    const holders = await getTokenHolders(parsed.data, 20);
    const holdersWithScores = await Promise.all(
      holders.map(async (holder) => {
        const score = await getQuickScore(holder.owner);
        return { ...holder, fairScore: score ?? 0 };
      })
    );
    return NextResponse.json({ holders: holdersWithScores });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch holders' }, { status: 500 });
  }
}
```

**Step 5: Deployer profile route**

`src/app/api/deployer/[wallet]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getFullScore } from '@/services/fairscale';
import { getWalletTransactions } from '@/services/helius';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const walletSchema = z.string().min(32).max(44);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  const { wallet } = await params;
  const parsed = walletSchema.safeParse(wallet);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Valid wallet address required' }, { status: 400 });
  }

  try {
    const [fairscore, transactions] = await Promise.all([
      getFullScore(parsed.data),
      getWalletTransactions(parsed.data, 20),
    ]);

    // Get tokens deployed by this wallet
    const supabase = createServerClient();
    const { data: deployedTokens } = await supabase
      .from('token_analyses')
      .select('mint, name, symbol, trust_rating, analyzed_at')
      .eq('deployer_wallet', parsed.data)
      .order('analyzed_at', { ascending: false });

    return NextResponse.json({
      wallet: parsed.data,
      fairscore: fairscore ?? { wallet: parsed.data, fairscore: 0, tier: 'bronze', badges: [], features: {} },
      transactions: transactions.slice(0, 10),
      deployedTokens: deployedTokens ?? [],
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch deployer data' }, { status: 500 });
  }
}
```

**Step 6: Search route**

`src/app/api/search/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const querySchema = z.string().min(1).max(100);

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  const parsed = querySchema.safeParse(q);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Search query required' }, { status: 400 });
  }

  try {
    const supabase = createServerClient();

    // Search cached token analyses
    const { data: tokens } = await supabase
      .from('token_analyses')
      .select('mint, name, symbol, trust_rating, deployer_tier, analyzed_at')
      .or(`name.ilike.%${parsed.data}%,symbol.ilike.%${parsed.data}%,mint.eq.${parsed.data}`)
      .order('trust_rating', { ascending: false })
      .limit(20);

    return NextResponse.json({ tokens: tokens ?? [], query: parsed.data });
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
```

**Step 7: Commit**

```bash
git add src/app/api/
git commit -m "feat: add API routes for FairScore, token analysis, deployer, and search"
```

---

## Task 8: Wallet Auth Setup (NextAuth + Solana Wallet Adapter)

**Files:**
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/lib/auth.ts`
- Create: `src/providers/WalletProvider.tsx`
- Create: `src/providers/SessionProvider.tsx`

**Step 1: Create NextAuth config**

`src/lib/auth.ts`:
```typescript
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createServerClient } from '@/lib/supabase/server';
import { getQuickScore, classifyTier } from '@/services/fairscale';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Solana',
      credentials: {
        message: { label: 'Message', type: 'text' },
        signature: { label: 'Signature', type: 'text' },
        publicKey: { label: 'Public Key', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.message || !credentials?.signature || !credentials?.publicKey) {
          return null;
        }

        try {
          const message = new TextEncoder().encode(credentials.message);
          const signature = bs58.decode(credentials.signature);
          const publicKey = bs58.decode(credentials.publicKey);

          const verified = nacl.sign.detached.verify(message, signature, publicKey);
          if (!verified) return null;

          const wallet = credentials.publicKey;

          // Upsert user in Supabase
          const supabase = createServerClient();
          const score = await getQuickScore(wallet);
          const tier = classifyTier(score ?? 0);

          await supabase.from('users').upsert({
            wallet,
            fairscore: score ?? 0,
            tier,
          });

          return { id: wallet, name: wallet };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.wallet = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.wallet) {
        session.user = { ...session.user, wallet: token.wallet as string };
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
};
```

**Step 2: Create NextAuth route handler**

`src/app/api/auth/[...nextauth]/route.ts`:
```typescript
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

**Step 3: Create Wallet Provider**

`src/providers/WalletProvider.tsx`:
```typescript
'use client';

import { useMemo } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

import '@solana/wallet-adapter-react-ui/styles.css';

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
```

**Step 4: Create Session Provider**

`src/providers/SessionProvider.tsx`:
```typescript
'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
```

**Step 5: Install missing dependency**

```bash
npm install tweetnacl next-auth@beta
```

**Step 6: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/ src/providers/
git commit -m "feat: add wallet-based auth with NextAuth and Solana Wallet Adapter"
```

---

## Task 9: Create Figma Designs

**Files:** None (Figma MCP output)

Use Figma MCP `generate_figma_design` to create designs for each page:

**Step 1: Landing page design**

Use `mcp__plugin_figma_figma__generate_figma_design` with detailed prompt describing the TokenTrust landing page: hero section with headline "Know Before You Buy", token search bar, recent trusted tokens grid, wallet connect CTA, dark/light theme using the color system from CLAUDE.md.

**Step 2: Token Lookup page design**

Design showing: token header (name, symbol, image), deployer FairScore card (score gauge, tier badge, badges), holder quality bar, trust rating gauge (0-100), risk flags list, transaction history preview.

**Step 3: Deployer Profile page design**

Design showing: wallet address, full FairScore breakdown (base, social, combined), tier badge, badges grid, features metrics grid, deployed tokens list.

**Step 4: Dashboard page design**

Design showing: user's own FairScore display, current tier with benefits list, watchlist of tokens, score history.

**Step 5: Search Results page design**

Design showing: search bar at top, filterable results grid of TokenCards, filter sidebar (min trust rating, deployer tier).

**Step 6: Get screenshots of each design**

Use `mcp__plugin_figma_figma__get_screenshot` for visual reference during implementation.

---

## Task 10: Layout Components

**Files:**
- Create: `src/components/layout/Header.tsx`
- Create: `src/components/layout/Footer.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Build Header component**

`src/components/layout/Header.tsx`:
```typescript
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Shield, Search } from 'lucide-react';

export function Header() {
  const { publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const walletAddress = publicKey?.toBase58();
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : null;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <Shield className="h-6 w-6 text-emerald-600" />
            <span>TokenTrust</span>
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm">
            <Link href="/search" className="text-muted-foreground hover:text-foreground transition-colors">
              Search
            </Link>
            {walletAddress && (
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {walletAddress ? (
            <div className="flex items-center gap-2">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">{shortAddress}</Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => disconnect()}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button onClick={() => setVisible(true)} className="bg-emerald-600 hover:bg-emerald-700">
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
```

**Step 2: Build Footer component**

`src/components/layout/Footer.tsx`:
```typescript
import { Shield } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t py-8">
      <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          <span>TokenTrust — Powered by FairScale</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Not financial advice. Always DYOR.
        </p>
      </div>
    </footer>
  );
}
```

**Step 3: Update root layout**

Modify `src/app/layout.tsx` to wrap with WalletProvider, SessionProvider, Header, Footer.

**Step 4: Commit**

```bash
git add src/components/layout/ src/app/layout.tsx src/providers/
git commit -m "feat: add Header, Footer layout components and provider wrappers"
```

---

## Task 11: Feature Components

**Files:**
- Create: `src/components/features/FairScoreDisplay.tsx`
- Create: `src/components/features/TrustRating.tsx`
- Create: `src/components/features/TokenCard.tsx`
- Create: `src/components/features/DeployerCard.tsx`
- Create: `src/components/features/RiskFlags.tsx`
- Create: `src/components/features/HolderQualityBar.tsx`
- Create: `src/components/features/TierGate.tsx`
- Create: `src/components/features/TokenSearch.tsx`

Build each component following the Figma designs from Task 9. Match the design 1:1 using shadcn/ui primitives and the tier color system from CLAUDE.md.

Key implementation notes:
- `FairScoreDisplay`: Circular gauge showing score, tier badge with color, score breakdown bars
- `TrustRating`: 0-100 gauge with color gradient (red→yellow→green), numeric display
- `TokenCard`: Card with token image, name/symbol, trust rating badge, deployer tier indicator
- `DeployerCard`: Compact card with wallet address (truncated), score, tier badge
- `RiskFlags`: List of flag items with severity-colored icons (red/yellow)
- `HolderQualityBar`: Horizontal bar showing quality distribution
- `TierGate`: Renders children or "upgrade your tier" message based on user's tier
- `TokenSearch`: Input with search icon, debounced API calls to `/api/search`

**Commit after each component or batch of related components.**

---

## Task 12: Landing Page

**Files:**
- Modify: `src/app/page.tsx`

Build from Figma design. Sections:
1. Hero with headline, subheadline, and TokenSearch component
2. "How it works" 3-step explainer
3. Recent high-trust tokens grid (fetch from `/api/search` or show placeholder)
4. CTA to connect wallet

**Commit:**
```bash
git add src/app/page.tsx
git commit -m "feat: build landing page with hero, search, and trusted tokens"
```

---

## Task 13: Token Lookup Page

**Files:**
- Create: `src/app/token/[mint]/page.tsx`
- Create: `src/hooks/useTokenAnalysis.ts`

Build from Figma design. Sections:
1. Token header (image, name, symbol, supply)
2. Trust Rating gauge (prominent)
3. Deployer FairScore card (full breakdown)
4. Holder Quality section (bar + top holders list)
5. Risk Flags section
6. Loading skeletons while data loads

**Commit:**
```bash
git add src/app/token/ src/hooks/useTokenAnalysis.ts
git commit -m "feat: build token lookup page with trust analysis"
```

---

## Task 14: Deployer Profile Page

**Files:**
- Create: `src/app/deployer/[wallet]/page.tsx`
- Create: `src/hooks/useDeployerProfile.ts`

Build from Figma design. Sections:
1. Wallet address + FairScore display
2. Score breakdown (base, social, combined)
3. Badges grid
4. Features metrics (wallet age, tx count, active days, etc.)
5. Deployed tokens list (TokenCards)

**Commit:**
```bash
git add src/app/deployer/ src/hooks/useDeployerProfile.ts
git commit -m "feat: build deployer profile page"
```

---

## Task 15: Dashboard Page

**Files:**
- Create: `src/app/dashboard/page.tsx`
- Create: `src/hooks/useWatchlist.ts`
- Create: `src/app/api/watchlist/route.ts`

Build from Figma design. Auth-required page. Sections:
1. User's FairScore display with tier badge
2. Tier benefits card (what they can access)
3. Watchlist grid (with add/remove functionality)
4. Quick token search

Watchlist API (`src/app/api/watchlist/route.ts`):
- GET: Fetch user's watchlist
- POST: Add token to watchlist
- DELETE: Remove token from watchlist

**Commit:**
```bash
git add src/app/dashboard/ src/hooks/useWatchlist.ts src/app/api/watchlist/
git commit -m "feat: build dashboard page with watchlist"
```

---

## Task 16: Search Page

**Files:**
- Create: `src/app/search/page.tsx`

Build from Figma design. Sections:
1. Large search bar at top
2. Filter controls (min trust rating, deployer tier)
3. Results grid of TokenCards
4. Empty state and loading state

**Commit:**
```bash
git add src/app/search/
git commit -m "feat: build search page with filters"
```

---

## Task 17: PostHog & Sentry Integration

**Files:**
- Create: `src/lib/posthog.ts`
- Create: `src/providers/PostHogProvider.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Set up PostHog**

Follow PostHog docs for Next.js App Router integration. Track:
- Page views
- Token lookups
- Wallet connections
- Search queries

**Step 2: Set up Sentry**

```bash
npx @sentry/wizard@latest -i nextjs
```

Configure error tracking for API routes and client-side errors.

**Step 3: Commit**

```bash
git add src/lib/posthog.ts src/providers/PostHogProvider.tsx sentry.* next.config.*
git commit -m "feat: add PostHog analytics and Sentry error tracking"
```

---

## Task 18: Deploy to Vercel

**Step 1: Push to GitHub**

```bash
git remote add origin <github-repo-url>
git push -u origin main
```

**Step 2: Deploy**

- Connect repo to Vercel
- Set environment variables in Vercel dashboard
- Deploy

**Step 3: Verify live URL works**

Test all pages and API routes on production URL.

**Step 4: Commit any deployment fixes**

---

## Task 19: Linear Project Setup

**Files:** None (Linear MCP)

**Step 1: Create Linear project**

Use `mcp__plugin_linear_linear__create_project` to create "TokenTrust" project under the "Bounties" team.

**Step 2: Create milestone**

Use `mcp__plugin_linear_linear__create_milestone` for "MVP Launch" targeting March 1, 2026.

**Step 3: Create issues for remaining work**

Create issues for each remaining task/feature to track progress and demonstrate team commitment (10% of judging).

---

## Execution Order Summary

| Day | Tasks | Focus |
|-----|-------|-------|
| 1 | 1-3, 19 | Scaffolding, Supabase, Linear setup |
| 2 | 4-6 | Service layer (FairScale, Helius, Analyzer) |
| 3 | 7-8 | API routes, Auth setup |
| 4 | 9 | Figma designs for all pages |
| 5 | 10-11 | Layout + Feature components |
| 6 | 12-13 | Landing page, Token Lookup page |
| 7 | 14-16 | Deployer, Dashboard, Search pages |
| 8 | 17-18 | PostHog, Sentry, Deploy to Vercel |
| 9 | — | Demo video, pitch deck, Legends.fun listing |
