/**
 * GET /api/token/[mint]/liquidity
 *
 * Fetch token liquidity data combining Helius holder analysis
 * (LP vault detection) with DexScreener market data.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenHolders, analyzeHolders } from "@/services/helius";
import { getTokenLiquidity } from "@/services/dexscreener";

const paramSchema = z.object({
  mint: z
    .string()
    .min(32, "Invalid mint address")
    .max(44, "Invalid mint address"),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  try {
    const { mint } = await params;
    const parsed = paramSchema.safeParse({ mint });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid mint address", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Fetch Helius holders + DexScreener in parallel
    const [holders, dexData] = await Promise.all([
      getTokenHolders(parsed.data.mint, 20),
      getTokenLiquidity(parsed.data.mint),
    ]);

    const { lpVaults, lpSupplyPercent } = analyzeHolders(holders);

    return NextResponse.json({
      mint: parsed.data.mint,
      lpVaults,
      lpSupplyPercent,
      dexScreener: dexData,
    });
  } catch (error) {
    console.error("GET /api/token/[mint]/liquidity error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
