import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFullScore, getWalletScore } from "@/services/fairscale";
import { generateRecommendations } from "@/lib/recommendations";

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

    // Fetch all 3 FairScale endpoints for deepest profile
    const [fullScore, walletScore] = await Promise.all([
      getFullScore(parsed.data.wallet),
      getWalletScore(parsed.data.wallet),
    ]);

    const recommendations = generateRecommendations(
      fullScore,
      undefined,
      fullScore?.tier
    );

    return NextResponse.json({
      wallet: parsed.data.wallet,
      fairScore: fullScore,
      walletScore,
      recommendations,
    });
  } catch (error) {
    console.error("GET /api/reputation/[wallet] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
