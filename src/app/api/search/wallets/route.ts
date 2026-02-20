/**
 * GET /api/search/wallets?q=<query>&limit=8
 *
 * Search for wallet addresses. If the query looks like a full wallet address
 * (32-44 chars), return it directly with a score lookup. Otherwise, prefix-
 * search the cached_scores table.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { FairScoreTier } from "@/types/database";

const querySchema = z.object({
  q: z
    .string()
    .min(1, "Search query is required")
    .max(100, "Search query too long"),
  limit: z.coerce.number().int().min(1).max(50).default(8),
});

interface WalletSearchResult {
  wallet: string;
  score: number;
  tier: FairScoreTier;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = querySchema.safeParse({
      q: searchParams.get("q"),
      limit: searchParams.get("limit") ?? 8,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { q, limit } = parsed.data;
    const supabase = createServerSupabaseClient();

    // If query looks like a full wallet address, return it directly
    if (q.length >= 32 && q.length <= 44) {
      const { data: exact } = await supabase
        .from("cached_scores")
        .select("wallet, score_decimal, tier")
        .eq("wallet", q)
        .limit(1)
        .maybeSingle();

      const result: WalletSearchResult = exact
        ? { wallet: exact.wallet, score: exact.score_decimal, tier: exact.tier }
        : { wallet: q, score: 0, tier: "unrated" as FairScoreTier };

      return NextResponse.json({ results: [result] });
    }

    // Prefix search on cached_scores
    const { data: results, error } = await supabase
      .from("cached_scores")
      .select("wallet, score_decimal, tier")
      .ilike("wallet", `${q}%`)
      .order("score_decimal", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Supabase wallet search error:", error);
      return NextResponse.json(
        { error: "Search failed" },
        { status: 500 }
      );
    }

    const mapped: WalletSearchResult[] = (results ?? []).map((r) => ({
      wallet: r.wallet,
      score: r.score_decimal,
      tier: r.tier,
    }));

    return NextResponse.json({ results: mapped });
  } catch (error) {
    console.error("GET /api/search/wallets error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
