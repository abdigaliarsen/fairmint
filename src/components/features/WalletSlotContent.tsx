"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import FairScoreDisplay from "@/components/features/FairScoreDisplay";
import { cn } from "@/lib/utils";
import type { WalletComparison } from "@/types/comparison";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function FeatureBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium tabular-nums text-foreground">
          {typeof value === "number" && value % 1 !== 0 ? value.toFixed(1) : value}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WalletSlotContentProps {
  data: WalletComparison;
}

export default function WalletSlotContent({ data }: WalletSlotContentProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(data.wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Address + Copy */}
      <div className="flex items-center gap-2">
        <span className="truncate font-mono text-sm text-foreground">
          {truncateAddress(data.wallet)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={handleCopy}
          aria-label="Copy wallet address"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </Button>
      </div>

      {/* FairScore ring */}
      <div className="flex justify-center">
        <FairScoreDisplay score={data.score} tier={data.tier} size="sm" />
      </div>

      <Separator />

      {/* Stats */}
      <div className="flex flex-col gap-2">
        {data.walletScore !== null && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Wallet Score</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {data.walletScore}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Badges</span>
          <Badge variant="outline" className="text-sm">
            {data.badges.length}
          </Badge>
        </div>
      </div>

      {/* Feature bars */}
      {data.features && (
        <>
          <Separator />
          <div className="flex flex-col gap-2.5">
            <span className="text-sm font-medium text-muted-foreground">
              Activity
            </span>
            <FeatureBar label="Transactions" value={data.features.tx_count} max={1000} />
            <FeatureBar label="Active Days" value={data.features.active_days} max={365} />
            <FeatureBar label="Wallet Age (days)" value={data.features.wallet_age_days} max={1000} />
            <FeatureBar label="Median Gap (hrs)" value={data.features.median_gap_hours} max={168} />
          </div>

          <Separator />

          {/* Percentile grid */}
          <div className="flex flex-col gap-2.5">
            <span className="text-sm font-medium text-muted-foreground">
              Percentiles
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "LST", value: data.features.lst_percentile_score },
                { label: "Major", value: data.features.major_percentile_score },
                { label: "Stable", value: data.features.stable_percentile_score },
                { label: "Native", value: data.features.native_sol_percentile },
              ].map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "flex flex-col items-center rounded-md border px-2 py-1.5",
                    item.value >= 70
                      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                      : "border-border bg-muted/50"
                  )}
                >
                  <span className="text-[10px] text-muted-foreground">
                    {item.label}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {item.value.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
