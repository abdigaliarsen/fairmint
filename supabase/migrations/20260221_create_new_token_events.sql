-- New token events table for real-time token discovery feed
CREATE TABLE IF NOT EXISTS new_token_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mint text UNIQUE NOT NULL,
  name text,
  symbol text,
  image_url text,
  source text NOT NULL DEFAULT 'helius_webhook',
  metadata jsonb DEFAULT '{}'::jsonb,
  analyzed boolean NOT NULL DEFAULT false,
  trust_rating integer NOT NULL DEFAULT 0,
  deployer_tier text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for feed queries (unanalyzed first, then by recency)
CREATE INDEX idx_new_token_events_feed ON new_token_events (analyzed, created_at DESC);

-- Index for cron enrichment queries
CREATE INDEX idx_new_token_events_unanalyzed ON new_token_events (analyzed) WHERE analyzed = false;

-- Enable RLS
ALTER TABLE new_token_events ENABLE ROW LEVEL SECURITY;

-- Anon users can read (for Supabase Realtime subscriptions)
CREATE POLICY "Anyone can read new_token_events"
  ON new_token_events FOR SELECT
  USING (true);

-- Only service role can write (enforced by Supabase service role key)
CREATE POLICY "Service role can insert new_token_events"
  ON new_token_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update new_token_events"
  ON new_token_events FOR UPDATE
  USING (true);

-- Enable Realtime on this table
ALTER PUBLICATION supabase_realtime ADD TABLE new_token_events;
