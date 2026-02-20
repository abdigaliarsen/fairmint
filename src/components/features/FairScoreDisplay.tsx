"use client";

import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import type { FairScoreTier } from "@/types/database";

interface FairScoreDisplayProps {
  score: number;
  tier: string;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
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

function useAnimatedValue(target: number, duration: number, enabled: boolean): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || target === 0) {
      setValue(target);
      return;
    }

    startRef.current = null;
    let rafId: number;

    function step(timestamp: number) {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(target * eased);
      if (progress < 1) rafId = requestAnimationFrame(step);
    }

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration, enabled]);

  return value;
}

export default function FairScoreDisplay({
  score,
  tier,
  size = "md",
  animate = true,
}: FairScoreDisplayProps) {
  const tierKey = tier as FairScoreTier;
  const colors = getTierColor(tierKey);
  const config = sizeConfig[size];

  const animatedScore = useAnimatedValue(
    Math.min(Math.max(score, 0), 100),
    600,
    animate
  );

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset =
    circumference - (animatedScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn("relative", config.container)}>
        <svg
          className={cn("rotate-[-90deg]", config.ring)}
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            className="text-muted/30"
          />
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
            className={cn("transition-colors duration-500", colors.text)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(config.score, "transition-colors duration-500", colors.text)}
            aria-label={`FairScore: ${score}`}
          >
            {Math.round(animatedScore)}
          </span>
        </div>
      </div>

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
