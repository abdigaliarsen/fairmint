"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface TrustRatingProps {
  rating: number;
  animate?: boolean;
}

function getRatingColor(rating: number): {
  bar: string;
  text: string;
  label: string;
} {
  if (rating >= 60) {
    return { bar: "bg-emerald-500", text: "text-emerald-600", label: "Trusted" };
  }
  if (rating >= 30) {
    return { bar: "bg-yellow-500", text: "text-yellow-600", label: "Caution" };
  }
  return { bar: "bg-red-500", text: "text-red-600", label: "Risky" };
}

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
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) rafId = requestAnimationFrame(step);
    }

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration, enabled]);

  return value;
}

export default function TrustRating({ rating, animate = true }: TrustRatingProps) {
  const clamped = Math.min(Math.max(rating, 0), 100);
  const animatedValue = useAnimatedValue(clamped, 600, animate);
  const colors = getRatingColor(clamped);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Trust Rating
        </span>
        <div className="flex items-center gap-1.5">
          <span className={cn("text-sm font-semibold", colors.text)}>
            {Math.round(animatedValue)}
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
          className={cn("h-full rounded-full transition-all duration-700", colors.bar)}
          style={{ width: `${animatedValue}%` }}
        />
      </div>
    </div>
  );
}
