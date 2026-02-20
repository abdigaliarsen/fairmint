"use client";

import { cn } from "@/lib/utils";

interface TrustRatingProps {
  rating: number;
}

function getRatingColor(rating: number): {
  bar: string;
  text: string;
  label: string;
} {
  if (rating >= 60) {
    return {
      bar: "bg-emerald-500",
      text: "text-emerald-600",
      label: "Trusted",
    };
  }
  if (rating >= 30) {
    return {
      bar: "bg-yellow-500",
      text: "text-yellow-600",
      label: "Caution",
    };
  }
  return {
    bar: "bg-red-500",
    text: "text-red-600",
    label: "Risky",
  };
}

export default function TrustRating({ rating }: TrustRatingProps) {
  const clamped = Math.min(Math.max(rating, 0), 100);
  const colors = getRatingColor(clamped);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Trust Rating
        </span>
        <div className="flex items-center gap-1.5">
          <span className={cn("text-sm font-semibold", colors.text)}>
            {clamped}
          </span>
          <span className={cn("text-xs", colors.text)}>{colors.label}</span>
        </div>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Trust rating: ${clamped} out of 100`}
      >
        <div
          className={cn("h-full rounded-full transition-all", colors.bar)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
