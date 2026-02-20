"use client";

import { useState, useEffect } from "react";
import { Check, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STEPS = [
  "Fetching metadata",
  "Checking deployer",
  "Analyzing holders",
  "Computing trust score",
];

const STEP_INTERVAL_MS = 400;

export default function AnalysisProgress() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (activeStep >= STEPS.length) return;

    const timer = setTimeout(() => {
      setActiveStep((prev) => prev + 1);
    }, STEP_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [activeStep]);

  return (
    <Card>
      <CardContent className="py-10">
        <div className="mx-auto flex max-w-xs flex-col gap-3">
          {STEPS.map((step, i) => {
            const isDone = i < activeStep;
            const isActive = i === activeStep;

            return (
              <div
                key={step}
                className={cn(
                  "flex items-center gap-3 transition-opacity duration-300",
                  !isDone && !isActive && "opacity-40"
                )}
              >
                <div className="flex size-5 shrink-0 items-center justify-center">
                  {isDone ? (
                    <Check className="size-4 text-emerald-500" />
                  ) : isActive ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="size-1.5 rounded-full bg-muted-foreground/40" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm",
                    isDone
                      ? "font-medium text-foreground"
                      : isActive
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                  )}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
