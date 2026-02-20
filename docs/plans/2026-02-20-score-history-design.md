# Historical Score Tracking — Design

## Goal

Track FairScore and token trust rating changes over time, displayed as line charts on token, deployer, and reputation pages.

## Database

Two Supabase tables:

**`wallet_score_history`**
- `id` (serial PK)
- `wallet` (varchar 44)
- `score_decimal` (decimal) — FairScore 0-100
- `score_integer` (integer) — FairScore 0-1000+
- `tier` (varchar 20)
- `recorded_at` (timestamptz)
- Index on `(wallet, recorded_at)`
- Deduplicated: one snapshot per wallet per day max

**`token_score_history`**
- `id` (serial PK)
- `mint` (varchar 44)
- `trust_rating` (decimal) — 0-100
- `holder_count` (integer)
- `risk_flag_count` (integer)
- `recorded_at` (timestamptz)
- Index on `(mint, recorded_at)`
- Deduplicated: one snapshot per token per day max

## Data Collection

**Piggyback (organic):**
- `getFullScore()` in fairscale.ts: after fetching a wallet score, insert into `wallet_score_history` (skip if row exists for wallet today).
- `analyzeToken()` in tokenAnalyzer.ts: after computing trust rating, insert into `token_score_history` (skip if row exists for mint today).

**Cron (scheduled):**
- Existing `/api/cron/refresh-tokens` already re-analyzes 13 popular tokens. Token and deployer wallet snapshots logged automatically via piggyback hooks.

## API

- `GET /api/history/wallet?wallet=X` — returns last 30 days of wallet score history
- `GET /api/history/token?mint=X` — returns last 30 days of token score history

## UI

**ScoreHistoryChart** — shared Recharts LineChart component.

Props: `data` (array of `{date, score}`), `label` (string), `color` (string).

Features:
- Last 30 days, date on X-axis, score 0-100 on Y-axis
- Hover tooltip with exact date + score
- Single data point shows dot with "tracking started" note
- Responsive, works in Card layout

Placement:
- Token page: "Score History" card after Trust Rating
- Deployer page: "Score History" card after Score Breakdown
- Reputation page: "Score History" card after AI Analysis

## Dependencies

- `recharts` — React chart library
