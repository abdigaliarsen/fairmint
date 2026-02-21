"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import type { TourPlacement } from "@/providers/OnboardingProvider";

interface TourTooltipProps {
  targetRect: DOMRect | null;
  title: string;
  description: string;
  stepIndex: number;
  totalSteps: number;
  placement: TourPlacement;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export default function TourTooltip({
  targetRect,
  title,
  description,
  stepIndex,
  totalSteps,
  placement,
  onNext,
  onPrev,
  onSkip,
  isFirst,
  isLast,
}: TourTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const computePosition = useCallback(() => {
    if (!targetRect || !tooltipRef.current) return;

    const tt = tooltipRef.current.getBoundingClientRect();
    const gap = 12;
    let top = 0;
    let left = 0;

    switch (placement) {
      case "bottom":
        top = targetRect.bottom + gap;
        left = targetRect.left + targetRect.width / 2 - tt.width / 2;
        break;
      case "top":
        top = targetRect.top - gap - tt.height;
        left = targetRect.left + targetRect.width / 2 - tt.width / 2;
        break;
      case "left":
        top = targetRect.top + targetRect.height / 2 - tt.height / 2;
        left = targetRect.left - gap - tt.width;
        break;
      case "right":
        top = targetRect.top + targetRect.height / 2 - tt.height / 2;
        left = targetRect.right + gap;
        break;
    }

    // Clamp to viewport
    const margin = 12;
    left = Math.max(margin, Math.min(left, window.innerWidth - tt.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - tt.height - margin));

    setPos({ top, left });
  }, [targetRect, placement]);

  useEffect(() => {
    computePosition();
  }, [computePosition]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onSkip();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        if (isLast) {
          onSkip(); // finish
        } else {
          onNext();
        }
      } else if (e.key === "ArrowLeft") {
        if (!isFirst) {
          onPrev();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNext, onPrev, onSkip, isFirst, isLast]);

  if (!targetRect) return null;

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[61] w-72 rounded-lg border bg-popover p-4 shadow-lg sm:w-80"
      style={{ top: pos.top, left: pos.left }}
      role="dialog"
      aria-label={title}
    >
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">
          {stepIndex + 1} of {totalSteps}
        </span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      <div className="flex items-center justify-between">
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          Skip tour
        </button>
        <div className="flex items-center gap-2">
          {!isFirst && (
            <Button variant="outline" size="sm" onClick={onPrev}>
              Back
            </Button>
          )}
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={isLast ? onSkip : onNext}
          >
            {isLast ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
