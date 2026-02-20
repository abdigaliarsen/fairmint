/**
 * GET /api/wallets?tier=gold,platinum&limit=20
 *
 * Returns top-rated wallets from the cached_scores table,
 * sorted by integer score descending.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  tier: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = schema.safeParse({
      limit: searchParams.get("limit") ?? 20,
      tier: searchParams.get("tier") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { limit, tier } = parsed.data;
    const supabase = createServerSupabaseClient();

    let query = supabase
      .from("cached_scores")
      .select(
        "wallet, score_decimal, score_integer, tier, badges, raw_response, fetched_at"
      )
      .order("score_integer", { ascending: false })
      .limit(limit);

    if (tier) {
      const tiers = tier.split(",").map((t) => t.trim());
      query = query.in("tier", tiers);
    }

    const { data, error } = await query;

    if (error) throw error;

    const wallets = (data ?? []).map((row) => {
      const raw = row.raw_response as Record<string, unknown> | null;
      const features = (raw?.features ?? null) as Record<
        string,
        number
      > | null;
      return {
        wallet: row.wallet,
        score: row.score_integer,
        tier: row.tier,
        badges: row.badges,
        walletAgeDays: features?.wallet_age_days ?? null,
        txCount: features?.tx_count ?? null,
        activeDays: features?.active_days ?? null,
        fetchedAt: row.fetched_at,
      };
    });

    return NextResponse.json({ wallets });
  } catch (error) {
    console.error("GET /api/wallets error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
