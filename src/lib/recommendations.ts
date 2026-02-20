import type { FairScoreData, FairScoreTier } from "@/types/database";
import type { TrustAnalysis } from "@/services/tokenAnalyzer";

export interface Recommendation {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  category: "score" | "defi" | "distribution" | "authority" | "social" | "age";
}

/**
 * Generate reputation improvement recommendations for a wallet.
 *
 * If the FairScale API returned `actions`, those are used directly.
 * Otherwise, falls back to heuristic-based tips.
 *
 * Tier gating controls detail level:
 *   - unrated/bronze: basic tips (top 3)
 *   - silver: detailed tips (top 5)
 *   - gold/platinum: full action plan (all)
 */
export function generateRecommendations(
  fairScore: FairScoreData | null,
  tokens?: TrustAnalysis[],
  tier?: FairScoreTier
): Recommendation[] {
  const effectiveTier = tier ?? fairScore?.tier ?? "unrated";

  // Use FairScale API actions when available
  if (fairScore?.actions && fairScore.actions.length > 0) {
    const recs: Recommendation[] = fairScore.actions.map((action) => ({
      id: action.id,
      priority: action.priority,
      title: action.label,
      description: action.description,
      category: "score" as const,
    }));

    // Add tier-push recommendation if not already covered by API actions
    if (fairScore.integerScore >= 300 && fairScore.integerScore < 600) {
      recs.push({
        id: "push-gold",
        priority: "medium",
        title: "Reach Gold tier",
        description:
          "You're Silver tier — keep building consistent on-chain activity to reach Gold (600+).",
        category: "score",
      });
    } else if (fairScore.integerScore >= 600 && fairScore.integerScore < 850) {
      recs.push({
        id: "push-platinum",
        priority: "low",
        title: "Reach Platinum tier",
        description:
          "You're Gold tier — maintain activity and earn more badges to reach Platinum (850+).",
        category: "score",
      });
    }

    return applyTierLimit(recs, effectiveTier);
  }

  // Fallback: heuristic-based recommendations
  const recs: Recommendation[] = [];

  if (!fairScore || effectiveTier === "unrated") {
    recs.push({
      id: "no-score",
      priority: "high",
      title: "Build on-chain history",
      description:
        "Your wallet has no FairScale reputation yet. Start by making transactions, interacting with DeFi protocols, and building on-chain activity.",
      category: "score",
    });
  }

  if (fairScore && fairScore.integerScore < 300) {
    recs.push({
      id: "low-score",
      priority: "high",
      title: "Increase DeFi activity",
      description:
        "Interact with more Solana DeFi protocols — swap tokens, provide liquidity, or stake SOL. Diverse activity signals trustworthiness.",
      category: "defi",
    });
  }

  if (!fairScore?.badges || fairScore.badges.length === 0) {
    recs.push({
      id: "no-badges",
      priority: "medium",
      title: "Complete social verification on FairScale",
      description:
        "Link your Twitter and Discord accounts on FairScale to earn verification badges that boost your reputation.",
      category: "social",
    });
  }

  if (tokens?.some((t) => t.topHolderConcentration > 25)) {
    recs.push({
      id: "concentration",
      priority: "medium",
      title: "Improve token distribution",
      description:
        "Some of your tokens have high holder concentration. Broader distribution signals healthier tokenomics.",
      category: "distribution",
    });
  }

  if (
    tokens?.some((t) =>
      t.riskFlags.some((f) => f.label === "Active Mint Authority")
    )
  ) {
    recs.push({
      id: "mint-authority",
      priority: "medium",
      title: "Renounce mint authority",
      description:
        "Tokens with active mint authority are flagged as risky. Renouncing it signals commitment and builds trust.",
      category: "authority",
    });
  }

  if (
    tokens?.some((t) =>
      t.riskFlags.some((f) => f.label === "Active Freeze Authority")
    )
  ) {
    recs.push({
      id: "freeze-authority",
      priority: "low",
      title: "Renounce freeze authority",
      description:
        "Removing freeze authority from your tokens removes a risk flag and improves holder confidence.",
      category: "authority",
    });
  }

  if (
    fairScore &&
    fairScore.integerScore >= 300 &&
    fairScore.integerScore < 600
  ) {
    recs.push({
      id: "push-gold",
      priority: "medium",
      title: "Reach Gold tier",
      description:
        "You're Silver tier — keep building consistent on-chain activity and attract higher-reputation holders to reach Gold (600+).",
      category: "score",
    });
  }

  if (
    fairScore &&
    fairScore.integerScore >= 600 &&
    fairScore.integerScore < 850
  ) {
    recs.push({
      id: "push-platinum",
      priority: "low",
      title: "Reach Platinum tier",
      description:
        "You're Gold tier — maintain activity, earn more badges, and attract high-reputation holders to reach Platinum (850+).",
      category: "score",
    });
  }

  return applyTierLimit(recs, effectiveTier);
}

/**
 * Generate actionable tips for a specific token based on its trust analysis.
 * These help deployers improve their token's trust rating and help investors
 * understand what would make the token more trustworthy.
 */
export function generateTokenTips(analysis: TrustAnalysis): Recommendation[] {
  const tips: Recommendation[] = [];

  // Deployer reputation
  if (analysis.deployerScore === null) {
    tips.push({
      id: "deployer-unrated",
      priority: "medium",
      title: "Deployer has no reputation",
      description:
        "The deployer wallet has no FairScale history. Building on-chain activity and connecting socials on FairScale would improve this token's trust rating.",
      category: "score",
    });
  } else if (analysis.deployerScore < 300) {
    tips.push({
      id: "deployer-low",
      priority: "medium",
      title: "Build deployer reputation",
      description:
        `The deployer has a FairScale score of ${analysis.deployerScore}. Increasing DeFi activity, staking SOL, and connecting socials would boost the token's trust rating.`,
      category: "score",
    });
  }

  // Holder concentration
  if (analysis.topHolderConcentration > 50) {
    tips.push({
      id: "distribution",
      priority: analysis.topHolderConcentration > 80 ? "high" : "medium",
      title: "Improve token distribution",
      description:
        `The top holder owns ${analysis.topHolderConcentration.toFixed(1)}% of sampled supply. Broader distribution across more wallets would significantly improve trust.`,
      category: "distribution",
    });
  }

  // Holder quality
  if (analysis.holderQualityScore < 40) {
    tips.push({
      id: "holder-quality",
      priority: "medium",
      title: "Attract reputable holders",
      description:
        "The average holder reputation is low. Attracting holders with established FairScale profiles would improve the token's credibility.",
      category: "score",
    });
  }

  // Mint authority
  if (analysis.riskFlags.some((f) => f.label === "Active Mint Authority")) {
    tips.push({
      id: "mint-authority",
      priority: "medium",
      title: "Renounce mint authority",
      description:
        "The token still has an active mint authority. Renouncing it signals commitment to a fixed supply and removes a risk flag.",
      category: "authority",
    });
  }

  // Freeze authority
  if (analysis.riskFlags.some((f) => f.label === "Active Freeze Authority")) {
    tips.push({
      id: "freeze-authority",
      priority: "low",
      title: "Renounce freeze authority",
      description:
        "The token has an active freeze authority. Removing it builds holder confidence by ensuring accounts can't be frozen.",
      category: "authority",
    });
  }

  // Low holder count
  if (analysis.holderCount < 10) {
    tips.push({
      id: "low-holders",
      priority: "medium",
      title: "Grow holder base",
      description:
        `Only ${analysis.holderCount} holders detected. A larger, more diverse holder base signals organic demand and improves trust.`,
      category: "distribution",
    });
  }

  // Overall trust rating
  if (analysis.trustRating >= 60) {
    tips.push({
      id: "good-standing",
      priority: "low",
      title: "Token is in good standing",
      description:
        "This token has a solid trust rating. Maintaining deployer activity and broad distribution will keep it trusted.",
      category: "score",
    });
  }

  return tips;
}

function applyTierLimit(recs: Recommendation[], tier: string): Recommendation[] {
  const tierOrder: Record<string, number> = {
    unrated: -1,
    bronze: 0,
    silver: 1,
    gold: 2,
    platinum: 3,
  };
  const rank = tierOrder[tier] ?? -1;

  if (rank <= 0) return recs.slice(0, 3);
  if (rank === 1) return recs.slice(0, 5);
  return recs;
}
