"use client";

import type { ReactNode } from "react";
import { Shield, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import type { FairScoreTier } from "@/types/database";

interface TierGateProps {
  requiredTier: string;
  currentTier: string;
  children: ReactNode;
}

const TIER_ORDER: Record<string, number> = {
  unrated: -1,
  bronze: 0,
  silver: 1,
  gold: 2,
  platinum: 3,
};

function meetsRequirement(current: string, required: string): boolean {
  const currentRank = TIER_ORDER[current.toLowerCase()] ?? -1;
  const requiredRank = TIER_ORDER[required.toLowerCase()] ?? -1;
  return currentRank >= requiredRank;
}

export default function TierGate({
  requiredTier,
  currentTier,
  children,
}: TierGateProps) {
  if (meetsRequirement(currentTier, requiredTier)) {
    return <>{children}</>;
  }

  const requiredColors = getTierColor(requiredTier as FairScoreTier);

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <div
          className={cn(
            "flex size-14 items-center justify-center rounded-full",
            requiredColors.bg
          )}
        >
          <Lock className={cn("size-6", requiredColors.text)} />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-foreground">
            <span className={cn("capitalize", requiredColors.text)}>
              {requiredTier}
            </span>{" "}
            Tier Required
          </h3>
          <p className="text-sm text-muted-foreground">
            This feature requires a{" "}
            <span className={cn("font-medium capitalize", requiredColors.text)}>
              {requiredTier}
            </span>{" "}
            tier or higher to access.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="size-3.5" aria-hidden="true" />
          <span>
            Improve your FairScale reputation to unlock this feature.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
