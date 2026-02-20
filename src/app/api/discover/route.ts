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
import { fetchLatestProfiles } from "@/services/dexscreener";
import { fetchRecentTokens } from "@/services/jupiter";
import { getTokenMetadata } from "@/services/helius";

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
      // Fetch from all sources in parallel: DB + live APIs
      const [dbResult, jupiterTokens, dexProfiles] = await Promise.all([
        supabase
          .from("new_token_events")
          .select("mint, name, symbol, image_url, source, analyzed, trust_rating, deployer_tier, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        fetchRecentTokens(20).catch(() => []),
        fetchLatestProfiles(20).catch(() => []),
      ]);

      // Build a map keyed by mint — DB data takes priority
      const tokenMap = new Map<string, {
        mint: string; name: string | null; symbol: string | null;
        image_url: string | null; trust_rating: number; deployer_tier: string | null;
        analyzed_at: string | null; source: string; created_at: string;
      }>();

      const now = new Date().toISOString();

      // Add live Jupiter tokens first (they have names)
      for (const t of jupiterTokens) {
        tokenMap.set(t.mint, {
          mint: t.mint, name: t.name, symbol: t.symbol,
          image_url: t.logoURI ?? null, trust_rating: 0, deployer_tier: null,
          analyzed_at: null, source: "jupiter", created_at: t.created_at ?? now,
        });
      }

      // Add live DexScreener tokens (may lack names)
      for (const p of dexProfiles) {
        if (!tokenMap.has(p.tokenAddress)) {
          tokenMap.set(p.tokenAddress, {
            mint: p.tokenAddress, name: null, symbol: null,
            image_url: p.icon ?? null, trust_rating: 0, deployer_tier: null,
            analyzed_at: null, source: "dexscreener", created_at: now,
          });
        }
      }

      // Override with DB data (has enriched names, trust ratings)
      for (const row of dbResult.data ?? []) {
        tokenMap.set(row.mint, {
          mint: row.mint, name: row.name, symbol: row.symbol,
          image_url: row.image_url, trust_rating: row.trust_rating,
          deployer_tier: row.deployer_tier,
          analyzed_at: row.analyzed ? row.created_at : null,
          source: row.source, created_at: row.created_at,
        });
      }

      // Fetch Helius metadata for tokens still missing names (max 10)
      const needsMetadata = [...tokenMap.values()]
        .filter((t) => !t.name && !t.symbol)
        .slice(0, 10);

      if (needsMetadata.length > 0) {
        const metaResults = await Promise.allSettled(
          needsMetadata.map((t) => getTokenMetadata(t.mint))
        );
        for (let i = 0; i < needsMetadata.length; i++) {
          const r = metaResults[i];
          if (r.status === "fulfilled" && r.value) {
            const existing = tokenMap.get(needsMetadata[i].mint)!;
            existing.name = r.value.name ?? existing.name;
            existing.symbol = r.value.symbol ?? existing.symbol;
            existing.image_url = r.value.image ?? existing.image_url;
          }
        }
      }

      // Sort: analyzed first (by trust_rating desc), then unanalyzed (by created_at desc)
      const tokens = [...tokenMap.values()]
        .sort((a, b) => {
          if (a.analyzed_at && !b.analyzed_at) return -1;
          if (!a.analyzed_at && b.analyzed_at) return 1;
          if (a.analyzed_at && b.analyzed_at) return b.trust_rating - a.trust_rating;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
        .slice(0, limit)
        .map((t) => ({
          ...t,
          holder_count: 0,
          token_age_days: null,
          risk_flags: [],
        }));

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
