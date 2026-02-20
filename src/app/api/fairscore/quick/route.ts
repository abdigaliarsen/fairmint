/**
 * GET /api/fairscore/quick?wallet=<address>
 *
 * Proxy to FairScale /fairScore endpoint.
 * Returns a lightweight integer score (0-1000+) for batch/quick checks.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getQuickScore, classifyTier } from "@/services/fairscale";

const querySchema = z.object({
  wallet: z
    .string()
    .min(32, "Invalid wallet address")
    .max(44, "Invalid wallet address"),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = querySchema.safeParse({
      wallet: searchParams.get("wallet"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { wallet } = parsed.data;
    const score = await getQuickScore(wallet);

    if (score === null) {
      return NextResponse.json(
        { error: "Wallet not found or unrated", wallet },
        { status: 404 }
      );
    }

    return NextResponse.json({
      wallet,
      score,
      tier: classifyTier(score),
    });
  } catch (error) {
    console.error("GET /api/fairscore/quick error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
