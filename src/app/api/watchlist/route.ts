/**
 * /api/watchlist
 *
 * GET    — Fetch watchlist items for a wallet.
 * POST   — Add a token mint to a wallet's watchlist.
 * DELETE — Remove a token mint from a wallet's watchlist.
 *
 * DB schema (watchlist table):
 *   id          integer (auto-increment PK)
 *   user_wallet varchar
 *   token_mint  varchar
 *   added_at    timestamptz (default now())
 *
 * All operations use the Supabase service client (server-side only).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
    .min(32, "Invalid token mint address")
    .max(44, "Invalid token mint address"),
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
      .select("id, user_wallet, token_mint, added_at")
      .eq("user_wallet", wallet)
      .order("added_at", { ascending: false });

    if (error) {
      console.error("Watchlist fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch watchlist" },
        { status: 500 }
      );
    }

    // Enrich watchlist items with token analysis data
    const mints = (watchlistItems ?? []).map((item) => item.token_mint);
    let tokenData: Record<
      string,
      {
        name: string | null;
        symbol: string | null;
        trust_rating: number;
        deployer_tier: string | null;
      }
    > = {};

    if (mints.length > 0) {
      const { data: tokens } = await supabase
        .from("token_analyses")
        .select("mint, name, symbol, trust_rating, deployer_tier")
        .in("mint", mints);

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

    // Map to the shape the frontend expects
    const enrichedItems = (watchlistItems ?? []).map((item) => ({
      id: String(item.id),
      mint: item.token_mint,
      added_at: item.added_at,
      token: tokenData[item.token_mint] ?? null,
    }));

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
// POST — Add token to watchlist
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

    const { wallet, tokenMint } = parsed.data;
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
        { error: "Token already in watchlist" },
        { status: 409 }
      );
    }

    // Insert watchlist item
    const { data: item, error: insertError } = await supabase
      .from("watchlist")
      .insert({
        user_wallet: wallet,
        token_mint: tokenMint,
      })
      .select("id, token_mint, added_at")
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
          added_at: item.added_at,
          token: null,
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
// DELETE — Remove token from watchlist
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = walletTokenSchema.safeParse(body);

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
