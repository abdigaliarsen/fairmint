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
import { fetchRecentTokens } from "@/services/jupiter";
import { fetchLatestProfiles } from "@/services/dexscreener";

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
      // Fetch from Jupiter + DexScreener in parallel
      const [jupiterTokens, dexProfiles] = await Promise.all([
        fetchRecentTokens(30),
        fetchLatestProfiles(30),
      ]);

      // Collect unique mints from both sources
      const externalMap = new Map<
        string,
        { name: string | null; symbol: string | null; image_url: string | null }
      >();

      for (const t of jupiterTokens) {
        externalMap.set(t.mint, {
          name: t.name ?? null,
          symbol: t.symbol ?? null,
          image_url: t.logoURI ?? null,
        });
      }

      for (const p of dexProfiles) {
        if (!externalMap.has(p.tokenAddress)) {
          externalMap.set(p.tokenAddress, {
            name: null,
            symbol: null,
            image_url: p.icon ?? null,
          });
        }
      }

      const allMints = [...externalMap.keys()];

      // Query Supabase for any existing analyses
      let analyzedMap = new Map<string, Record<string, unknown>>();
      if (allMints.length > 0) {
        const { data: existing } = await supabase
          .from("token_analyses")
          .select(FIELDS)
          .in("mint", allMints);

        for (const row of existing ?? []) {
          analyzedMap.set(row.mint, row);
        }
      }

      // Merge: prefer analyzed data, fill gaps from external API data
      const analyzed: Record<string, unknown>[] = [];
      const unanalyzed: Record<string, unknown>[] = [];

      for (const mint of allMints) {
        const existing = analyzedMap.get(mint);
        if (existing) {
          analyzed.push(existing);
        } else {
          const ext = externalMap.get(mint)!;
          unanalyzed.push({
            mint,
            name: ext.name,
            symbol: ext.symbol,
            image_url: ext.image_url,
            trust_rating: 0,
            deployer_tier: null,
            holder_count: 0,
            token_age_days: null,
            risk_flags: [],
            analyzed_at: null,
          });
        }
      }

      // Sort: analyzed first (by trust_rating desc), then unanalyzed
      analyzed.sort(
        (a, b) =>
          (b.trust_rating as number) - (a.trust_rating as number)
      );

      const tokens = [...analyzed, ...unanalyzed].slice(0, limit);
      return NextResponse.json({ tab, tokens });
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
