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
 * Analyzes FairScore data and optional token analysis to produce
 * actionable tips. Tier gating controls detail level:
 *   - unrated/bronze: basic tips (top 3)
 *   - silver: detailed tips (top 5)
 *   - gold/platinum: full action plan (all)
 */
export function generateRecommendations(
  fairScore: FairScoreData | null,
  tokens?: TrustAnalysis[],
  tier?: FairScoreTier
): Recommendation[] {
  const recs: Recommendation[] = [];
  const effectiveTier = tier ?? fairScore?.tier ?? "unrated";

  // 1. No score at all
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

  // 2. Low score
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

  // 3. No badges
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

  // 4. Token-specific: high concentration
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

  // 5. Token-specific: active mint authority
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

  // 6. Token-specific: active freeze authority
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

  // 7. Score between 300-600: push to gold
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

  // 8. Score between 600-850: push to platinum
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

  // Tier-based limit
  const tierOrder: Record<string, number> = {
    unrated: -1,
    bronze: 0,
    silver: 1,
    gold: 2,
    platinum: 3,
  };
  const rank = tierOrder[effectiveTier] ?? -1;

  if (rank <= 0) return recs.slice(0, 3); // basic tips
  if (rank === 1) return recs.slice(0, 5); // detailed tips
  return recs; // full action plan
}
