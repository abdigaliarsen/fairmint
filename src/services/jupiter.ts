/**
 * Jupiter service — checks if a token is in Jupiter's verified token list.
 * Free API, no key required. Results cached in-memory for 1 hour.
 */

let cachedTokens: Set<string> | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function isJupiterVerified(mint: string): Promise<boolean> {
  try {
    const now = Date.now();
    if (cachedTokens && now - cachedAt < CACHE_TTL_MS) {
      return cachedTokens.has(mint);
    }

    const res = await fetch("https://lite-api.jup.ag/tokens/v1", {
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return false;

    const tokens = (await res.json()) as Array<{ address: string }>;
    cachedTokens = new Set(tokens.map((t) => t.address));
    cachedAt = now;

    return cachedTokens.has(mint);
  } catch {
    return false;
  }
}
