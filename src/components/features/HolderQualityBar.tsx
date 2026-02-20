"use client";

import { cn } from "@/lib/utils";
import { Users } from "lucide-react";

interface HolderQualityBarProps {
  score: number;
  holderCount: number;
}

function getQualityColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

function getQualityTextColor(score: number): string {
  if (score >= 70) return "text-emerald-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-600";
}

export default function HolderQualityBar({
  score,
  holderCount,
}: HolderQualityBarProps) {
  const clamped = Math.min(Math.max(score, 0), 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Holder Quality
        </span>
        <span className={cn("text-sm font-semibold", getQualityTextColor(clamped))}>
          {clamped}/100
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Holder quality score: ${clamped} out of 100`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            getQualityColor(clamped)
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="size-3" aria-hidden="true" />
        <span>
          {holderCount.toLocaleString()} holder{holderCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
