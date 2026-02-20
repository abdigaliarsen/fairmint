/**
 * Token Analyzer service — combines Helius token data with FairScale
 * reputation scores to produce a comprehensive trust analysis for any
 * Solana token.
 *
 * Trust Rating Weights:
 *   Deployer FairScore:  15%
 *   Holder Quality:      30%
 *   Distribution:        20%
 *   Wallet Age:          15%
 *   Safety Signals:      20%
 *
 * Results are cached in the Supabase `token_analyses` table.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getTokenMetadata,
  getTokenHolders,
  identifyDeployer,
  type TokenMetadata,
  type TokenHolder,
} from "@/services/helius";
import {
  getFullScore,
  getQuickScore,
  classifyTier,
} from "@/services/fairscale";
import type {
  RiskFlag,
  FairScoreTier,
  TokenAnalysisInsert,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrustAnalysis {
  /** Token mint address. */
  mint: string;
  /** Token display name. */
  name: string | null;
  /** Token ticker symbol. */
  symbol: string | null;
  /** Token image URL. */
  imageUrl: string | null;

  /** Deployer / update authority wallet. */
  deployerWallet: string | null;
  /** Deployer FairScore (integer 0-1000+). */
  deployerScore: number | null;
  /** Deployer trust tier. */
  deployerTier: FairScoreTier | null;

  /** Composite trust rating (0-100). */
  trustRating: number;
  /** Average quality score of top holders (0-100). */
  holderQualityScore: number;
  /** Total number of holders sampled. */
  holderCount: number;
  /** Concentration of the top holder as a percentage of sampled supply. */
  topHolderConcentration: number;

  /** Detected risk flags. */
  riskFlags: RiskFlag[];

  /** Timestamp of the analysis. */
  analyzedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANALYSIS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Trust rating weight factors (must sum to 1.0). */
const WEIGHTS = {
  deployerScore: 0.15,
  holderQuality: 0.3,
  distribution: 0.2,
  age: 0.15,
  patterns: 0.2,
} as const;

// ---------------------------------------------------------------------------
// Risk Flag Detection
// ---------------------------------------------------------------------------

let riskFlagCounter = 0;

function makeRiskFlag(
  severity: RiskFlag["severity"],
  label: string,
  description: string
): RiskFlag {
  riskFlagCounter += 1;
  return {
    id: `rf-${riskFlagCounter}`,
    severity,
    label,
    description,
  };
}

function detectRiskFlags(
  deployerScore: number | null,
  deployerTier: FairScoreTier | null,
  holders: TokenHolder[],
  metadata: TokenMetadata
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  // 1. Low deployer score — only flag truly low scores.
  // Many legitimate token deployers are program wallets with low FairScale
  // scores, so this flag is informational rather than alarming.
  if (deployerScore !== null && deployerScore < 100) {
    flags.push(
      makeRiskFlag(
        "medium",
        "Low Deployer Score",
        `The token deployer has a FairScore of ${deployerScore}.`
      )
    );
  }

  // 2. Concentrated holdings — top holder owns >50%
  if (holders.length > 0) {
    const topHolder = holders[0];
    if (topHolder.percentage > 80) {
      flags.push(
        makeRiskFlag(
          "high",
          "Concentrated Holdings",
          `The top holder owns ${topHolder.percentage.toFixed(1)}% of the sampled supply.`
        )
      );
    } else if (topHolder.percentage > 50) {
      flags.push(
        makeRiskFlag(
          "medium",
          "Concentrated Holdings",
          `The top holder owns ${topHolder.percentage.toFixed(1)}% of the sampled supply.`
        )
      );
    } else if (topHolder.percentage > 25) {
      flags.push(
        makeRiskFlag(
          "low",
          "Significant Concentration",
          `The top holder owns ${topHolder.percentage.toFixed(1)}% of the sampled supply.`
        )
      );
    }
  }

  // 4. Very few holders
  if (holders.length < 5) {
    flags.push(
      makeRiskFlag(
        "medium",
        "Low Holder Count",
        `Only ${holders.length} holder(s) found, indicating very low distribution.`
      )
    );
  }

  // 5. Mint authority still active (potential for infinite minting)
  if (metadata.mintAuthority) {
    flags.push(
      makeRiskFlag(
        "low",
        "Active Mint Authority",
        "The token still has an active mint authority, allowing additional supply to be minted."
      )
    );
  }

  // 6. Freeze authority still active
  if (metadata.freezeAuthority) {
    flags.push(
      makeRiskFlag(
        "low",
        "Active Freeze Authority",
        "The token has an active freeze authority, which can freeze holder accounts."
      )
    );
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Score component calculators
// ---------------------------------------------------------------------------

/**
 * Normalize a deployer score (0-1000+) to a 0-100 scale.
 * Unknown deployers get a neutral score of 50 — most legitimate token
 * deployers are program wallets that don't actively trade, so absence
 * of a FairScale score is normal, not suspicious.
 */
function computeDeployerComponent(deployerScore: number | null): number {
  if (deployerScore === null) return 50;
  // Use a generous curve: any deployer with a FairScale score gets at least 30.
  // Gold (600+) maps to 80+, Platinum (850+) approaches 100.
  return Math.max(30, Math.min(100, (deployerScore / 850) * 100));
}

/**
 * Compute average holder quality from FairScale quick scores.
 * Returns a 0-100 value. Unknown holders are treated as 50 (neutral) —
 * many legitimate holders are protocol vaults or institutional wallets
 * that don't have FairScale scores.
 */
function computeHolderQualityComponent(
  holderScores: Array<{ score: number | null }>
): number {
  if (holderScores.length === 0) return 50;

  const total = holderScores.reduce((sum, h) => {
    const normalized =
      h.score !== null ? Math.min(100, (h.score / 1000) * 100) : 50;
    return sum + normalized;
  }, 0);

  return total / holderScores.length;
}

/**
 * Compute distribution score (0-100) based on how spread out holdings are.
 * A perfectly even distribution gets 100; single-holder gets ~0.
 */
function computeDistributionComponent(holders: TokenHolder[]): number {
  if (holders.length <= 1) return 0;

  // Use a simplified Gini-like measure: invert top holder concentration
  const topConcentration = holders[0]?.percentage ?? 100;
  // If top holder has 100%, score is 0. If top holder has 0%, score is 100.
  const baseScore = Math.max(0, 100 - topConcentration);

  // Bonus for having more holders
  const holderBonus = Math.min(20, holders.length);

  return Math.min(100, baseScore + holderBonus);
}

/**
 * Compute a wallet age signal (0-100).
 * Currently a placeholder that returns a neutral 50 since we don't
 * have direct wallet creation date data without extra API calls.
 */
function computeAgeComponent(): number {
  // TODO: Enhance with actual wallet creation date from Helius
  // transaction history or on-chain data.
  return 50;
}

/**
 * Compute pattern-based signals (0-100).
 * Penalizes for risk flags that indicate suspicious patterns.
 */
function computePatternComponent(riskFlags: RiskFlag[]): number {
  let score = 100;

  for (const flag of riskFlags) {
    switch (flag.severity) {
      case "critical":
        score -= 30;
        break;
      case "high":
        score -= 20;
        break;
      case "medium":
        score -= 10;
        break;
      case "low":
        score -= 5;
        break;
    }
  }

  return Math.max(0, score);
}

// ---------------------------------------------------------------------------
// analyzeToken — main entry point
// ---------------------------------------------------------------------------

/**
 * Perform a full trust analysis on a Solana token.
 *
 * 1. Check Supabase cache (1-hour TTL)
 * 2. Fetch token metadata from Helius
 * 3. Fetch top holders from Helius
 * 4. Fetch deployer FairScore
 * 5. Fetch holder FairScores (batch quick scores)
 * 6. Detect risk flags
 * 7. Calculate composite trust rating
 * 8. Cache results in Supabase
 *
 * Returns `null` if the token is not found.
 */
export async function analyzeToken(
  mint: string
): Promise<TrustAnalysis | null> {
  const supabase = createServerSupabaseClient();

  // 1. Check cache
  const { data: cached } = await supabase
    .from("token_analyses")
    .select("*")
    .eq("mint", mint)
    .order("analyzed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached) {
    const age = Date.now() - new Date(cached.analyzed_at).getTime();
    if (age < ANALYSIS_CACHE_TTL_MS) {
      return {
        mint: cached.mint,
        name: cached.name,
        symbol: cached.symbol,
        imageUrl: cached.image_url,
        deployerWallet: cached.deployer_wallet,
        deployerScore: cached.deployer_score,
        deployerTier: cached.deployer_tier,
        trustRating: cached.trust_rating,
        holderQualityScore: cached.holder_quality_score,
        holderCount: cached.holder_count,
        topHolderConcentration: cached.top_holder_concentration,
        riskFlags: (cached.risk_flags ?? []) as RiskFlag[],
        analyzedAt: cached.analyzed_at,
      };
    }
  }

  // 2. Fetch token metadata
  const metadata = await getTokenMetadata(mint);
  if (!metadata) return null;

  // 3. Fetch top holders
  const holders = await getTokenHolders(mint, 20);

  // 4. Identify deployer and fetch their score
  const deployerWallet = identifyDeployer(metadata);
  let deployerScore: number | null = null;
  let deployerTier: FairScoreTier | null = null;

  if (deployerWallet) {
    const fullScore = await getFullScore(deployerWallet);
    if (fullScore) {
      deployerScore = fullScore.integerScore;
      deployerTier = fullScore.tier;
    }
  }

  // 5. Fetch holder FairScores (quick scores for the top holders)
  const holderScores = await Promise.all(
    holders.slice(0, 10).map(async (holder) => {
      const score = await getQuickScore(holder.owner);
      return { owner: holder.owner, score };
    })
  );

  // 6. Detect risk flags
  const riskFlags = detectRiskFlags(
    deployerScore,
    deployerTier,
    holders,
    metadata
  );

  // 7. Calculate composite trust rating
  const deployerComponent = computeDeployerComponent(deployerScore);
  const holderQualityComponent = computeHolderQualityComponent(holderScores);
  const distributionComponent = computeDistributionComponent(holders);
  const ageComponent = computeAgeComponent();
  const patternComponent = computePatternComponent(riskFlags);

  const trustRating = Math.round(
    deployerComponent * WEIGHTS.deployerScore +
      holderQualityComponent * WEIGHTS.holderQuality +
      distributionComponent * WEIGHTS.distribution +
      ageComponent * WEIGHTS.age +
      patternComponent * WEIGHTS.patterns
  );

  const topHolderConcentration = holders[0]?.percentage ?? 0;
  const holderQualityScore = Math.round(holderQualityComponent);
  const analyzedAt = new Date().toISOString();

  // 8. Cache result in Supabase
  const analysisRow: TokenAnalysisInsert = {
    mint,
    name: metadata.name || null,
    symbol: metadata.symbol || null,
    image_url: metadata.image,
    deployer_wallet: deployerWallet,
    deployer_score: deployerScore,
    deployer_tier: deployerTier,
    trust_rating: trustRating,
    holder_quality_score: holderQualityScore,
    holder_count: holders.length,
    top_holder_concentration: topHolderConcentration,
    risk_flags: riskFlags,
    raw_metadata: metadata.raw as unknown as Record<string, unknown>,
    analyzed_at: analyzedAt,
  };

  await supabase
    .from("token_analyses")
    .upsert(analysisRow, { onConflict: "mint" })
    .select()
    .maybeSingle();

  return {
    mint,
    name: metadata.name || null,
    symbol: metadata.symbol || null,
    imageUrl: metadata.image,
    deployerWallet,
    deployerScore,
    deployerTier,
    trustRating,
    holderQualityScore,
    holderCount: holders.length,
    topHolderConcentration,
    riskFlags,
    analyzedAt,
  };
}
