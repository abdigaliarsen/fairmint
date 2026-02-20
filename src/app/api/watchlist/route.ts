/**
 * /api/watchlist
 *
 * GET    — Fetch watchlist items for a wallet.
 * POST   — Add an entity (token, wallet, deployer) to a wallet's watchlist.
 * DELETE — Remove an entity from a wallet's watchlist.
 *
 * DB schema (watchlist table):
 *   id          integer (auto-increment PK)
 *   user_wallet varchar
 *   token_mint  varchar  — stores the address (token mint, wallet, or deployer)
 *   entity_type varchar  — "token" | "wallet" | "deployer" (defaults to "token")
 *   added_at    timestamptz (default now())
 *
 * All operations use the Supabase service client (server-side only).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { FairScoreTier } from "@/types/database";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const walletSchema = z.object({
  wallet: z
    .string()
    .min(32, "Invalid wallet address")
    .max(44, "Invalid wallet address"),
});

const walletTokenSchema = z.object({
  wallet: z
    .string()
    .min(32, "Invalid wallet address")
    .max(44, "Invalid wallet address"),
  tokenMint: z
    .string()
    .min(32, "Invalid address")
    .max(44, "Invalid address"),
  entityType: z
    .enum(["token", "wallet", "deployer"])
    .optional()
    .default("token"),
});

const deleteSchema = z.object({
  wallet: z
    .string()
    .min(32, "Invalid wallet address")
    .max(44, "Invalid wallet address"),
  tokenMint: z
    .string()
    .min(32, "Invalid address")
    .max(44, "Invalid address"),
});

// ---------------------------------------------------------------------------
// GET — Fetch watchlist items
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = walletSchema.safeParse({
      wallet: searchParams.get("wallet"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { wallet } = parsed.data;
    const supabase = createServerSupabaseClient();

    // Fetch watchlist items for this wallet
    const { data: watchlistItems, error } = await supabase
      .from("watchlist")
      .select("id, user_wallet, token_mint, entity_type, added_at")
      .eq("user_wallet", wallet)
      .order("added_at", { ascending: false });

    if (error) {
      console.error("Watchlist fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch watchlist" },
        { status: 500 }
      );
    }

    const items = watchlistItems ?? [];

    // Split items by entity type for targeted enrichment
    const tokenMints = items
      .filter((i) => !i.entity_type || i.entity_type === "token")
      .map((i) => i.token_mint);
    const walletAddresses = items
      .filter((i) => i.entity_type === "wallet" || i.entity_type === "deployer")
      .map((i) => i.token_mint);

    // Enrich token items from token_analyses
    let tokenData: Record<
      string,
      {
        name: string | null;
        symbol: string | null;
        trust_rating: number;
        deployer_tier: string | null;
      }
    > = {};

    if (tokenMints.length > 0) {
      const { data: tokens } = await supabase
        .from("token_analyses")
        .select("mint, name, symbol, trust_rating, deployer_tier")
        .in("mint", tokenMints);

      if (tokens) {
        tokenData = Object.fromEntries(
          tokens.map((t) => [
            t.mint,
            {
              name: t.name,
              symbol: t.symbol,
              trust_rating: t.trust_rating,
              deployer_tier: t.deployer_tier,
            },
          ])
        );
      }
    }

    // For "token" entries that weren't found in token_analyses, check
    // cached_scores — they may be wallets/deployers stored before the
    // entity_type column existed.
    const unmatchedTokenMints = tokenMints.filter((m) => !tokenData[m]);

    // Enrich wallet/deployer items from cached_scores
    // Include unmatched "token" entries so we can reclassify them
    const allWalletLookups = [...walletAddresses, ...unmatchedTokenMints];
    let walletData: Record<
      string,
      { score: number; tier: FairScoreTier }
    > = {};

    if (allWalletLookups.length > 0) {
      const { data: scores } = await supabase
        .from("cached_scores")
        .select("wallet, score_decimal, tier")
        .in("wallet", allWalletLookups);

      if (scores) {
        walletData = Object.fromEntries(
          scores.map((s) => [
            s.wallet,
            { score: s.score_decimal, tier: s.tier as FairScoreTier },
          ])
        );
      }
    }

    // Map to the shape the frontend expects
    const enrichedItems = items.map((item) => {
      let entityType = item.entity_type || "token";

      // Reclassify: if entity_type is "token" but no token data was found
      // AND the address exists in cached_scores, treat it as a wallet
      if (
        entityType === "token" &&
        !tokenData[item.token_mint] &&
        walletData[item.token_mint]
      ) {
        entityType = "wallet";
      }

      return {
        id: String(item.id),
        mint: item.token_mint,
        entity_type: entityType,
        added_at: item.added_at,
        token: entityType === "token" ? (tokenData[item.token_mint] ?? null) : null,
        walletInfo:
          entityType === "wallet" || entityType === "deployer"
            ? (walletData[item.token_mint] ?? null)
            : null,
      };
    });

    return NextResponse.json({ items: enrichedItems });
  } catch (error) {
    console.error("GET /api/watchlist error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Add entity to watchlist
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = walletTokenSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { wallet, tokenMint, entityType } = parsed.data;
    const supabase = createServerSupabaseClient();

    // Check for duplicate
    const { data: existing } = await supabase
      .from("watchlist")
      .select("id")
      .eq("user_wallet", wallet)
      .eq("token_mint", tokenMint)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Already in watchlist" },
        { status: 409 }
      );
    }

    // Insert watchlist item
    const { data: item, error: insertError } = await supabase
      .from("watchlist")
      .insert({
        user_wallet: wallet,
        token_mint: tokenMint,
        entity_type: entityType,
      })
      .select("id, token_mint, entity_type, added_at")
      .single();

    if (insertError) {
      console.error("Watchlist insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to add to watchlist" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        item: {
          id: String(item.id),
          mint: item.token_mint,
          entity_type: item.entity_type || entityType,
          added_at: item.added_at,
          token: null,
          walletInfo: null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/watchlist error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Remove entity from watchlist
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { wallet, tokenMint } = parsed.data;
    const supabase = createServerSupabaseClient();

    const { error: deleteError } = await supabase
      .from("watchlist")
      .delete()
      .eq("user_wallet", wallet)
      .eq("token_mint", tokenMint);

    if (deleteError) {
      console.error("Watchlist delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to remove from watchlist" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/watchlist error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
