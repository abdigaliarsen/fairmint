"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import type { FairScoreTier } from "@/types/database";

export interface TokenNode {
  mint: string;
  name: string | null;
  symbol: string | null;
  trustRating: number;
  deployerTier: FairScoreTier | null;
}

interface TokenGraphProps {
  tokens: TokenNode[];
  walletLabel: string;
  walletTier: FairScoreTier;
  loading?: boolean;
}

const TIER_FILL: Record<FairScoreTier, string> = {
  platinum: "#7c3aed",
  gold: "#eab308",
  silver: "#64748b",
  bronze: "#d97706",
  unrated: "#9ca3af",
};

function ratingColor(rating: number): string {
  if (rating >= 60) return "#059669"; // emerald-600
  if (rating >= 30) return "#ca8a04"; // yellow-600
  return "#dc2626"; // red-600
}

const CENTER_X = 200;
const CENTER_Y = 200;
const ORBIT_RADIUS = 130;

export default function TokenGraph({
  tokens,
  walletLabel,
  walletTier,
  loading,
}: TokenGraphProps) {
  const router = useRouter();

  const nodes = useMemo(() => {
    if (tokens.length === 0) return [];

    return tokens.map((t, i) => {
      const angle = (2 * Math.PI * i) / tokens.length - Math.PI / 2;
      // Node size based on trust rating (higher = bigger)
      const r = 16 + (t.trustRating / 100) * 14;
      const color = ratingColor(t.trustRating);
      const label = t.symbol ?? t.name?.slice(0, 6) ?? t.mint.slice(0, 4);

      return {
        ...t,
        cx: CENTER_X + ORBIT_RADIUS * Math.cos(angle),
        cy: CENTER_Y + ORBIT_RADIUS * Math.sin(angle),
        r,
        color,
        label,
      };
    });
  }, [tokens]);

  if (loading) {
    return <Skeleton className="h-[400px] w-full rounded-lg" />;
  }

  if (tokens.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No deployed tokens found for this wallet.
      </p>
    );
  }

  const centerFill = TIER_FILL[walletTier] || TIER_FILL.unrated;

  return (
    <div className="flex flex-col gap-4">
      <svg
        viewBox="0 0 400 400"
        className="mx-auto w-full max-w-[400px]"
        role="img"
        aria-label={`Token network for deployer ${walletLabel}`}
      >
        {/* Lines from center to each token node */}
        {nodes.map((node) => (
          <line
            key={`line-${node.mint}`}
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={node.cx}
            y2={node.cy}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
          />
        ))}

        {/* Center node (deployer wallet) */}
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={32}
          fill={centerFill}
          fillOpacity={0.9}
        />
        <text
          x={CENTER_X}
          y={CENTER_Y + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={9}
          fontWeight={600}
        >
          {walletLabel}
        </text>

        {/* Token nodes — clickable, navigate to token page */}
        {nodes.map((node) => (
          <g
            key={node.mint}
            className="cursor-pointer [&:hover_circle:first-child]:fill-opacity-20 [&:focus_circle:first-child]:fill-opacity-20"
            role="link"
            tabIndex={0}
            aria-label={`View ${node.name ?? node.symbol ?? node.mint} token`}
            onClick={() => router.push(`/token/${node.mint}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(`/token/${node.mint}`);
              }
            }}
          >
            {/* Hover ring */}
            <circle
              cx={node.cx}
              cy={node.cy}
              r={node.r + 5}
              fill={node.color}
              fillOpacity={0}
              className="transition-all duration-200"
            />
            <circle
              cx={node.cx}
              cy={node.cy}
              r={node.r}
              fill={node.color}
              fillOpacity={0.85}
              stroke={node.color}
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
              {node.label}
            </text>
            <text
              x={node.cx}
              y={node.cy + 3}
              textAnchor="middle"
              fill="white"
              fontSize={9}
              fontWeight={600}
            >
              {node.trustRating}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
        aria-label="Trust rating color legend"
      >
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-emerald-600" />
          <span>Trusted (60+)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-yellow-600" />
          <span>Caution (30-59)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-red-600" />
          <span>Risky (&lt;30)</span>
        </div>
      </div>
    </div>
  );
}
