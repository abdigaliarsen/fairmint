"use client";

import { CalendarDays, Coins, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface DeployedTokenSummary {
  trust_rating: number;
  analyzed_at: string;
}

interface DeployerTimelineProps {
  tokens: DeployedTokenSummary[];
}

export default function DeployerTimeline({ tokens }: DeployerTimelineProps) {
  if (tokens.length === 0) return null;

  const sorted = [...tokens].sort(
    (a, b) => new Date(a.analyzed_at).getTime() - new Date(b.analyzed_at).getTime()
  );

  const firstDate = new Date(sorted[0].analyzed_at);
  const latestDate = new Date(sorted[sorted.length - 1].analyzed_at);
  const riskyCount = tokens.filter((t) => t.trust_rating < 20).length;

  const daysSinceFirst = Math.max(
    1,
    Math.floor((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const stats = [
    {
      icon: CalendarDays,
      label: "First deployment",
      value: `${daysSinceFirst}d ago`,
    },
    {
      icon: Coins,
      label: "Tokens deployed",
      value: tokens.length.toString(),
    },
    {
      icon: Clock,
      label: "Latest",
      value: latestDate.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    },
    ...(riskyCount > 0
      ? [{
          icon: AlertTriangle,
          label: "Low-trust tokens",
          value: riskyCount.toString(),
        }]
      : []),
  ];

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 py-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-1.5">
            <stat.icon className="size-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{stat.label}:</span>
            <span className="text-xs font-semibold text-foreground">{stat.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
