/**
 * Jupiter service — checks if a token is in Jupiter's verified token list
 * and fetches recently-listed tokens.
 *
 * Verified list: free API, no key required. Cached in-memory for 1 hour.
 * Recent tokens: requires JUPITER_API_KEY. Cached in-memory for 5 minutes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JupiterRecentToken {
  mint: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Verified list cache (1 hour)
// ---------------------------------------------------------------------------

let cachedTokens: Set<string> | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Recent tokens cache (5 minutes)
// ---------------------------------------------------------------------------

let recentTokensCache: JupiterRecentToken[] | null = null;
let recentCachedAt = 0;
const RECENT_CACHE_TTL_MS = 5 * 60 * 1000;

export async function isJupiterVerified(mint: string): Promise<boolean> {
  try {
    const now = Date.now();
    if (cachedTokens && now - cachedAt < CACHE_TTL_MS) {
      return cachedTokens.has(mint);
    }

    const apiKey = process.env.JUPITER_API_KEY;
    const headers: Record<string, string> = {};
    if (apiKey) headers["x-api-key"] = apiKey;

    const res = await fetch("https://api.jup.ag/tokens/v2/tag?query=verified", {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return false;

    const tokens = (await res.json()) as Array<{ address?: string; mint?: string }>;
    cachedTokens = new Set(tokens.map((t) => t.address ?? t.mint ?? ""));
    cachedAt = now;

    return cachedTokens.has(mint);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Recent tokens
// ---------------------------------------------------------------------------

/**
 * Fetch recently-listed tokens from Jupiter's v2 API.
 * Requires JUPITER_API_KEY env var. Returns up to `limit` tokens.
 */
export async function fetchRecentTokens(
  limit: number = 20
): Promise<JupiterRecentToken[]> {
  try {
    const now = Date.now();
    if (recentTokensCache && now - recentCachedAt < RECENT_CACHE_TTL_MS) {
      return recentTokensCache.slice(0, limit);
    }

    const apiKey = process.env.JUPITER_API_KEY;
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    const res = await fetch("https://api.jup.ag/tokens/v2/recent", {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error(`Jupiter recent tokens API returned ${res.status}`);
      return [];
    }

    const tokens = (await res.json()) as JupiterRecentToken[];
    recentTokensCache = tokens;
    recentCachedAt = now;

    return tokens.slice(0, limit);
  } catch (error) {
    console.error("Failed to fetch recent tokens from Jupiter:", error);
    return [];
  }
}
