/**
 * /api/watchlist
 *
 * GET    — Fetch watchlist items for a wallet.
 * POST   — Add a token mint to a wallet's watchlist.
 * DELETE — Remove a token mint from a wallet's watchlist.
 *
 * All operations use the Supabase service client (server-side only).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const getSchema = z.object({
  wallet: z
    .string()
    .min(32, "Invalid wallet address")
    .max(44, "Invalid wallet address"),
});

const postSchema = z.object({
  wallet: z
    .string()
    .min(32, "Invalid wallet address")
    .max(44, "Invalid wallet address"),
  tokenMint: z
    .string()
    .min(32, "Invalid token mint address")
    .max(44, "Invalid token mint address"),
});

const deleteSchema = z.object({
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
    const parsed = getSchema.safeParse({
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

    // First, find the user by wallet
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("wallet", wallet)
      .maybeSingle();

    if (!user) {
      // No user record yet — return empty watchlist
      return NextResponse.json({ items: [] });
    }

    // Fetch watchlist items joined with token analysis data
    const { data: watchlistItems, error } = await supabase
      .from("watchlist")
      .select("id, mint, label, notes, added_at")
      .eq("user_id", user.id)
      .order("added_at", { ascending: false });

    if (error) {
      console.error("Watchlist fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch watchlist" },
        { status: 500 }
      );
    }

    // Enrich watchlist items with token analysis data
    const mints = (watchlistItems ?? []).map((item) => item.mint);
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

    const enrichedItems = (watchlistItems ?? []).map((item) => ({
      ...item,
      token: tokenData[item.mint] ?? null,
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
    const parsed = postSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { wallet, tokenMint } = parsed.data;
    const supabase = createServerSupabaseClient();

    // Find or create user
    let { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("wallet", wallet)
      .maybeSingle();

    if (!user) {
      const { data: newUser, error: userError } = await supabase
        .from("users")
        .insert({ wallet, display_name: null, avatar_url: null, fair_score: null, fair_tier: null, last_login: null })
        .select("id")
        .single();

      if (userError) {
        console.error("User creation error:", userError);
        return NextResponse.json(
          { error: "Failed to create user" },
          { status: 500 }
        );
      }
      user = newUser;
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", user.id)
      .eq("mint", tokenMint)
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
        user_id: user.id,
        mint: tokenMint,
        label: null,
        notes: null,
        added_at: new Date().toISOString(),
      })
      .select("id, mint, label, notes, added_at")
      .single();

    if (insertError) {
      console.error("Watchlist insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to add to watchlist" },
        { status: 500 }
      );
    }

    return NextResponse.json({ item }, { status: 201 });
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
    const parsed = deleteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { wallet, tokenMint } = parsed.data;
    const supabase = createServerSupabaseClient();

    // Find user
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("wallet", wallet)
      .maybeSingle();

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Delete watchlist item
    const { error: deleteError } = await supabase
      .from("watchlist")
      .delete()
      .eq("user_id", user.id)
      .eq("mint", tokenMint);

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
