/**
 * GET /api/cron/refresh-tokens
 *
 * Re-analyzes popular tokens so the search page always has fresh data.
 * Called by an external cron service (cron-job.org) every 20 minutes.
 *
 * Protected by CRON_SECRET to prevent unauthorized invocations.
 * Token analyses are cached for 1 hour, so only ~3 of every 6 calls
 * actually hit external APIs.
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeToken } from "@/services/tokenAnalyzer";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchRecentTokens } from "@/services/jupiter";
import { fetchLatestProfiles } from "@/services/dexscreener";

/** Well-known Solana token mints to keep fresh. */
const POPULAR_MINTS = [
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", // mSOL
  "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", // PYTH
  "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", // ORCA
  "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux", // HNT
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", // JUP
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", // JitoSOL
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", // RAY
  "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof", // RENDER
  "TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6", // TNSR
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // WIF
];

/**
 * Fetch recently-analyzed tokens that are stale (older than 1 hour)
 * so the discover feed stays fresh.
 */
async function getStaleMints(limit: number): Promise<string[]> {
  try {
    const supabase = createServerSupabaseClient();
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("token_analyses")
      .select("mint")
      .lt("analyzed_at", cutoff)
      .order("analyzed_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map((r) => r.mint);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Merge popular mints with stale recently-analyzed tokens (deduplicated)
  const staleMints = await getStaleMints(10);
  const allMints = [...new Set([...POPULAR_MINTS, ...staleMints])];

  const results: Array<{ mint: string; name: string | null; trustRating: number | null; error?: string }> = [];

  for (const mint of allMints) {
    try {
      const analysis = await analyzeToken(mint);
      results.push({
        mint,
        name: analysis?.name ?? null,
        trustRating: analysis?.trustRating ?? null,
      });
    } catch (error) {
      results.push({
        mint,
        name: null,
        trustRating: null,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const succeeded = results.filter((r) => r.trustRating !== null).length;
  const failed = results.length - succeeded;

  // Phase 2: Ingest new tokens from Jupiter + DexScreener into new_token_events
  let ingested = 0;
  try {
    const [jupiterTokens, dexProfiles] = await Promise.all([
      fetchRecentTokens(20),
      fetchLatestProfiles(20),
    ]);

    const supabase = createServerSupabaseClient();
    const tokens: Array<{ mint: string; name: string | null; symbol: string | null; image_url: string | null; source: string }> = [];

    for (const t of jupiterTokens) {
      tokens.push({
        mint: t.mint,
        name: t.name ?? null,
        symbol: t.symbol ?? null,
        image_url: t.logoURI ?? null,
        source: "jupiter",
      });
    }

    for (const p of dexProfiles) {
      if (!tokens.some((t) => t.mint === p.tokenAddress)) {
        tokens.push({
          mint: p.tokenAddress,
          name: null,
          symbol: null,
          image_url: p.icon ?? null,
          source: "dexscreener",
        });
      }
    }

    for (const token of tokens) {
      const { error } = await supabase
        .from("new_token_events")
        .upsert(
          {
            mint: token.mint,
            name: token.name,
            symbol: token.symbol,
            image_url: token.image_url,
            source: token.source,
            metadata: {},
            analyzed: false,
            trust_rating: 0,
            deployer_tier: null,
          },
          { onConflict: "mint", ignoreDuplicates: true }
        );
      if (!error) ingested++;
    }
  } catch (error) {
    console.error("Phase 2 (ingest new tokens) failed:", error);
  }

  // Phase 3: Enrich unanalyzed tokens in new_token_events with full trust analysis
  let enriched = 0;
  try {
    const supabase = createServerSupabaseClient();
    const { data: unanalyzed } = await supabase
      .from("new_token_events")
      .select("mint")
      .eq("analyzed", false)
      .order("created_at", { ascending: false })
      .limit(5);

    for (const row of unanalyzed ?? []) {
      try {
        const analysis = await analyzeToken(row.mint);
        if (analysis) {
          await supabase
            .from("new_token_events")
            .update({
              analyzed: true,
              trust_rating: analysis.trustRating,
              deployer_tier: analysis.deployerTier ?? null,
              name: analysis.name ?? undefined,
              symbol: analysis.symbol ?? undefined,
              image_url: analysis.imageUrl ?? undefined,
            })
            .eq("mint", row.mint);
          enriched++;
        }
      } catch (error) {
        console.error(`Failed to enrich token ${row.mint}:`, error);
      }
    }
  } catch (error) {
    console.error("Phase 3 (enrich new tokens) failed:", error);
  }

  return NextResponse.json({
    refreshed: succeeded,
    failed,
    ingested,
    enriched,
    total: allMints.length,
    popular: POPULAR_MINTS.length,
    stale: staleMints.length,
    results,
    timestamp: new Date().toISOString(),
  });
}
