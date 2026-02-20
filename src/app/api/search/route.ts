/**
 * GET /api/search?q=<query>&limit=20
 *
 * Search token analyses by name, symbol, or mint address.
 * Returns matching token analyses from the Supabase database.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const querySchema = z.object({
  q: z
    .string()
    .min(1, "Search query is required")
    .max(100, "Search query too long"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = querySchema.safeParse({
      q: searchParams.get("q"),
      limit: searchParams.get("limit") ?? 20,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { q, limit } = parsed.data;
    const supabase = createServerSupabaseClient();

    // Search by mint (exact match) or by name/symbol (ilike)
    const searchTerm = `%${q}%`;

    const { data: results, error } = await supabase
      .from("token_analyses")
      .select(
        "mint, name, symbol, image_url, trust_rating, deployer_wallet, deployer_tier, holder_count, risk_flags, analyzed_at"
      )
      .or(`mint.eq.${q},name.ilike.${searchTerm},symbol.ilike.${searchTerm}`)
      .order("analyzed_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Supabase search error:", error);
      return NextResponse.json(
        { error: "Search failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      query: q,
      resultCount: results?.length ?? 0,
      results: results ?? [],
    });
  } catch (error) {
    console.error("GET /api/search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
