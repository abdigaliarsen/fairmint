/**
 * GET /api/featured?limit=12
 *
 * Returns the top-rated tokens from the token_analyses table,
 * ordered by trust rating descending. Used for landing page
 * featured tokens and search page default view.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = Math.min(
      Math.max(1, Number(searchParams.get("limit") ?? 12)),
      50
    );

    const supabase = createServerSupabaseClient();

    const { data: tokens, error } = await supabase
      .from("token_analyses")
      .select(
        "mint, name, symbol, image_url, trust_rating, deployer_wallet, deployer_tier, deployer_score, holder_count, holder_quality_score, risk_flags, analyzed_at"
      )
      .order("trust_rating", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Supabase featured query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch featured tokens" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      tokens: tokens ?? [],
    });
  } catch (error) {
    console.error("GET /api/featured error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
