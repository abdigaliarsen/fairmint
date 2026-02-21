"use client";

import { useState, useEffect } from "react";
import { useOnboarding } from "@/hooks/useOnboarding";
import SpotlightOverlay from "@/components/features/SpotlightOverlay";
import TourTooltip from "@/components/features/TourTooltip";

function isTargetVisible(target: string): boolean {
  const elements = document.querySelectorAll(`[data-tour="${target}"]`);
  for (const el of elements) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return true;
  }
  return false;
}

export default function SpotlightTour() {
  const {
    phase,
    spotlightStep,
    tourSteps,
    nextSpotlight,
    prevSpotlight,
    completeSpotlight,
  } = useOnboarding();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // Auto-skip invisible targets — advances one step at a time,
  // the effect re-fires on each step change until a visible target is found
  useEffect(() => {
    if (phase !== "spotlight") return;

    if (spotlightStep >= tourSteps.length) {
      completeSpotlight();
      return;
    }

    const currentTarget = tourSteps[spotlightStep]?.target;
    if (currentTarget && !isTargetVisible(currentTarget)) {
      nextSpotlight();
    }
  }, [phase, spotlightStep, tourSteps, nextSpotlight, completeSpotlight]);

  if (phase !== "spotlight") return null;

  const currentStep = tourSteps[spotlightStep];
  if (!currentStep) return null;

  // Count visible steps for display
  const visibleSteps = tourSteps.filter((s) => isTargetVisible(s.target));
  const visibleIndex = visibleSteps.findIndex(
    (s) => s.target === currentStep.target
  );

  return (
    <>
      <SpotlightOverlay
        targetSelector={currentStep.target}
        onRectChange={setTargetRect}
      />
      <TourTooltip
        targetRect={targetRect}
        title={currentStep.title}
        description={currentStep.description}
        stepIndex={visibleIndex >= 0 ? visibleIndex : spotlightStep}
        totalSteps={visibleSteps.length || tourSteps.length}
        placement={currentStep.placement}
        onNext={nextSpotlight}
        onPrev={prevSpotlight}
        onSkip={completeSpotlight}
        isFirst={spotlightStep === 0}
        isLast={spotlightStep === tourSteps.length - 1}
      />
    </>
  );
}
