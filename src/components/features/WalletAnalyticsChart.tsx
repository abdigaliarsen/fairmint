"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type { WalletFeatures } from "@/types/database";

interface WalletAnalyticsChartProps {
  features: WalletFeatures | null | undefined;
}

function formatScore(score: number): string {
  return `${Math.round(score)}/100`;
}

export default function WalletAnalyticsChart({
  features,
}: WalletAnalyticsChartProps) {
  if (!features) return null;

  // FairScale percentiles may be 0-1 or 0-100 depending on the wallet.
  // Normalize: if > 1, treat as already 0-100; if <= 1, scale to 0-100.
  function pct(v: number | undefined): number {
    const raw = v ?? 0;
    const scaled = raw > 1 ? raw : raw * 100;
    return Math.min(100, Math.round(scaled));
  }

  const radarData = [
    {
      metric: "SOL Balance",
      value: pct(features.native_sol_percentile),
    },
    {
      metric: "Major Tokens",
      value: pct(features.major_percentile_score),
    },
    {
      metric: "Stablecoins",
      value: pct(features.stable_percentile_score),
    },
    {
      metric: "Liquid Staking",
      value: pct(features.lst_percentile_score),
    },
    {
      metric: "Activity",
      value: pct(features.active_days),
    },
    {
      metric: "Tx Volume",
      value: pct(features.tx_count),
    },
  ];

  const stats = [
    {
      label: "Wallet Age",
      value: features.wallet_age_score != null
        ? formatScore(features.wallet_age_score)
        : "N/A",
    },
    {
      label: "Tx Activity",
      value: features.tx_count != null
        ? formatScore(features.tx_count)
        : "N/A",
    },
    {
      label: "Active Days",
      value: features.active_days != null
        ? formatScore(features.active_days)
        : "N/A",
    },
    {
      label: "Consistency",
      value: features.median_gap_hours != null
        ? formatScore(features.median_gap_hours)
        : "N/A",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Wallet Analytics</CardTitle>
        <CardDescription>
          On-chain footprint from FairScale feature analysis.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0].payload as { metric: string; value: number };
                return (
                  <div className="rounded-md border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-sm">
                    <p className="font-medium">{item.metric}</p>
                    <p>Score: {item.value}/100</p>
                  </div>
                );
              }}
            />
            <Radar
              name="Wallet"
              dataKey="value"
              stroke="#7c3aed"
              fill="#7c3aed"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <span className="text-sm font-semibold text-foreground">
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
