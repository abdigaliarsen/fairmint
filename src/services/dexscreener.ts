/**
 * DexScreener service — fetches token trading pair data from the
 * DexScreener public API. No API key required.
 *
 * Results are cached in Supabase with a 1-hour TTL to avoid
 * rate limits and slow responses.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DexScreenerProfile {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  description?: string;
  links?: Array<{ type: string; label: string; url: string }>;
}

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd: string;
  volume: { h24: number; h6: number; h1: number; m5: number };
  liquidity: { usd: number; base: number; quote: number };
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
  labels?: string[];
}

export interface TokenLiquidity {
  /** Total liquidity across all pools (USD). */
  totalLiquidityUsd: number;
  /** 24-hour trading volume (USD). */
  volume24h: number;
  /** Volume / Liquidity ratio — healthy if > 0.5. */
  volumeLiquidityRatio: number;
  /** Number of trading pools on DEXes. */
  poolCount: number;
  /** Primary DEX by liquidity. */
  primaryDex: string | null;
  /** Fully diluted valuation (USD). */
  fdv: number;
  /** Market capitalization (USD). */
  marketCap: number;
  /** Current price (USD). */
  priceUsd: number;
  /** Timestamp of when this data was fetched. */
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEXSCREENER_BASE_URL = "https://api.dexscreener.com/tokens/v1/solana";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Latest profiles cache (5 minutes)
// ---------------------------------------------------------------------------

let profilesCache: DexScreenerProfile[] | null = null;
let profilesCachedAt = 0;
const PROFILES_CACHE_TTL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Fetch + Cache
// ---------------------------------------------------------------------------

/**
 * Fetch token liquidity data from DexScreener, cached in Supabase.
 * Returns null if no pairs found or on failure.
 */
export async function getTokenLiquidity(
  mint: string
): Promise<TokenLiquidity | null> {
  const supabase = createServerSupabaseClient();

  // 1. Check cache
  const { data: cached } = await supabase
    .from("dexscreener_cache")
    .select("*")
    .eq("mint", mint)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (age < CACHE_TTL_MS) {
      return cached.data as TokenLiquidity;
    }
  }

  // 2. Fetch from DexScreener
  try {
    const response = await fetch(`${DEXSCREENER_BASE_URL}/${mint}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const pairs: DexScreenerPair[] = await response.json();
    if (!pairs || pairs.length === 0) return null;

    // Aggregate across all pairs
    const totalLiquidityUsd = pairs.reduce(
      (sum, p) => sum + (p.liquidity?.usd ?? 0),
      0
    );
    const volume24h = pairs.reduce(
      (sum, p) => sum + (p.volume?.h24 ?? 0),
      0
    );

    // Find primary DEX by liquidity
    const sortedByLiquidity = [...pairs].sort(
      (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
    );
    const primaryDex = sortedByLiquidity[0]?.dexId ?? null;

    // Use the highest-liquidity pair for price/fdv/mcap
    const topPair = sortedByLiquidity[0];

    const result: TokenLiquidity = {
      totalLiquidityUsd,
      volume24h,
      volumeLiquidityRatio:
        totalLiquidityUsd > 0 ? volume24h / totalLiquidityUsd : 0,
      poolCount: pairs.length,
      primaryDex,
      fdv: topPair?.fdv ?? 0,
      marketCap: topPair?.marketCap ?? 0,
      priceUsd: parseFloat(topPair?.priceUsd ?? "0"),
      fetchedAt: new Date().toISOString(),
    };

    // 3. Cache result
    await supabase.from("dexscreener_cache").upsert(
      {
        mint,
        data: result as unknown as Record<string, unknown>,
        fetched_at: result.fetchedAt,
      },
      { onConflict: "mint" }
    );

    return result;
  } catch (error) {
    console.error(`DexScreener fetch failed for ${mint}:`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Latest token profiles
// ---------------------------------------------------------------------------

/**
 * Fetch the latest token profiles from DexScreener, filtered to Solana.
 * No API key required. Returns up to `limit` profiles.
 */
export async function fetchLatestProfiles(
  limit: number = 20
): Promise<DexScreenerProfile[]> {
  try {
    const now = Date.now();
    if (profilesCache && now - profilesCachedAt < PROFILES_CACHE_TTL_MS) {
      return profilesCache.slice(0, limit);
    }

    const res = await fetch(
      "https://api.dexscreener.com/token-profiles/latest/v1",
      { signal: AbortSignal.timeout(10_000) }
    );

    if (!res.ok) {
      console.error(`DexScreener profiles API returned ${res.status}`);
      return [];
    }

    const profiles = (await res.json()) as DexScreenerProfile[];
    const solanaProfiles = profiles.filter((p) => p.chainId === "solana");

    profilesCache = solanaProfiles;
    profilesCachedAt = now;

    return solanaProfiles.slice(0, limit);
  } catch (error) {
    console.error("Failed to fetch latest profiles from DexScreener:", error);
    return [];
  }
}
