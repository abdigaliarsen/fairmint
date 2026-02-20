/**
 * GET /api/discover?tab=trending|new|trusted&limit=20
 *
 * Discovery feed with three modes:
 * - trending: most recently analyzed tokens in last 24h
 * - new: recently created tokens (token_age_days <= 2)
 * - trusted: highest trust-rated tokens analyzed in last 7 days
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const FIELDS =
  "mint, name, symbol, image_url, trust_rating, deployer_tier, holder_count, token_age_days, risk_flags, analyzed_at";

const schema = z.object({
  tab: z.enum(["trending", "new", "trusted"]).default("trending"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = schema.safeParse({
      tab: searchParams.get("tab") ?? "trending",
      limit: searchParams.get("limit") ?? 20,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { tab, limit } = parsed.data;
    const supabase = createServerSupabaseClient();

    if (tab === "trending") {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("token_analyses")
        .select(FIELDS)
        .gte("analyzed_at", since)
        .order("analyzed_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return NextResponse.json({ tab, tokens: data ?? [] });
    }

    if (tab === "new") {
      const { data, error } = await supabase
        .from("token_analyses")
        .select(FIELDS)
        .not("token_age_days", "is", null)
        .lte("token_age_days", 2)
        .order("trust_rating", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return NextResponse.json({ tab, tokens: data ?? [] });
    }

    // trusted
    const since7d = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    const { data, error } = await supabase
      .from("token_analyses")
      .select(FIELDS)
      .gte("analyzed_at", since7d)
      .order("trust_rating", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return NextResponse.json({ tab, tokens: data ?? [] });
  } catch (error) {
    console.error("GET /api/discover error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
