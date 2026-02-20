"use client";

import { useState, useCallback, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Scale, Coins, ShieldCheck, User } from "lucide-react";
import ComparisonSlot from "@/components/features/ComparisonSlot";
import SuggestionPanel from "@/components/features/SuggestionPanel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFairScore } from "@/hooks/useFairScore";
import { cn } from "@/lib/utils";
import type { FairScoreTier } from "@/types/database";
import type { ComparisonEntity, ComparisonMode } from "@/types/comparison";

function getMaxSlots(tier: FairScoreTier): number {
  switch (tier) {
    case "gold":
    case "platinum":
      return 4;
    case "silver":
      return 3;
    default:
      return 2;
  }
}

const MODE_CONFIG: Record<
  ComparisonMode,
  { title: string; description: string; icon: typeof Scale }
> = {
  tokens: {
    title: "Token Comparison",
    description: "Compare tokens side-by-side.",
    icon: Coins,
  },
  wallets: {
    title: "Wallet Comparison",
    description: "Compare wallet reputations side-by-side.",
    icon: ShieldCheck,
  },
  deployers: {
    title: "Deployer Comparison",
    description: "Compare deployer profiles side-by-side.",
    icon: User,
  },
};

export default function ComparePage() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const { data: fairScore } = useFairScore(walletAddress);

  const currentTier: FairScoreTier = fairScore?.tier ?? "unrated";
  const maxSlots = getMaxSlots(currentTier);

  const [mode, setMode] = useState<ComparisonMode>("tokens");
  const [entities, setEntities] = useState<(ComparisonEntity | null)[]>(
    Array(2).fill(null)
  );
  const [loadingSlots, setLoadingSlots] = useState<boolean[]>(
    Array(2).fill(false)
  );

  // Adjust slot count when tier changes
  useEffect(() => {
    setEntities((prev) => {
      if (prev.length === maxSlots) return prev;
      if (prev.length < maxSlots) {
        return [...prev, ...Array(maxSlots - prev.length).fill(null)];
      }
      return prev.slice(0, maxSlots);
    });
    setLoadingSlots((prev) => {
      if (prev.length === maxSlots) return prev;
      if (prev.length < maxSlots) {
        return [...prev, ...Array(maxSlots - prev.length).fill(false)];
      }
      return prev.slice(0, maxSlots);
    });
  }, [maxSlots]);

  // Clear all slots when mode changes
  const handleModeChange = useCallback(
    (newMode: string) => {
      const m = newMode as ComparisonMode;
      setMode(m);
      setEntities(Array(maxSlots).fill(null));
      setLoadingSlots(Array(maxSlots).fill(false));
    },
    [maxSlots]
  );

  const handleSelect = useCallback(
    async (slotIndex: number, id: string) => {
      setLoadingSlots((prev) => {
        const next = [...prev];
        next[slotIndex] = true;
        return next;
      });

      try {
        let entity: ComparisonEntity | null = null;

        if (mode === "tokens") {
          const res = await fetch(
            `/api/compare?mints=${encodeURIComponent(id)}`
          );
          if (res.ok) {
            const data = await res.json();
            const token = data.tokens?.[0] ?? null;
            if (token) {
              entity = { mode: "tokens", data: token };
            }
          }
        } else if (mode === "wallets") {
          const res = await fetch(
            `/api/compare/wallets?addresses=${encodeURIComponent(id)}`
          );
          if (res.ok) {
            const data = await res.json();
            const wallet = data.wallets?.[0] ?? null;
            if (wallet) {
              entity = { mode: "wallets", data: wallet };
            }
          }
        } else if (mode === "deployers") {
          const res = await fetch(
            `/api/compare/deployers?addresses=${encodeURIComponent(id)}`
          );
          if (res.ok) {
            const data = await res.json();
            const deployer = data.deployers?.[0] ?? null;
            if (deployer) {
              entity = { mode: "deployers", data: deployer };
            }
          }
        }

        setEntities((prev) => {
          const next = [...prev];
          next[slotIndex] = entity;
          return next;
        });
      } catch {
        // keep slot empty on error
      } finally {
        setLoadingSlots((prev) => {
          const next = [...prev];
          next[slotIndex] = false;
          return next;
        });
      }
    },
    [mode]
  );

  const handleRemove = useCallback((slotIndex: number) => {
    setEntities((prev) => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
  }, []);

  // Determine winner (highest score among filled slots)
  const filledEntities = entities.filter(Boolean) as ComparisonEntity[];
  const scores = filledEntities.map((e) => {
    if (e.mode === "tokens") return e.data.trustRating;
    return e.data.score;
  });
  const highestScore =
    filledEntities.length >= 2 ? Math.max(...scores) : -1;

  function getEntityScore(entity: ComparisonEntity): number {
    if (entity.mode === "tokens") return entity.data.trustRating;
    return entity.data.score;
  }

  const config = MODE_CONFIG[mode];
  const ModeIcon = config.icon;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
            <ModeIcon className="size-7 text-emerald-600" />
            {config.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {config.description} {maxSlots} slots available for your{" "}
            <span className="font-medium capitalize">{currentTier}</span> tier.
            {currentTier !== "gold" && currentTier !== "platinum" && (
              <span>
                {" "}
                Upgrade your FairScale reputation to unlock more slots.
              </span>
            )}
          </p>
        </div>

        {/* Mode selector */}
        <Tabs value={mode} onValueChange={handleModeChange}>
          <TabsList>
            <TabsTrigger value="tokens">
              <Coins className="size-4" />
              Tokens
            </TabsTrigger>
            <TabsTrigger value="wallets">
              <ShieldCheck className="size-4" />
              Wallets
            </TabsTrigger>
            <TabsTrigger value="deployers">
              <User className="size-4" />
              Deployers
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div
        className={cn(
          "mx-auto grid gap-6",
          maxSlots === 2 && "max-w-3xl grid-cols-1 sm:grid-cols-2",
          maxSlots === 3 && "max-w-4xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          maxSlots === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        )}
      >
        {entities.slice(0, maxSlots).map((entity, i) => (
          <ComparisonSlot
            key={`${mode}-${i}`}
            entity={entity}
            mode={mode}
            loading={loadingSlots[i]}
            isWinner={
              entity !== null &&
              filledEntities.length >= 2 &&
              getEntityScore(entity) === highestScore
            }
            onSelect={(id) => handleSelect(i, id)}
            onRemove={() => handleRemove(i)}
          />
        ))}
      </div>

      {/* Suggestion panel for quick-add via drag & drop */}
      <div className="mx-auto mt-8 max-w-3xl">
        <SuggestionPanel comparisonMode={mode} />
      </div>
    </div>
  );
}
