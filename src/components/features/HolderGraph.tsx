"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import type { HolderNode } from "@/hooks/useHolders";
import type { FairScoreTier } from "@/types/database";

interface HolderGraphProps {
  holders: HolderNode[];
  tokenName: string | null;
  loading?: boolean;
}

const TIER_FILL: Record<FairScoreTier, string> = {
  platinum: "#7c3aed",
  gold: "#eab308",
  silver: "#64748b",
  bronze: "#d97706",
  unrated: "#9ca3af",
};

const CENTER_X = 200;
const CENTER_Y = 200;
const ORBIT_RADIUS = 130;

export default function HolderGraph({
  holders,
  tokenName,
  loading,
}: HolderGraphProps) {
  const router = useRouter();
  const nodes = useMemo(() => {
    if (holders.length === 0) return [];

    const maxPct = Math.max(...holders.map((h) => h.percentage), 1);
    const minR = 12;
    const maxR = 28;

    return holders.map((h, i) => {
      const angle = (2 * Math.PI * i) / holders.length - Math.PI / 2;
      const radius = minR + (h.percentage / maxPct) * (maxR - minR);

      return {
        ...h,
        cx: CENTER_X + ORBIT_RADIUS * Math.cos(angle),
        cy: CENTER_Y + ORBIT_RADIUS * Math.sin(angle),
        r: radius,
        fill: TIER_FILL[h.tier] || TIER_FILL.unrated,
        truncAddr: `${h.owner.slice(0, 4)}...${h.owner.slice(-4)}`,
      };
    });
  }, [holders]);

  if (loading) {
    return <Skeleton className="h-[400px] w-full rounded-lg" />;
  }

  if (holders.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No holder data available for visualization.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <svg
        viewBox="0 0 400 400"
        className="mx-auto w-full max-w-[400px]"
        role="img"
        aria-label={`Holder network graph for ${tokenName ?? "token"}`}
      >
        {/* Lines from center to each node */}
        {nodes.map((node) => (
          <line
            key={`line-${node.owner}`}
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={node.cx}
            y2={node.cy}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
          />
        ))}

        {/* Center node (token) */}
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={32}
          fill="currentColor"
          className="text-emerald-600"
        />
        <text
          x={CENTER_X}
          y={CENTER_Y + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={10}
          fontWeight={600}
        >
          TOKEN
        </text>

        {/* Holder nodes — clickable, navigate to reputation page */}
        {nodes.map((node) => (
          <g
            key={node.owner}
            className="cursor-pointer [&:hover_circle:first-child]:fill-opacity-20 [&:focus_circle:first-child]:fill-opacity-20"
            role="link"
            tabIndex={0}
            aria-label={`View reputation for ${node.truncAddr}`}
            onClick={() => router.push(`/reputation/${node.owner}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(`/reputation/${node.owner}`);
              }
            }}
          >
            {/* Hover ring */}
            <circle
              cx={node.cx}
              cy={node.cy}
              r={node.r + 5}
              fill={node.fill}
              fillOpacity={0}
              className="transition-all duration-200"
            />
            <circle
              cx={node.cx}
              cy={node.cy}
              r={node.r}
              fill={node.fill}
              fillOpacity={0.85}
              stroke={node.fill}
              strokeWidth={2}
              strokeOpacity={0.3}
            />
            <text
              x={node.cx}
              y={node.cy - node.r - 6}
              textAnchor="middle"
              fill="currentColor"
              className="text-muted-foreground"
              fontSize={9}
            >
              {node.truncAddr}
            </text>
            <text
              x={node.cx}
              y={node.cy + 3}
              textAnchor="middle"
              fill="white"
              fontSize={9}
              fontWeight={600}
            >
              {node.percentage.toFixed(0)}%
            </text>
          </g>
        ))}
      </svg>

      {/* Tier legend */}
      <div
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
        aria-label="Tier color legend"
      >
        {(
          ["platinum", "gold", "silver", "bronze", "unrated"] as FairScoreTier[]
        ).map((tier) => {
          const colors = getTierColor(tier);
          return (
            <div key={tier} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-block size-2.5 rounded-full border",
                  colors.bg,
                  colors.border
                )}
                aria-hidden="true"
              />
              <span className="capitalize">{tier}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
