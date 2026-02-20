-- Add entity_type column to watchlist table
-- Supports "token", "wallet", "deployer" (defaults to "token" for existing rows)
ALTER TABLE watchlist
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'token';

-- Index for filtering by entity type
CREATE INDEX IF NOT EXISTS idx_watchlist_entity_type ON watchlist (user_wallet, entity_type);
