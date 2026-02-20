"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import type { FairScoreTier, RiskFlag } from "@/types/database";

export interface TokenNode {
  mint: string;
  name: string | null;
  symbol: string | null;
  trustRating: number;
  deployerTier: FairScoreTier | null;
  riskFlags?: RiskFlag[];
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

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#dc2626",
  high: "#ef4444",
  medium: "#ca8a04",
  low: "#64748b",
};

function ratingColor(rating: number): string {
  if (rating >= 60) return "#059669"; // emerald-600
  if (rating >= 30) return "#ca8a04"; // yellow-600
  return "#dc2626"; // red-600
}

function ratingLabel(rating: number): string {
  if (rating >= 60) return "Trusted";
  if (rating >= 30) return "Caution";
  return "Risky";
}

const CENTER_X = 200;
const CENTER_Y = 200;
const ORBIT_RADIUS = 130;
const TOOLTIP_W = 170;
const TOOLTIP_BASE_H = 55;
const TOOLTIP_FLAG_H = 14;

export default function TokenGraph({
  tokens,
  walletLabel,
  walletTier,
  loading,
}: TokenGraphProps) {
  const router = useRouter();
  const [hoveredMint, setHoveredMint] = useState<string | null>(null);

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
  const hoveredNode = nodes.find((n) => n.mint === hoveredMint);

  function tooltipPos(node: (typeof nodes)[number]) {
    const flagCount = node.riskFlags?.length ?? 0;
    const h = TOOLTIP_BASE_H + flagCount * TOOLTIP_FLAG_H;
    const tx = node.cx > CENTER_X ? node.cx - TOOLTIP_W - 10 : node.cx + 10;
    const ty = node.cy - h / 2;
    return { tx, ty, h };
  }

  return (
    <div className="flex flex-col gap-4">
      <svg
        viewBox="0 0 400 400"
        className="mx-auto w-full max-w-[400px]"
        role="img"
        aria-label={`Token network for deployer ${walletLabel}`}
        style={{ overflow: "visible" }}
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
            strokeOpacity={hoveredMint === node.mint ? 0.3 : 0.1}
            strokeWidth={hoveredMint === node.mint ? 2 : 1}
            className="transition-all duration-200"
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
            onMouseEnter={() => setHoveredMint(node.mint)}
            onMouseLeave={() => setHoveredMint(null)}
            onFocus={() => setHoveredMint(node.mint)}
            onBlur={() => setHoveredMint(null)}
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

        {/* Hover tooltip rendered inside SVG via foreignObject */}
        {hoveredNode && (() => {
          const { tx, ty, h } = tooltipPos(hoveredNode);
          return (
            <foreignObject
              x={tx}
              y={ty}
              width={TOOLTIP_W}
              height={h}
              style={{ pointerEvents: "none", overflow: "visible" }}
            >
              <div
                className="rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md"
                style={{ fontSize: 11 }}
              >
                <div className="mb-1 text-xs font-semibold">
                  {hoveredNode.name ?? hoveredNode.symbol ?? hoveredNode.mint.slice(0, 8)}
                </div>
                <div className="mb-1 flex items-center gap-1.5" style={{ fontSize: 10 }}>
                  <span
                    className="inline-block size-1.5 rounded-full"
                    style={{ backgroundColor: hoveredNode.color }}
                  />
                  <span>
                    Trust: {hoveredNode.trustRating} ({ratingLabel(hoveredNode.trustRating)})
                  </span>
                </div>
                {hoveredNode.riskFlags && hoveredNode.riskFlags.length > 0 ? (
                  <div className="flex flex-col gap-0.5">
                    <span
                      className="text-muted-foreground"
                      style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}
                    >
                      Risk Flags
                    </span>
                    {hoveredNode.riskFlags.map((flag) => (
                      <div
                        key={flag.id}
                        className="flex items-center gap-1"
                        style={{ fontSize: 10 }}
                      >
                        <span
                          className="inline-block size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: SEVERITY_COLOR[flag.severity] ?? "#64748b" }}
                        />
                        <span style={{ color: SEVERITY_COLOR[flag.severity] ?? "#64748b" }}>
                          {flag.label}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: "#059669" }}>
                    No risk flags detected
                  </div>
                )}
              </div>
            </foreignObject>
          );
        })()}
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
