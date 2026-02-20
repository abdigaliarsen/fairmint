"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import type { FairScoreTier } from "@/types/database";
import { Award } from "lucide-react";

interface DeployerCardProps {
  wallet: string;
  fairscore: number;
  tier: FairScoreTier;
  badgeCount: number;
}

export default function DeployerCard({
  wallet,
  fairscore,
  tier,
  badgeCount,
}: DeployerCardProps) {
  const colors = getTierColor(tier);
  const truncatedWallet = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

  return (
    <Link
      href={`/deployer/${wallet}`}
      className="block"
      aria-label={`View deployer ${truncatedWallet} profile`}
    >
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-4 py-4">
          {/* Score circle */}
          <div
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-full border-2",
              colors.border,
              colors.bg
            )}
          >
            <span className={cn("text-sm font-bold", colors.text)}>
              {Math.round(fairscore)}
            </span>
          </div>

          {/* Info */}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate font-mono text-sm text-foreground">
              {truncatedWallet}
            </span>
            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  "border capitalize",
                  colors.bg,
                  colors.text,
                  colors.border
                )}
              >
                {tier}
              </Badge>
              {badgeCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Award className="size-3" />
                  {badgeCount}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
