/**
 * Token Analyzer service — combines Helius token data with FairScale
 * reputation scores to produce a comprehensive trust analysis for any
 * Solana token.
 *
 * Trust Rating Weights:
 *   Deployer FairScore:  15%
 *   Holder Quality:      25%
 *   Distribution:        20%
 *   Wallet Age:          10%
 *   Safety Signals:      20%
 *   Liquidity:           10%
 *
 * Results are cached in the Supabase `token_analyses` table.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getTokenMetadata,
  getTokenHolders,
  identifyDeployer,
  analyzeHolders,
  type TokenMetadata,
  type TokenHolder,
  type LPVault,
} from "@/services/helius";
import {
  getTokenLiquidity,
  type TokenLiquidity,
} from "@/services/dexscreener";
import { isJupiterVerified } from "@/services/jupiter";
import { getRugCheckReport, type RugCheckResult } from "@/services/rugcheck";
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

  /** DexScreener liquidity data, if available. */
  liquidity: TokenLiquidity | null;
  /** Percentage of supply in LP vaults. */
  lpSupplyPercent: number;
  /** Identified LP vault positions. */
  lpVaults: LPVault[];

  /** Whether the token is in Jupiter's verified list. */
  jupiterVerified: boolean;
  /** RugCheck risk assessment, if available. */
  rugCheck: RugCheckResult | null;
  /** Token creation timestamp (ISO), if detected. */
  tokenCreatedAt: string | null;
  /** Token age in days. */
  tokenAgeDays: number | null;
  /** Whether mint authority is still active. */
  mintAuthorityActive: boolean;
  /** Whether freeze authority is still active. */
  freezeAuthorityActive: boolean;

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
  holderQuality: 0.25,
  distribution: 0.20,
  age: 0.10,
  patterns: 0.20,
  liquidity: 0.10,
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
 * Compute a wallet age signal (0-100) using real FairScale features.
 * Falls back to neutral 50 if features are unavailable.
 */
function computeAgeComponent(
  walletAgeDays: number | null,
  activeDays: number | null
): number {
  if (walletAgeDays === null) return 50;

  let score: number;
  if (walletAgeDays > 365) score = 90;
  else if (walletAgeDays > 180) score = 70 + ((walletAgeDays - 180) / 185) * 20;
  else if (walletAgeDays > 30) score = 30 + ((walletAgeDays - 30) / 150) * 40;
  else score = (walletAgeDays / 30) * 30;

  // Bonus for active usage
  if (activeDays !== null && activeDays > 100) {
    score = Math.min(100, score + 10);
  }

  return Math.round(score);
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

/**
 * Compute liquidity score (0-100) based on DexScreener data and LP vault positions.
 * Tokens with more liquidity and healthy volume/liquidity ratios score higher.
 */
function computeLiquidityComponent(
  dexData: TokenLiquidity | null,
  lpSupplyPercent: number
): number {
  if (!dexData) {
    if (lpSupplyPercent > 20) return 60;
    if (lpSupplyPercent > 5) return 40;
    return 20;
  }

  const liq = dexData.totalLiquidityUsd;
  let score: number;

  if (liq > 100_000) score = 100;
  else if (liq > 10_000) score = 60 + ((liq - 10_000) / 90_000) * 40;
  else if (liq > 1_000) score = 20 + ((liq - 1_000) / 9_000) * 40;
  else score = (liq / 1_000) * 20;

  if (dexData.volumeLiquidityRatio > 0.5) {
    score = Math.min(100, score + 10);
  }

  return Math.round(score);
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
        liquidity: null,
        lpSupplyPercent: 0,
        lpVaults: [],
        jupiterVerified: false,
        rugCheck: null,
        tokenCreatedAt: null,
        tokenAgeDays: null,
        mintAuthorityActive: false,
        freezeAuthorityActive: false,
        analyzedAt: cached.analyzed_at,
      };
    }
  }

  // 2. Fetch token metadata
  const metadata = await getTokenMetadata(mint);
  if (!metadata) return null;

  // 3. Fetch top holders
  const holders = await getTokenHolders(mint, 20);

  // 3b. Analyze holders for LP vaults
  const holderAnalysis = analyzeHolders(holders);

  // 4. Fetch deployer score + DexScreener liquidity in parallel
  const deployerWallet = identifyDeployer(metadata);

  const [deployerResult, dexData, jupiterVerified, rugCheckResult] = await Promise.all([
    (async () => {
      if (!deployerWallet) return { score: null, tier: null, features: null };
      const fullScore = await getFullScore(deployerWallet);
      if (!fullScore) return { score: null, tier: null, features: null };
      return {
        score: fullScore.integerScore,
        tier: fullScore.tier,
        features: fullScore.features ?? null,
      };
    })(),
    getTokenLiquidity(mint),
    isJupiterVerified(mint),
    getRugCheckReport(mint),
  ]);

  let deployerScore: number | null = deployerResult.score;
  let deployerTier: FairScoreTier | null = deployerResult.tier;
  const deployerFeatures = deployerResult.features;

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
  const ageComponent = computeAgeComponent(
    deployerFeatures?.wallet_age_days ?? null,
    deployerFeatures?.active_days ?? null
  );
  const patternComponent = computePatternComponent(riskFlags);
  const liquidityComponent = computeLiquidityComponent(
    dexData,
    holderAnalysis.lpSupplyPercent
  );

  const trustRating = Math.round(
    deployerComponent * WEIGHTS.deployerScore +
      holderQualityComponent * WEIGHTS.holderQuality +
      distributionComponent * WEIGHTS.distribution +
      ageComponent * WEIGHTS.age +
      patternComponent * WEIGHTS.patterns +
      liquidityComponent * WEIGHTS.liquidity
  );

  const topHolderConcentration = holders[0]?.percentage ?? 0;
  const holderQualityScore = Math.round(holderQualityComponent);
  const analyzedAt = new Date().toISOString();

  // Compute token age from metadata
  const tokenCreatedAtRaw = (metadata.raw as unknown as Record<string, unknown>)?.created_at ?? null;
  const tokenCreatedAt = tokenCreatedAtRaw ? new Date(tokenCreatedAtRaw as string).toISOString() : null;
  const tokenAgeDays = tokenCreatedAt
    ? Math.floor((Date.now() - new Date(tokenCreatedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;

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

  // Log token score history (one snapshot per token per day)
  const today = new Date().toISOString().slice(0, 10);
  const { data: existingSnapshot } = await supabase
    .from("token_score_history")
    .select("id")
    .eq("mint", mint)
    .gte("recorded_at", `${today}T00:00:00Z`)
    .lt("recorded_at", `${today}T23:59:59Z`)
    .limit(1)
    .maybeSingle();

  if (!existingSnapshot) {
    await supabase.from("token_score_history").insert({
      mint,
      trust_rating: trustRating,
      holder_count: holders.length,
      risk_flag_count: riskFlags.length,
    });
  }

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
    liquidity: dexData,
    lpSupplyPercent: holderAnalysis.lpSupplyPercent,
    lpVaults: holderAnalysis.lpVaults,
    jupiterVerified,
    rugCheck: rugCheckResult,
    tokenCreatedAt,
    tokenAgeDays,
    mintAuthorityActive: !!metadata.mintAuthority,
    freezeAuthorityActive: !!metadata.freezeAuthority,
    analyzedAt,
  };
}
