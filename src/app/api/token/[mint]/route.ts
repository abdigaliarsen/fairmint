/**
 * GET /api/token/[mint]
 *
 * Full token trust analysis via the Token Analyzer service.
 * Returns trust rating, deployer info, risk flags, and holder stats.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeToken } from "@/services/tokenAnalyzer";

const paramSchema = z.object({
  mint: z
    .string()
    .min(32, "Invalid mint address")
    .max(44, "Invalid mint address"),
});

export async function GET(
  request: NextRequest,
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

    const analysis = await analyzeToken(parsed.data.mint);

    if (!analysis) {
      return NextResponse.json(
        { error: "Token not found", mint: parsed.data.mint },
        { status: 404 }
      );
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("GET /api/token/[mint] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
