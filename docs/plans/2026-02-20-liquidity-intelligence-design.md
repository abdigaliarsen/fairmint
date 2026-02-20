# Liquidity Intelligence Design

**Goal:** Surface FairScale wallet analytics and on-chain liquidity data to improve trust scoring and provide richer token/wallet analysis.

**Architecture:** Three workstreams—(1) extract and display FairScale `/score` features, (2) detect LP vault positions from Helius holder data + DexScreener supplementary data, (3) improve trust rating formula with real wallet age and liquidity components.

---

## Data Sources

### FairScale Features (already fetched, currently ignored)

The `/score` endpoint returns a `features` object with 15+ wallet metrics:

- `lst_percentile_score` — liquid staking token percentile (0-1)
- `major_percentile_score` — major token holdings percentile (0-1)
- `native_sol_percentile` — native SOL balance percentile (0-1)
- `stable_percentile_score` — stablecoin holdings percentile (0-1)
- `tx_count` — total transaction count
- `active_days` — number of days with on-chain activity
- `median_gap_hours` — median time between transactions
- `wallet_age_days` — wallet age in days

We already call `/score` and cache the raw response. We just need to extract and surface the `features` object.

### Helius LP Detection (primary liquidity source)

When we fetch token holders via `getTokenHolders()`, some holders are LP vault accounts owned by DEX programs:

- Raydium AMM: `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8`
- Raydium CLMM: `CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK`
- Orca Whirlpool: `whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc`
- Meteora DLMM: `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`

By identifying these accounts, we get: % of supply in LPs, which DEXes, number of pools. Combine with Jupiter Price API (`https://api.jup.ag/price/v2?ids={mint}`) for USD conversion.

### DexScreener (supplementary, cached)

`GET https://api.dexscreener.com/tokens/v1/solana/{mint}` returns volume, FDV, market cap, pool details. Cached in Supabase with 1-hour TTL to avoid rate limits and slow responses.

---

## UI Components

### Liquidity Card (Token Page)

Displayed on the token page showing:

- Total liquidity in LP pools (USD)
- % of token supply in liquidity pools
- Number of trading pools
- Primary DEX (Raydium, Orca, Meteora)
- 24h volume (from DexScreener cache)
- Volume/Liquidity ratio indicator
- FDV / Market Cap (from DexScreener cache)

### Wallet Analytics Card (Deployer + Reputation Pages)

**Radar chart** using Recharts `RadarChart` with 6 axes:

1. SOL Balance (`native_sol_percentile` x 100)
2. Major Tokens (`major_percentile_score` x 100)
3. Stablecoins (`stable_percentile_score` x 100)
4. Liquid Staking (`lst_percentile_score` x 100)
5. Activity (derived from `active_days` / `wallet_age_days`)
6. Transaction Volume (derived from `tx_count`)

Below the chart, raw stats: wallet age, tx count, active days, median gap hours.

---

## Trust Rating Changes

### Current Weights

| Component | Weight | Implementation |
|-----------|--------|----------------|
| Deployer Score | 15% | Real FairScale data |
| Holder Quality | 30% | Real FairScale data |
| Distribution | 20% | Real Helius data |
| Wallet Age | 15% | **Hardcoded to 50** |
| Safety Signals | 20% | Real risk flag data |

### New Weights

| Component | Weight | Implementation |
|-----------|--------|----------------|
| Deployer Score | 15% | Unchanged |
| Holder Quality | 25% | Reduced from 30% |
| Distribution | 20% | Unchanged |
| Wallet Age | 10% | **Real `wallet_age_days` + `active_days`** |
| Safety Signals | 20% | Unchanged |
| **Liquidity** | **10%** | **New: LP supply % + liquidity USD** |

### Age Component (improved)

Uses real `wallet_age_days` and `active_days` from FairScale features:

- Age > 365 days + 100+ active days: 100
- Age > 180 days: 70-90 scaled
- Age > 30 days: 30-70 scaled
- Age < 30 days: 0-30

### Liquidity Component (new)

- Liquidity > $100K: 100
- $10K-$100K: 60-100 scaled
- $1K-$10K: 20-60 scaled
- < $1K: 0-20
- Bonus for volume/liquidity ratio > 0.5

---

## Files

- **Modify:** `src/services/fairscale.ts` — extract and return features
- **Modify:** `src/services/helius.ts` — identify LP vault holders
- **Modify:** `src/services/tokenAnalyzer.ts` — new weights, liquidity component, age component
- **Modify:** `src/types/database.ts` — FairScoreData features type
- **Create:** `src/services/dexscreener.ts` — DexScreener fetch + cache
- **Create:** `src/components/features/WalletAnalyticsChart.tsx` — radar chart
- **Create:** `src/components/features/LiquidityCard.tsx` — liquidity display
- **Create:** `src/app/api/token/[mint]/liquidity/route.ts` — liquidity API
- **Modify:** `src/app/token/[mint]/page.tsx` — add LiquidityCard
- **Modify:** `src/app/deployer/[wallet]/page.tsx` — add WalletAnalyticsChart
- **Modify:** `src/app/reputation/[wallet]/page.tsx` — add WalletAnalyticsChart
