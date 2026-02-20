import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const querySchema = z.object({
  mint: z.string().min(32).max(44),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ mint: searchParams.get("mint") });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid mint" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("token_score_history")
    .select("trust_rating, holder_count, risk_flag_count, recorded_at")
    .eq("mint", parsed.data.mint)
    .gte("recorded_at", thirtyDaysAgo)
    .order("recorded_at", { ascending: true });

  if (error) {
    console.error("Token history query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }

  return NextResponse.json(data ?? []);
}
