import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const entrySchema = z.object({
  id: z.string(),
  type: z.enum(["token", "deployer", "reputation"]),
  subject: z.string().min(1).max(64),
  name: z.string().nullable(),
  symbol: z.string().nullable(),
  score: z.number().nullable(),
  tier: z.string().nullable(),
  visitedAt: z.string(),
});

const postSchema = z.object({
  wallet: z.string().min(32).max(44),
  entries: z.array(entrySchema).min(1).max(200),
});

const getSchema = z.object({
  wallet: z.string().min(32).max(44),
  type: z.enum(["token", "deployer", "reputation"]).optional(),
});

// ---------------------------------------------------------------------------
// POST — Sync local history entries to Supabase
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

    const { wallet, entries } = parsed.data;
    const supabase = createServerSupabaseClient();

    const rows = entries.map((e) => ({
      wallet,
      type: e.type,
      subject: e.subject,
      name: e.name,
      symbol: e.symbol,
      score: e.score,
      tier: e.tier,
      visited_at: e.visitedAt,
    }));

    const { error } = await supabase
      .from("browsing_history")
      .upsert(rows, { onConflict: "wallet,type,subject" });

    if (error) {
      console.error("Browsing history sync error:", error);
      return NextResponse.json(
        { error: "Failed to sync history" },
        { status: 500 }
      );
    }

    return NextResponse.json({ synced: rows.length });
  } catch (error) {
    console.error("POST /api/history/browsing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET — Fetch browsing history from Supabase
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = getSchema.safeParse({
      wallet: searchParams.get("wallet"),
      type: searchParams.get("type") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { wallet, type } = parsed.data;
    const supabase = createServerSupabaseClient();

    let query = supabase
      .from("browsing_history")
      .select("*")
      .eq("wallet", wallet)
      .order("visited_at", { ascending: false })
      .limit(200);

    if (type) {
      query = query.eq("type", type);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Browsing history fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch history" },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("GET /api/history/browsing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
