import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const querySchema = z.object({
  wallet: z.string().min(32).max(44),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ wallet: searchParams.get("wallet") });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("wallet_score_history")
    .select("score_decimal, score_integer, tier, recorded_at")
    .eq("wallet", parsed.data.wallet)
    .gte("recorded_at", thirtyDaysAgo)
    .order("recorded_at", { ascending: true });

  if (error) {
    console.error("Wallet history query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }

  return NextResponse.json(data ?? []);
}
