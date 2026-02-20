import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { analyzeToken } from "@/services/tokenAnalyzer";

const getSchema = z.object({
  wallet: z.string().min(32).max(44),
});

const patchSchema = z.object({
  wallet: z.string().min(32).max(44),
  notificationIds: z.array(z.string().uuid()).optional(),
  markAllRead: z.boolean().optional(),
});

/**
 * GET /api/notifications?wallet=...
 * Returns notifications + checks watchlist tokens for changes (generates new alerts).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = getSchema.safeParse({
      wallet: searchParams.get("wallet") ?? "",
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    const { wallet } = parsed.data;

    // Fetch existing notifications
    const { data: notifications } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_wallet", wallet)
      .order("created_at", { ascending: false })
      .limit(50);

    // Check watchlist for changes (generate new alerts)
    const { data: watchlistItems } = await supabase
      .from("watchlist")
      .select("mint")
      .eq("user_id", wallet);

    if (watchlistItems && watchlistItems.length > 0) {
      // Get current cached analyses
      const mints = watchlistItems.map((w) => w.mint);
      const { data: cachedAnalyses } = await supabase
        .from("token_analyses")
        .select("mint, name, trust_rating, risk_flags, analyzed_at")
        .in("mint", mints);

      // Re-analyze a subset to check for changes (limit to 3 per visit to respect rate limits)
      const toCheck = mints.slice(0, 3);
      for (const mint of toCheck) {
        const cached = cachedAnalyses?.find((a) => a.mint === mint);
        if (!cached) continue;

        const fresh = await analyzeToken(mint);
        if (!fresh) continue;

        const ratingDiff = Math.abs(fresh.trustRating - cached.trust_rating);

        // Generate alert if trust rating changed by 5+ points
        if (ratingDiff >= 5) {
          const existing = (notifications ?? []).find(
            (n) =>
              n.mint === mint &&
              n.type === "score_change" &&
              new Date(n.created_at).getTime() >
                Date.now() - 24 * 60 * 60 * 1000
          );

          if (!existing) {
            await supabase.from("notifications").insert({
              user_wallet: wallet,
              mint,
              token_name: fresh.name,
              type: "score_change",
              message: `${fresh.name ?? mint.slice(0, 8)} trust rating changed from ${cached.trust_rating} to ${fresh.trustRating}`,
              old_value: cached.trust_rating,
              new_value: fresh.trustRating,
              read: false,
            });
          }
        }

        // Check for new risk flags
        const oldFlagCount = Array.isArray(cached.risk_flags)
          ? cached.risk_flags.length
          : 0;
        if (fresh.riskFlags.length > oldFlagCount) {
          const existing = (notifications ?? []).find(
            (n) =>
              n.mint === mint &&
              n.type === "new_risk_flag" &&
              new Date(n.created_at).getTime() >
                Date.now() - 24 * 60 * 60 * 1000
          );

          if (!existing) {
            await supabase.from("notifications").insert({
              user_wallet: wallet,
              mint,
              token_name: fresh.name,
              type: "new_risk_flag",
              message: `New risk flag detected for ${fresh.name ?? mint.slice(0, 8)}`,
              old_value: oldFlagCount,
              new_value: fresh.riskFlags.length,
              read: false,
            });
          }
        }
      }
    }

    // Re-fetch notifications after potential inserts
    const { data: updatedNotifications } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_wallet", wallet)
      .order("created_at", { ascending: false })
      .limit(50);

    const unreadCount =
      updatedNotifications?.filter((n) => !n.read).length ?? 0;

    return NextResponse.json({
      notifications: updatedNotifications ?? [],
      unreadCount,
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications — mark notifications as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    const { wallet, notificationIds, markAllRead } = parsed.data;

    if (markAllRead) {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_wallet", wallet)
        .eq("read", false);
    } else if (notificationIds?.length) {
      await supabase
        .from("notifications")
        .update({ read: true })
        .in("id", notificationIds);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
