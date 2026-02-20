/**
 * GET /api/deployer/[wallet]
 *
 * Deployer profile: FairScore data + tokens they have deployed.
 * Fetches the deployer's FairScale score and any token analyses
 * in Supabase where they are listed as the deployer.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFullScore } from "@/services/fairscale";

const paramSchema = z.object({
  wallet: z
    .string()
    .min(32, "Invalid wallet address")
    .max(44, "Invalid wallet address"),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;
    const parsed = paramSchema.safeParse({ wallet });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid wallet address", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const walletAddress = parsed.data.wallet;

    // Fetch FairScale score
    const scoreData = await getFullScore(walletAddress);

    // Fetch deployed tokens from Supabase
    const supabase = createServerSupabaseClient();
    const { data: deployedTokens, error: dbError } = await supabase
      .from("token_analyses")
      .select(
        "mint, name, symbol, image_url, trust_rating, deployer_score, deployer_tier, holder_count, analyzed_at"
      )
      .eq("deployer_wallet", walletAddress)
      .order("analyzed_at", { ascending: false });

    if (dbError) {
      console.error("Supabase query error:", dbError);
    }

    return NextResponse.json({
      wallet: walletAddress,
      fairScore: scoreData
        ? {
            score: scoreData.score,
            integerScore: scoreData.integerScore,
            tier: scoreData.tier,
            badges: scoreData.badges,
            updatedAt: scoreData.updatedAt,
          }
        : null,
      deployedTokens: deployedTokens ?? [],
      tokenCount: deployedTokens?.length ?? 0,
    });
  } catch (error) {
    console.error("GET /api/deployer/[wallet] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
