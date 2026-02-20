/**
 * GET /api/token/[mint]/holders?limit=20
 *
 * Fetch token holders with their FairScale scores.
 * Returns holder list sorted by amount with score and tier data.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenHolders } from "@/services/helius";
import { getQuickScore, classifyTier } from "@/services/fairscale";

const paramSchema = z.object({
  mint: z
    .string()
    .min(32, "Invalid mint address")
    .max(44, "Invalid mint address"),
});

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  try {
    const { mint } = await params;
    const parsedParams = paramSchema.safeParse({ mint });

    if (!parsedParams.success) {
      return NextResponse.json(
        { error: "Invalid mint address", details: parsedParams.error.flatten() },
        { status: 400 }
      );
    }

    const { searchParams } = request.nextUrl;
    const parsedQuery = querySchema.safeParse({
      limit: searchParams.get("limit") ?? 20,
    });

    const limit = parsedQuery.success ? parsedQuery.data.limit : 20;

    // Fetch holders from Helius
    const holders = await getTokenHolders(parsedParams.data.mint, limit);

    if (holders.length === 0) {
      return NextResponse.json(
        { error: "No holders found", mint: parsedParams.data.mint },
        { status: 404 }
      );
    }

    // Enrich with FairScores (batch quick scores)
    const enrichedHolders = await Promise.all(
      holders.map(async (holder) => {
        const score = await getQuickScore(holder.owner);
        return {
          owner: holder.owner,
          amount: holder.amount,
          percentage: holder.percentage,
          fairScore: score,
          tier: score !== null ? classifyTier(score) : "unrated" as const,
        };
      })
    );

    return NextResponse.json({
      mint: parsedParams.data.mint,
      holderCount: enrichedHolders.length,
      holders: enrichedHolders,
    });
  } catch (error) {
    console.error("GET /api/token/[mint]/holders error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
