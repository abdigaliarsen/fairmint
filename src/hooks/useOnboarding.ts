"use client";

import { useContext } from "react";
import {
  OnboardingContext,
  type OnboardingContextValue,
} from "@/providers/OnboardingProvider";

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return ctx;
}
