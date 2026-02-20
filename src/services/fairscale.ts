/**
 * FairScale service — fetches and caches wallet reputation scores from the
 * FairScale API (https://api.fairscale.xyz).
 *
 * Endpoints used:
 *   /score       — full profile, decimal score (0-100)
 *   /fairScore   — lightweight integer score (0-1000+)
 *   /walletScore — wallet-only integer score
 *
 * Results from /score are cached in the Supabase `cached_scores` table
 * with a 1-hour TTL to respect rate limits.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  FairScoreTier,
  FairScoreData,
  Badge,
  CachedScoreInsert,
} from "@/types/database";

const FAIRSCALE_BASE_URL = "https://api.fairscale.xyz";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Tier classification
// ---------------------------------------------------------------------------

/**
 * Classify an integer FairScale score into a trust tier.
 *
 * Thresholds (integer scale 0-1000+):
 *   Platinum: 850+
 *   Gold:     600+
 *   Silver:   300+
 *   Bronze:   0+
 */
export function classifyTier(score: number): FairScoreTier {
  if (score >= 850) return "platinum";
  if (score >= 600) return "gold";
  if (score >= 300) return "silver";
  if (score >= 0) return "bronze";
  return "unrated";
}

// ---------------------------------------------------------------------------
// Tier colors (Tailwind classes)
// ---------------------------------------------------------------------------

interface TierColors {
  text: string;
  bg: string;
  border: string;
}

const TIER_COLOR_MAP: Record<FairScoreTier, TierColors> = {
  unrated: {
    text: "text-gray-500",
    bg: "bg-gray-100",
    border: "border-gray-300",
  },
  bronze: {
    text: "text-amber-600",
    bg: "bg-amber-100",
    border: "border-amber-300",
  },
  silver: {
    text: "text-slate-500",
    bg: "bg-slate-100",
    border: "border-slate-300",
  },
  gold: {
    text: "text-yellow-500",
    bg: "bg-yellow-50",
    border: "border-yellow-300",
  },
  platinum: {
    text: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-300",
  },
};

/**
 * Get the Tailwind CSS classes for a given trust tier.
 */
export function getTierColor(tier: FairScoreTier): TierColors {
  return TIER_COLOR_MAP[tier];
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function getFairScaleApiKey(): string {
  const key = process.env.FAIRSCALE_API_KEY;
  if (!key) {
    throw new Error("Missing environment variable: FAIRSCALE_API_KEY");
  }
  return key;
}

async function fairscaleFetch<T>(
  endpoint: string,
  wallet: string
): Promise<T | null> {
  const url = `${FAIRSCALE_BASE_URL}${endpoint}?wallet=${encodeURIComponent(wallet)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        fairkey: getFairScaleApiKey(),
        "Content-Type": "application/json",
      },
    });

    if (response.status === 404) {
      // Unknown wallet — return null gracefully
      return null;
    }

    if (!response.ok) {
      console.error(
        `FairScale ${endpoint} error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(`FairScale ${endpoint} fetch failed:`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// getFullScore — cached full profile via /score
// ---------------------------------------------------------------------------

interface FairScaleScoreResponse {
  wallet: string;
  score: number;
  badges?: Array<{
    id: string;
    label: string;
    description: string;
    tier: string;
    awardedAt: string;
  }>;
  [key: string]: unknown;
}

/**
 * Fetch the full FairScale score for a wallet.
 *
 * Checks the Supabase cache first. If the cached entry is less than 1 hour
 * old, it is returned directly. Otherwise, the FairScale `/score` endpoint
 * is called, the result is cached, and a `FairScoreData` object is returned.
 *
 * Returns `null` for unknown wallets (404) or on any fetch failure.
 */
export async function getFullScore(
  wallet: string
): Promise<FairScoreData | null> {
  const supabase = createServerSupabaseClient();

  // 1. Check cache
  const { data: cached } = await supabase
    .from("cached_scores")
    .select("*")
    .eq("wallet", wallet)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (age < CACHE_TTL_MS) {
      return {
        wallet: cached.wallet,
        score: cached.score_decimal,
        tier: cached.tier,
        badges: (cached.badges ?? []) as Badge[],
        updatedAt: cached.fetched_at,
        decimalScore: cached.score_decimal,
        integerScore: cached.score_integer,
      };
    }
  }

  // 2. Fetch from FairScale /score
  const data = await fairscaleFetch<FairScaleScoreResponse>("/score", wallet);
  if (!data) return null;

  // The /score endpoint returns a decimal score (0-100).
  // Also fetch the integer score for tier classification.
  const integerScore = await getQuickScore(wallet);
  const effectiveIntegerScore = integerScore ?? Math.round(data.score * 10);
  const tier = classifyTier(effectiveIntegerScore);

  const badges: Badge[] = (data.badges ?? []).map((b) => ({
    id: b.id,
    label: b.label,
    description: b.description,
    tier: (b.tier as FairScoreTier) || "bronze",
    awardedAt: b.awardedAt,
  }));

  // 3. Upsert cache
  const cacheRow: CachedScoreInsert = {
    wallet,
    score_decimal: data.score,
    score_integer: effectiveIntegerScore,
    tier,
    badges,
    raw_response: data as unknown as Record<string, unknown>,
    fetched_at: new Date().toISOString(),
  };

  await supabase
    .from("cached_scores")
    .upsert(cacheRow, { onConflict: "wallet" })
    .select()
    .maybeSingle();

  return {
    wallet,
    score: data.score,
    tier,
    badges,
    updatedAt: cacheRow.fetched_at,
    decimalScore: data.score,
    integerScore: effectiveIntegerScore,
  };
}

// ---------------------------------------------------------------------------
// getQuickScore — lightweight integer score via /fairScore
// ---------------------------------------------------------------------------

interface FairScaleQuickResponse {
  score: number;
  [key: string]: unknown;
}

/**
 * Fetch a lightweight integer score (0-1000+) from the FairScale
 * `/fairScore` endpoint. Suitable for batch / holder analysis.
 *
 * Returns `null` for unknown wallets or on failure.
 */
export async function getQuickScore(wallet: string): Promise<number | null> {
  const data = await fairscaleFetch<FairScaleQuickResponse>(
    "/fairScore",
    wallet
  );
  return data?.score ?? null;
}

// ---------------------------------------------------------------------------
// getWalletScore — wallet-only score via /walletScore
// ---------------------------------------------------------------------------

interface FairScaleWalletResponse {
  score: number;
  [key: string]: unknown;
}

/**
 * Fetch a wallet-only score from the FairScale `/walletScore` endpoint.
 *
 * Returns `null` for unknown wallets or on failure.
 */
export async function getWalletScore(wallet: string): Promise<number | null> {
  const data = await fairscaleFetch<FairScaleWalletResponse>(
    "/walletScore",
    wallet
  );
  return data?.score ?? null;
}
