"use client";

import { Copy, Check, ExternalLink } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import FairScoreDisplay from "@/components/features/FairScoreDisplay";
import { cn } from "@/lib/utils";
import type { DeployerComparison } from "@/types/comparison";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getTrustColor(rating: number): string {
  if (rating >= 60) return "text-emerald-600";
  if (rating >= 30) return "text-yellow-600";
  return "text-red-600";
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

interface DeployerSlotContentProps {
  data: DeployerComparison;
}

export default function DeployerSlotContent({ data }: DeployerSlotContentProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(data.wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const bestRating =
    data.deployedTokens.length > 0
      ? Math.max(...data.deployedTokens.map((t) => t.trust_rating))
      : 0;
  const avgRating =
    data.deployedTokens.length > 0
      ? data.deployedTokens.reduce((sum, t) => sum + t.trust_rating, 0) /
        data.deployedTokens.length
      : 0;

  const topTokens = data.deployedTokens.slice(0, 3);
  const remaining = data.deployedTokens.length - 3;

  return (
    <div className="flex flex-col gap-5">
      {/* Address + Link + Copy */}
      <div className="flex items-center gap-2">
        <Link
          href={`/deployer/${data.wallet}`}
          className="inline-flex items-center gap-1.5 truncate font-mono text-sm text-foreground transition-colors hover:text-emerald-600"
        >
          {truncateAddress(data.wallet)}
          <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={handleCopy}
          aria-label="Copy deployer address"
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
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Tokens Deployed</span>
          <Badge variant="outline" className="text-sm">
            {data.tokenCount}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Best Token Rating</span>
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              getTrustColor(bestRating)
            )}
          >
            {bestRating}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Avg Token Rating</span>
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              getTrustColor(avgRating)
            )}
          >
            {avgRating.toFixed(1)}
          </span>
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
            <FeatureBar label="Transaction Activity" value={data.features.tx_count} max={100} />
            <FeatureBar label="Active Days" value={data.features.active_days} max={100} />
            <FeatureBar label="Wallet Age" value={data.features.wallet_age_score} max={100} />
          </div>
        </>
      )}

      {/* Deployed tokens mini-list */}
      {topTokens.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Deployed Tokens
            </span>
            <ul className="flex flex-col gap-1.5">
              {topTokens.map((token) => (
                <li
                  key={token.mint}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="min-w-0 truncate text-foreground">
                    {token.name ?? truncateAddress(token.mint)}
                    {token.symbol && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ${token.symbol}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-semibold tabular-nums",
                      getTrustColor(token.trust_rating)
                    )}
                  >
                    {token.trust_rating}
                  </span>
                </li>
              ))}
            </ul>
            {remaining > 0 && (
              <p className="text-xs text-muted-foreground">
                and {remaining} more...
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
