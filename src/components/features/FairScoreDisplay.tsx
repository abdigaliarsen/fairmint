"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import type { FairScoreTier } from "@/types/database";

interface FairScoreDisplayProps {
  score: number;
  tier: string;
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: {
    container: "size-16",
    score: "text-lg font-bold",
    ring: "size-16",
    strokeWidth: 3,
    badgeSize: "text-[10px] px-1.5 py-0",
  },
  md: {
    container: "size-24",
    score: "text-2xl font-bold",
    ring: "size-24",
    strokeWidth: 4,
    badgeSize: "text-xs px-2 py-0.5",
  },
  lg: {
    container: "size-32",
    score: "text-3xl font-bold",
    ring: "size-32",
    strokeWidth: 5,
    badgeSize: "text-sm px-2.5 py-0.5",
  },
} as const;

export default function FairScoreDisplay({
  score,
  tier,
  size = "md",
}: FairScoreDisplayProps) {
  const tierKey = tier as FairScoreTier;
  const colors = getTierColor(tierKey);
  const config = sizeConfig[size];

  // Normalize score to 0-100 for the circular progress
  const normalizedScore = Math.min(Math.max(score, 0), 100);
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset =
    circumference - (normalizedScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Circular Score Display */}
      <div className={cn("relative", config.container)}>
        <svg
          className={cn("rotate-[-90deg]", config.ring)}
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          {/* Background ring */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            className="text-muted/30"
          />
          {/* Progress ring */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={colors.text}
          />
        </svg>
        {/* Score number in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(config.score, colors.text)}
            aria-label={`FairScore: ${score}`}
          >
            {Math.round(score)}
          </span>
        </div>
      </div>

      {/* Tier Badge */}
      <Badge
        className={cn(
          "border capitalize",
          colors.bg,
          colors.text,
          colors.border,
          config.badgeSize
        )}
      >
        {tier}
      </Badge>
    </div>
  );
}
