"use client";

import { useState, useEffect } from "react";
import type { TokenLiquidity } from "@/services/dexscreener";
import type { LPVault } from "@/services/helius";

interface LiquidityData {
  lpVaults: LPVault[];
  lpSupplyPercent: number;
  dexScreener: TokenLiquidity | null;
}

export function useLiquidity(mint: string | null) {
  const [data, setData] = useState<LiquidityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mint) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/token/${encodeURIComponent(mint)}/liquidity`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((json) => setData(json as LiquidityData))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [mint]);

  return { data, loading };
}
