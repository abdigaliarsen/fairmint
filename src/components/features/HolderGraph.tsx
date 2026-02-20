"use client";

import { useMemo, useState } from "react";
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
const TOOLTIP_W = 150;
const TOOLTIP_H = 80;

export default function HolderGraph({
  holders,
  tokenName,
  loading,
}: HolderGraphProps) {
  const router = useRouter();
  const [hoveredOwner, setHoveredOwner] = useState<string | null>(null);

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

  const hoveredNode = nodes.find((n) => n.owner === hoveredOwner);

  function tooltipPos(node: (typeof nodes)[number]) {
    const tx = node.cx > CENTER_X ? node.cx - TOOLTIP_W - 10 : node.cx + 10;
    const ty = node.cy - TOOLTIP_H / 2;
    return { tx, ty };
  }

  return (
    <div className="flex flex-col gap-4">
      <svg
        viewBox="0 0 400 400"
        className="mx-auto w-full max-w-[400px]"
        role="img"
        aria-label={`Holder network graph for ${tokenName ?? "token"}`}
        style={{ overflow: "visible" }}
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
            strokeOpacity={hoveredOwner === node.owner ? 0.3 : 0.1}
            strokeWidth={hoveredOwner === node.owner ? 2 : 1}
            className="transition-all duration-200"
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
            onMouseEnter={() => setHoveredOwner(node.owner)}
            onMouseLeave={() => setHoveredOwner(null)}
            onFocus={() => setHoveredOwner(node.owner)}
            onBlur={() => setHoveredOwner(null)}
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

        {/* Hover tooltip rendered inside SVG via foreignObject */}
        {hoveredNode && (() => {
          const { tx, ty } = tooltipPos(hoveredNode);
          return (
            <foreignObject
              x={tx}
              y={ty}
              width={TOOLTIP_W}
              height={TOOLTIP_H}
              style={{ pointerEvents: "none", overflow: "visible" }}
            >
              <div
                className="rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md"
                style={{ fontSize: 11 }}
              >
                <div className="mb-1 font-mono text-[10px] font-semibold">
                  {hoveredNode.truncAddr}
                </div>
                <div className="flex flex-col gap-0.5" style={{ fontSize: 10 }}>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Holding</span>
                    <span className="font-medium">
                      {hoveredNode.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tier</span>
                    <span className="flex items-center gap-1">
                      <span
                        className="inline-block size-1.5 rounded-full"
                        style={{ backgroundColor: hoveredNode.fill }}
                      />
                      <span className="font-medium capitalize">
                        {hoveredNode.tier}
                      </span>
                    </span>
                  </div>
                  {hoveredNode.fairScore !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">FairScore</span>
                      <span className="font-medium">{hoveredNode.fairScore}</span>
                    </div>
                  )}
                </div>
              </div>
            </foreignObject>
          );
        })()}
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
