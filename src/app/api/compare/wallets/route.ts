/**
 * GET /api/compare/wallets?addresses=addr1,addr2,...
 *
 * Batch wallet comparison: fetches FairScale score data for 1-4 wallet addresses.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFullScore, getWalletScore } from "@/services/fairscale";
import type { WalletComparison } from "@/types/comparison";

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

    const wallets = await Promise.all(
      parsed.data.addresses.map(async (address): Promise<WalletComparison | null> => {
        const [fullScore, walletScore] = await Promise.all([
          getFullScore(address),
          getWalletScore(address),
        ]);

        if (!fullScore) return null;

        return {
          wallet: address,
          score: fullScore.decimalScore,
          integerScore: fullScore.integerScore,
          tier: fullScore.tier,
          badges: fullScore.badges,
          features: fullScore.features ?? null,
          walletScore,
        };
      })
    );

    return NextResponse.json({
      wallets: wallets.filter(Boolean),
    });
  } catch (error) {
    console.error("GET /api/compare/wallets error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
