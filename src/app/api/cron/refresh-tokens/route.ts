/**
 * GET /api/cron/refresh-tokens
 *
 * Vercel Cron job that re-analyzes popular tokens so the search page
 * always has fresh data. Runs daily at 6:00 AM UTC.
 *
 * Protected by CRON_SECRET to prevent unauthorized invocations.
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeToken } from "@/services/tokenAnalyzer";

/** Well-known Solana token mints to keep fresh. */
const POPULAR_MINTS = [
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", // mSOL
  "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", // PYTH
  "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", // ORCA
  "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux", // HNT
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", // JUP
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", // JitoSOL
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", // RAY
  "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof", // RENDER
  "TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6", // TNSR
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // WIF
];

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Array<{ mint: string; name: string | null; trustRating: number | null; error?: string }> = [];

  for (const mint of POPULAR_MINTS) {
    try {
      const analysis = await analyzeToken(mint);
      results.push({
        mint,
        name: analysis?.name ?? null,
        trustRating: analysis?.trustRating ?? null,
      });
    } catch (error) {
      results.push({
        mint,
        name: null,
        trustRating: null,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const succeeded = results.filter((r) => r.trustRating !== null).length;
  const failed = results.length - succeeded;

  return NextResponse.json({
    refreshed: succeeded,
    failed,
    results,
    timestamp: new Date().toISOString(),
  });
}
