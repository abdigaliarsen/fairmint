"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLiquidity } from "@/hooks/useLiquidity";

interface LiquidityCardProps {
  mint: string | null;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export default function LiquidityCard({ mint }: LiquidityCardProps) {
  const { data, loading } = useLiquidity(mint);

  if (!mint) return null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Liquidity</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[120px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const dex = data.dexScreener;
  const hasLPData = data.lpVaults.length > 0;
  const hasDexData = dex !== null;

  if (!hasLPData && !hasDexData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Liquidity</CardTitle>
          <CardDescription>
            No liquidity pool data found for this token.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const ratio = dex?.volumeLiquidityRatio ?? 0;
  const healthColor =
    ratio > 0.5
      ? "text-emerald-600 bg-emerald-50 border-emerald-300"
      : ratio > 0.1
        ? "text-yellow-600 bg-yellow-50 border-yellow-300"
        : "text-red-600 bg-red-50 border-red-300";
  const healthLabel =
    ratio > 0.5 ? "Healthy" : ratio > 0.1 ? "Moderate" : "Low";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Liquidity</CardTitle>
            <CardDescription>
              On-chain liquidity from DEX pools.
            </CardDescription>
          </div>
          <Badge className={cn("border", healthColor)}>
            {healthLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {hasDexData && (
            <>
              <Metric
                label="Total Liquidity"
                value={formatUsd(dex.totalLiquidityUsd)}
              />
              <Metric label="24h Volume" value={formatUsd(dex.volume24h)} />
              <Metric
                label="Vol/Liq Ratio"
                value={dex.volumeLiquidityRatio.toFixed(2)}
              />
              <Metric label="Pools" value={dex.poolCount.toString()} />
              {dex.primaryDex && (
                <Metric
                  label="Primary DEX"
                  value={dex.primaryDex.charAt(0).toUpperCase() + dex.primaryDex.slice(1)}
                />
              )}
              {dex.fdv > 0 && <Metric label="FDV" value={formatUsd(dex.fdv)} />}
            </>
          )}
          {hasLPData && (
            <>
              <Metric
                label="Supply in LPs"
                value={`${data.lpSupplyPercent.toFixed(1)}%`}
              />
              <Metric
                label="LP Pools (on-chain)"
                value={data.lpVaults.length.toString()}
              />
            </>
          )}
        </div>

        {hasLPData && (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.lpVaults.map((vault) => (
              <Badge
                key={vault.owner}
                variant="outline"
                className="text-xs"
              >
                {vault.dex}: {vault.percentage.toFixed(1)}%
              </Badge>
            ))}
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          via DexScreener
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}
