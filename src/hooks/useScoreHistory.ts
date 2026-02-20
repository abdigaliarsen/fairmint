"use client";

import { useState, useEffect } from "react";

export interface ScoreHistoryPoint {
  date: string;
  score: number;
}

interface UseScoreHistoryOptions {
  type: "wallet" | "token";
  subject: string | null;
}

export function useScoreHistory({ type, subject }: UseScoreHistoryOptions) {
  const [data, setData] = useState<ScoreHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!subject) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const param =
      type === "wallet"
        ? `wallet=${encodeURIComponent(subject)}`
        : `mint=${encodeURIComponent(subject)}`;

    fetch(`/api/history/${type}?${param}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: Array<Record<string, unknown>>) => {
        const points: ScoreHistoryPoint[] = rows.map((r) => ({
          date: new Date(r.recorded_at as string).toLocaleDateString(
            undefined,
            { month: "short", day: "numeric" }
          ),
          score: Number(
            type === "wallet" ? r.score_decimal : r.trust_rating
          ),
        }));
        setData(points);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [type, subject]);

  return { data, loading };
}
