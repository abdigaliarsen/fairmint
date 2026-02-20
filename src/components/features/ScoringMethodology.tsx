"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const FACTORS = [
  { label: "Deployer Reputation", weight: 15, description: "FairScale score of the token deployer" },
  { label: "Holder Quality", weight: 25, description: "Average FairScale reputation of top holders" },
  { label: "Distribution", weight: 20, description: "How evenly the token supply is spread" },
  { label: "Wallet Age", weight: 10, description: "Age and activity of the deployer wallet" },
  { label: "Safety Signals", weight: 20, description: "Risk flags like authority status and holder patterns" },
  { label: "Liquidity", weight: 10, description: "DEX liquidity depth and LP vault health" },
];

export default function ScoringMethodology() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        How is this calculated?
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1.5 rounded-md border bg-muted/30 p-3">
          {FACTORS.map((f) => (
            <div key={f.label} className="flex items-center gap-2">
              <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${f.weight * 2}px` }} />
              <span className="text-xs font-medium text-foreground">{f.weight}%</span>
              <span className="text-xs text-muted-foreground">{f.label}</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                — {f.description}
              </span>
            </div>
          ))}
          <p className="mt-1 text-xs text-muted-foreground">
            Powered by FairScale + Helius on-chain data
          </p>
        </div>
      )}
    </div>
  );
}
