"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getTierColor } from "@/services/fairscale";
import type { FairScoreTier } from "@/types/database";
import type { ComparisonMode } from "@/types/comparison";

// ---------------------------------------------------------------------------
// Result Types
// ---------------------------------------------------------------------------

interface TokenResult {
  mint: string;
  name: string | null;
  symbol: string | null;
  trust_rating: number;
  deployer_tier: FairScoreTier | null;
}

interface WalletResult {
  wallet: string;
  score: number;
  tier: FairScoreTier;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTrustColor(rating: number): string {
  if (rating >= 60) return "text-emerald-600";
  if (rating >= 30) return "text-yellow-600";
  return "text-red-600";
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EntitySearchProps {
  mode: ComparisonMode;
  onSelect: (id: string) => void;
  placeholder?: string;
}

export default function EntitySearch({
  mode,
  onSelect,
  placeholder,
}: EntitySearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tokenResults, setTokenResults] = useState<TokenResult[]>([]);
  const [walletResults, setWalletResults] = useState<WalletResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const defaultPlaceholder =
    mode === "tokens"
      ? "Search tokens by name, symbol, or mint..."
      : mode === "wallets"
        ? "Search by wallet address..."
        : "Search by deployer address...";

  const fetchResults = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.trim().length === 0) {
        setTokenResults([]);
        setWalletResults([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        if (mode === "tokens") {
          const res = await fetch(
            `/api/search?q=${encodeURIComponent(searchQuery)}&limit=8`
          );
          if (res.ok) {
            const data = await res.json();
            setTokenResults(data.results ?? []);
            setIsOpen((data.results ?? []).length > 0);
          } else {
            setTokenResults([]);
            setIsOpen(false);
          }
        } else {
          // Wallets and deployers use the same wallet search
          const res = await fetch(
            `/api/search/wallets?q=${encodeURIComponent(searchQuery)}&limit=8`
          );
          if (res.ok) {
            const data = await res.json();
            setWalletResults(data.results ?? []);
            setIsOpen((data.results ?? []).length > 0);
          } else {
            setWalletResults([]);
            setIsOpen(false);
          }
        }
      } catch {
        setTokenResults([]);
        setWalletResults([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    },
    [mode]
  );

  // Reset results when mode changes
  useEffect(() => {
    setQuery("");
    setTokenResults([]);
    setWalletResults([]);
    setIsOpen(false);
  }, [mode]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchResults(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, fetchResults]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(id: string) {
    setIsOpen(false);
    setQuery("");
    if (onSelect) {
      onSelect(id);
    } else {
      router.push(`/token/${id}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full" onKeyDown={handleKeyDown}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder={placeholder ?? defaultPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (tokenResults.length > 0 || walletResults.length > 0) setIsOpen(true);
          }}
          className="pl-9 pr-9"
          aria-label={`Search ${mode}`}
          aria-expanded={isOpen}
          role="combobox"
          aria-haspopup="listbox"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-md"
        >
          {mode === "tokens" &&
            tokenResults.map((result) => (
              <li key={result.mint} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  onClick={() => handleSelect(result.mint)}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground">
                      {result.name ?? "Unknown"}
                      {result.symbol && (
                        <span className="ml-1 text-muted-foreground">
                          ${result.symbol}
                        </span>
                      )}
                    </span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {result.mint.slice(0, 8)}...{result.mint.slice(-4)}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 tabular-nums",
                      getTrustColor(result.trust_rating)
                    )}
                  >
                    {result.trust_rating}
                  </Badge>
                </button>
              </li>
            ))}

          {mode !== "tokens" &&
            walletResults.map((result) => {
              const tierColors = getTierColor(result.tier);
              return (
                <li key={result.wallet} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    onClick={() => handleSelect(result.wallet)}
                  >
                    <span className="truncate font-mono text-foreground">
                      {truncateAddress(result.wallet)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                        {result.score.toFixed(1)}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 text-[10px] capitalize",
                          tierColors.text
                        )}
                      >
                        {result.tier}
                      </Badge>
                    </div>
                  </button>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
