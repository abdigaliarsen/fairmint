/**
 * POST /api/ingest/new-tokens
 *
 * Ingestion endpoint for new token events from multiple sources:
 * - Helius webhook (TOKEN_MINT events)
 * - Internal calls from cron (Jupiter, DexScreener batches)
 *
 * Deduplicates by mint, fetches basic metadata, writes to new_token_events.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTokenMetadata } from "@/services/helius";
import type { NewTokenSource } from "@/types/database";

const PUMPFUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET;

const batchSchema = z.object({
  tokens: z.array(
    z.object({
      mint: z.string().min(32).max(44),
      name: z.string().nullable().optional(),
      symbol: z.string().nullable().optional(),
      image_url: z.string().nullable().optional(),
      source: z.enum([
        "jupiter",
        "dexscreener",
        "pumpfun_graduated",
        "helius_webhook",
      ]),
    })
  ),
});

/**
 * Extract unique mint addresses from a Helius enhanced-transaction webhook payload.
 * Each transaction may contain multiple token transfers; we deduplicate by mint.
 */
function extractMintsFromWebhook(
  payload: Record<string, unknown>[]
): string[] {
  const mints: string[] = [];
  for (const tx of payload) {
    const transfers = tx.tokenTransfers as
      | Array<{ mint?: string }>
      | undefined;
    if (transfers) {
      for (const t of transfers) {
        if (t.mint) mints.push(t.mint);
      }
    }
  }
  return [...new Set(mints)];
}

/**
 * Detect Pump.fun graduation by checking if any instruction in the
 * transaction targets the Pump.fun program.
 */
function isPumpfunGraduation(tx: Record<string, unknown>): boolean {
  const instructions = tx.instructions as
    | Array<{ programId?: string }>
    | undefined;
  if (!instructions) return false;
  return instructions.some((ix) => ix.programId === PUMPFUN_PROGRAM);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const isWebhook = Array.isArray(body);

    // -----------------------------------------------------------------
    // Path 1: Helius webhook payload (array of enhanced transactions)
    // -----------------------------------------------------------------
    if (isWebhook) {
      if (WEBHOOK_SECRET) {
        const authHeader = request.headers.get("authorization");
        if (authHeader !== WEBHOOK_SECRET) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
      }

      const mints = extractMintsFromWebhook(body);
      if (mints.length === 0) {
        return NextResponse.json({ ingested: 0 });
      }

      const hasPumpfun = body.some((tx: Record<string, unknown>) =>
        isPumpfunGraduation(tx)
      );
      const supabase = createServerSupabaseClient();
      let ingested = 0;

      for (const mint of mints) {
        const metadata = await getTokenMetadata(mint);
        const source: NewTokenSource = hasPumpfun
          ? "pumpfun_graduated"
          : "helius_webhook";

        const { error } = await supabase.from("new_token_events").upsert(
          {
            mint,
            name: metadata?.name ?? null,
            symbol: metadata?.symbol ?? null,
            image_url: metadata?.image ?? null,
            source,
            metadata: metadata?.raw ? { asset: metadata.raw } : {},
            analyzed: false,
            trust_rating: 0,
            deployer_tier: null,
          },
          { onConflict: "mint", ignoreDuplicates: true }
        );

        if (!error) ingested++;
      }

      return NextResponse.json({ ingested, total: mints.length });
    }

    // -----------------------------------------------------------------
    // Path 2: Internal batch ingest (object with `tokens` array)
    // -----------------------------------------------------------------
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    let ingested = 0;

    for (const token of parsed.data.tokens) {
      let name = token.name ?? null;
      let symbol = token.symbol ?? null;
      let imageUrl = token.image_url ?? null;

      // Fetch metadata from Helius if name and symbol are both missing
      if (!name && !symbol) {
        const metadata = await getTokenMetadata(token.mint);
        name = metadata?.name ?? null;
        symbol = metadata?.symbol ?? null;
        imageUrl = metadata?.image ?? null;
      }

      const { error } = await supabase.from("new_token_events").upsert(
        {
          mint: token.mint,
          name,
          symbol,
          image_url: imageUrl,
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

    return NextResponse.json({ ingested, total: parsed.data.tokens.length });
  } catch (error) {
    console.error("POST /api/ingest/new-tokens error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
