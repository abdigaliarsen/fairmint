/**
 * Database type definitions for TokenTrust Supabase tables.
 *
 * These types mirror the Supabase schema and are used throughout the
 * application for type-safe database operations.
 */

// ---------------------------------------------------------------------------
// Enums & Shared Types
// ---------------------------------------------------------------------------

/** FairScale trust tier based on integer score thresholds. */
export type FairScoreTier = "unrated" | "bronze" | "silver" | "gold" | "platinum";

/** Badge awarded to a wallet or token. */
export interface Badge {
  id: string;
  label: string;
  description: string;
  tier: FairScoreTier;
  awardedAt?: string;
}

/** Recommended action from the FairScale API. */
export interface FairScaleAction {
  id: string;
  label: string;
  description: string;
  priority: "high" | "medium" | "low";
  cta?: string;
}

/** Wallet analytics features from the FairScale /score endpoint. */
export interface WalletFeatures {
  lst_percentile_score: number;
  major_percentile_score: number;
  native_sol_percentile: number;
  stable_percentile_score: number;
  tx_count: number;
  active_days: number;
  median_gap_hours: number;
  wallet_age_score: number;
  [key: string]: number;
}

/** Risk flag attached to a token analysis. */
export interface RiskFlag {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  label: string;
  description: string;
}

// ---------------------------------------------------------------------------
// FairScore
// ---------------------------------------------------------------------------

/** Aggregated FairScale score data returned by the /score endpoint. */
export interface FairScoreData {
  wallet: string;
  score: number;
  tier: FairScoreTier;
  badges: Badge[];
  updatedAt: string;

  /** Raw decimal score (0-100) from the /score endpoint */
  decimalScore: number;
  /** Integer score (0-1000+) from the /fairScore endpoint */
  integerScore: number;
  /** Recommended actions from FairScale */
  actions?: FairScaleAction[];
  /** Detailed wallet analytics features from /score */
  features?: WalletFeatures;
}

// ---------------------------------------------------------------------------
// Cached Scores (Supabase table: cached_scores)
// ---------------------------------------------------------------------------

export interface CachedScore {
  id: string;
  wallet: string;
  score_decimal: number;
  score_integer: number;
  tier: FairScoreTier;
  badges: Badge[];
  raw_response: Record<string, unknown>;
  fetched_at: string;
  created_at: string;
  updated_at: string;
}

export type CachedScoreInsert = Omit<CachedScore, "id" | "created_at" | "updated_at">;

// ---------------------------------------------------------------------------
// Token Analyses (Supabase table: token_analyses)
// ---------------------------------------------------------------------------

export interface TokenAnalysis {
  id: string;
  mint: string;
  name: string | null;
  symbol: string | null;
  image_url: string | null;
  deployer_wallet: string | null;
  deployer_score: number | null;
  deployer_tier: FairScoreTier | null;
  trust_rating: number;
  holder_quality_score: number;
  holder_count: number;
  top_holder_concentration: number;
  risk_flags: RiskFlag[];
  token_age_days: number | null;
  raw_metadata: Record<string, unknown> | null;
  analyzed_at: string;
  created_at: string;
  updated_at: string;
}

export type TokenAnalysisInsert = Omit<TokenAnalysis, "id" | "created_at" | "updated_at">;

// ---------------------------------------------------------------------------
// Users (Supabase table: users)
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  wallet: string;
  display_name: string | null;
  avatar_url: string | null;
  fair_score: number | null;
  fair_tier: FairScoreTier | null;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export type UserInsert = Omit<User, "id" | "created_at" | "updated_at">;

// ---------------------------------------------------------------------------
// Watchlist (Supabase table: watchlist)
// ---------------------------------------------------------------------------

export interface WatchlistItem {
  id: string;
  user_id: string;
  mint: string;
  label: string | null;
  notes: string | null;
  added_at: string;
  created_at: string;
  updated_at: string;
}

export type WatchlistItemInsert = Omit<WatchlistItem, "id" | "created_at" | "updated_at">;

// ---------------------------------------------------------------------------
// Notifications (Supabase table: notifications)
// ---------------------------------------------------------------------------

export interface Notification {
  id: string;
  user_wallet: string;
  mint: string;
  token_name: string | null;
  type: "score_change" | "new_risk_flag";
  message: string;
  old_value: number | null;
  new_value: number | null;
  read: boolean;
  created_at: string;
}

export type NotificationInsert = Omit<Notification, "id" | "created_at">;

// ---------------------------------------------------------------------------
// Browsing History (Supabase table: browsing_history)
// ---------------------------------------------------------------------------

export type BrowsingHistoryType = "token" | "deployer" | "reputation";

export interface BrowsingHistoryEntry {
  id: string;
  wallet: string;
  type: BrowsingHistoryType;
  subject: string;
  name: string | null;
  symbol: string | null;
  score: number | null;
  tier: FairScoreTier | null;
  visited_at: string;
  created_at: string;
}

export type BrowsingHistoryInsert = Omit<BrowsingHistoryEntry, "id" | "created_at">;

// ---------------------------------------------------------------------------
// New Token Events (Supabase table: new_token_events)
// ---------------------------------------------------------------------------

/** Source of a new token event. */
export type NewTokenSource = "jupiter" | "dexscreener" | "pumpfun_graduated" | "helius_webhook";

export interface NewTokenEvent {
  id: string;
  mint: string;
  name: string | null;
  symbol: string | null;
  image_url: string | null;
  source: NewTokenSource;
  metadata: Record<string, unknown>;
  analyzed: boolean;
  trust_rating: number;
  deployer_tier: string | null;
  created_at: string;
}

export type NewTokenEventInsert = Omit<NewTokenEvent, "id" | "created_at">;

// ---------------------------------------------------------------------------
// Supabase Database Type Map
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      cached_scores: {
        Row: CachedScore;
        Insert: CachedScoreInsert;
        Update: Partial<CachedScoreInsert>;
        Relationships: [];
      };
      token_analyses: {
        Row: TokenAnalysis;
        Insert: TokenAnalysisInsert;
        Update: Partial<TokenAnalysisInsert>;
        Relationships: [];
      };
      users: {
        Row: User;
        Insert: UserInsert;
        Update: Partial<UserInsert>;
        Relationships: [];
      };
      watchlist: {
        Row: WatchlistItem;
        Insert: WatchlistItemInsert;
        Update: Partial<WatchlistItemInsert>;
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: NotificationInsert;
        Update: Partial<NotificationInsert>;
        Relationships: [];
      };
      browsing_history: {
        Row: BrowsingHistoryEntry;
        Insert: BrowsingHistoryInsert;
        Update: Partial<BrowsingHistoryInsert>;
        Relationships: [];
      };
      new_token_events: {
        Row: NewTokenEvent;
        Insert: NewTokenEventInsert;
        Update: Partial<NewTokenEventInsert>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
  };
}
