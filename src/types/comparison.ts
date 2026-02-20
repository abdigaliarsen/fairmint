/**
 * Shared types for multi-entity comparison (tokens, wallets, deployers).
 */

import type { FairScoreTier, Badge, WalletFeatures } from "@/types/database";
import type { TrustAnalysis } from "@/services/tokenAnalyzer";

// ---------------------------------------------------------------------------
// Comparison Mode
// ---------------------------------------------------------------------------

export type ComparisonMode = "tokens" | "wallets" | "deployers";

// ---------------------------------------------------------------------------
// Wallet Comparison
// ---------------------------------------------------------------------------

export interface WalletComparison {
  wallet: string;
  /** Decimal score (0-100) from /score endpoint. */
  score: number;
  /** Integer score (0-1000+) from /fairScore endpoint. */
  integerScore: number;
  tier: FairScoreTier;
  badges: Badge[];
  features: WalletFeatures | null;
  walletScore: number | null;
}

// ---------------------------------------------------------------------------
// Deployer Comparison
// ---------------------------------------------------------------------------

export interface DeployerComparison {
  wallet: string;
  /** Decimal score (0-100) from /score endpoint. */
  score: number;
  /** Integer score (0-1000+) from /fairScore endpoint. */
  integerScore: number;
  tier: FairScoreTier;
  badges: Badge[];
  features: WalletFeatures | null;
  tokenCount: number;
  deployedTokens: Array<{
    mint: string;
    name: string | null;
    symbol: string | null;
    trust_rating: number;
    holder_count: number;
  }>;
}

// ---------------------------------------------------------------------------
// Discriminated Union for Slot Data
// ---------------------------------------------------------------------------

export type ComparisonEntity =
  | { mode: "tokens"; data: TrustAnalysis }
  | { mode: "wallets"; data: WalletComparison }
  | { mode: "deployers"; data: DeployerComparison };
