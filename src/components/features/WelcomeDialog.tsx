"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/hooks/useOnboarding";

export default function WelcomeDialog() {
  const {
    phase,
    welcomeStep,
    welcomeSlides,
    nextWelcome,
    prevWelcome,
    skipWelcome,
    completeWelcome,
  } = useOnboarding();

  const isOpen = phase === "welcome";
  const slide = welcomeSlides[welcomeStep];
  const isLast = welcomeStep === welcomeSlides.length - 1;
  const isFirst = welcomeStep === 0;

  if (!slide) return null;

  const Icon = slide.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && skipWelcome()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
            <Icon className="size-8 text-emerald-600" />
          </div>
          <DialogTitle className="text-xl">{slide.title}</DialogTitle>
          <DialogDescription className="text-balance">
            {slide.description}
          </DialogDescription>
        </DialogHeader>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-2">
          {welcomeSlides.map((_, i) => (
            <div
              key={i}
              className={cn(
                "size-2 rounded-full transition-colors",
                i === welcomeStep
                  ? "bg-emerald-600"
                  : "bg-muted-foreground/30"
              )}
            />
          ))}
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <button
            onClick={skipWelcome}
            className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={prevWelcome}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={completeWelcome}
              >
                Get Started
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={nextWelcome}
              >
                Next
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
