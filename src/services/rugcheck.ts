/**
 * RugCheck service — fetches token risk assessment from RugCheck.xyz.
 * Free API, no key required. Cached in Supabase with 1-hour TTL.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface RugCheckRisk {
  name: string;
  description: string;
  level: "warn" | "danger" | "info" | "error" | "good";
  score: number;
}

export interface RugCheckResult {
  riskLevel: "Good" | "Warning" | "Danger" | "Unknown";
  riskCount: number;
  score: number;
  risks: RugCheckRisk[];
}

const CACHE_TTL_MS = 60 * 60 * 1000;

export async function getRugCheckReport(mint: string): Promise<RugCheckResult | null> {
  try {
    const supabase = createServerSupabaseClient();

    // Check cache
    const { data: cached } = await supabase
      .from("rugcheck_cache")
      .select("data, fetched_at")
      .eq("mint", mint)
      .maybeSingle();

    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < CACHE_TTL_MS) {
        const cachedResult = cached.data as RugCheckResult;
        // Backfill risks array for old cache entries
        if (!cachedResult.risks) cachedResult.risks = [];
        return cachedResult;
      }
    }

    // Fetch fresh data
    const res = await fetch(
      `https://api.rugcheck.xyz/v1/tokens/${encodeURIComponent(mint)}/report/summary`,
      { signal: AbortSignal.timeout(10_000) }
    );

    if (!res.ok) return null;

    const raw = await res.json();

    const risks: RugCheckRisk[] = (raw.risks ?? []).map(
      (r: { name?: string; description?: string; level?: string; score?: number }) => ({
        name: r.name ?? "Unknown Risk",
        description: r.description ?? "",
        level: r.level ?? "warn",
        score: r.score ?? 0,
      })
    );

    const result: RugCheckResult = {
      riskLevel: classifyRugCheckRisk(raw.score ?? 0),
      riskCount: risks.length,
      score: raw.score ?? 0,
      risks,
    };

    // Upsert cache
    await supabase
      .from("rugcheck_cache")
      .upsert(
        { mint, data: result as unknown as Record<string, unknown>, fetched_at: new Date().toISOString() },
        { onConflict: "mint" }
      );

    return result;
  } catch {
    return null;
  }
}

function classifyRugCheckRisk(score: number): RugCheckResult["riskLevel"] {
  if (score >= 700) return "Good";
  if (score >= 400) return "Warning";
  if (score > 0) return "Danger";
  return "Unknown";
}
