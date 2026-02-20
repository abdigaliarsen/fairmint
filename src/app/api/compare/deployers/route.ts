/**
 * GET /api/compare/deployers?addresses=addr1,addr2,...
 *
 * Batch deployer comparison: fetches FairScale score data + deployed tokens
 * for 1-4 deployer wallet addresses.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFullScore } from "@/services/fairscale";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DeployerComparison } from "@/types/comparison";

const querySchema = z.object({
  addresses: z
    .string()
    .transform((s) =>
      s
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean)
    )
    .pipe(z.array(z.string().min(32).max(44)).min(1).max(4)),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = querySchema.safeParse({
      addresses: searchParams.get("addresses") ?? "",
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    const deployers = await Promise.all(
      parsed.data.addresses.map(async (address): Promise<DeployerComparison | null> => {
        const [fullScore, tokensResult] = await Promise.all([
          getFullScore(address),
          supabase
            .from("token_analyses")
            .select("mint, name, symbol, trust_rating, holder_count")
            .eq("deployer_wallet", address)
            .order("analyzed_at", { ascending: false }),
        ]);

        if (!fullScore) return null;

        const deployedTokens = tokensResult.data ?? [];

        return {
          wallet: address,
          score: fullScore.decimalScore,
          integerScore: fullScore.integerScore,
          tier: fullScore.tier,
          badges: fullScore.badges,
          features: fullScore.features ?? null,
          tokenCount: deployedTokens.length,
          deployedTokens,
        };
      })
    );

    return NextResponse.json({
      deployers: deployers.filter(Boolean),
    });
  } catch (error) {
    console.error("GET /api/compare/deployers error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
