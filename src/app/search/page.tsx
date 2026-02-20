"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Search, Loader2, ArrowRight, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import TokenCard from "@/components/features/TokenCard";
import type { FairScoreTier } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
  mint: string;
  name: string | null;
  symbol: string | null;
  trust_rating: number;
  deployer_tier: FairScoreTier | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if a string looks like a valid Solana base58 address (32-44 chars). */
function isBase58Address(input: string): boolean {
  if (input.length < 32 || input.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(input);
}

// ---------------------------------------------------------------------------
// Search Results Skeleton
// ---------------------------------------------------------------------------

function SearchResultsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex flex-col gap-3 py-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search Page
// ---------------------------------------------------------------------------

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [popularTokens, setPopularTokens] = useState<SearchResult[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load popular tokens on mount
  useEffect(() => {
    async function loadPopular() {
      try {
        const res = await fetch("/api/featured?limit=12");
        if (res.ok) {
          const data = await res.json();
          setPopularTokens(data.tokens ?? []);
        }
      } catch {
        // Silently fail
      } finally {
        setPopularLoading(false);
      }
    }
    loadPopular();
  }, []);

  const fetchResults = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(trimmed)}&limit=20`
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchResults(query);
    }, 400);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, fetchResults]);

  const trimmedQuery = query.trim();
  const showDirectAnalysis =
    trimmedQuery.length > 0 &&
    isBase58Address(trimmedQuery) &&
    !isLoading &&
    results.length === 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* --------------------------------------------------------------- */}
      {/* Search Header                                                   */}
      {/* --------------------------------------------------------------- */}
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Search Tokens
        </h1>
        <p className="max-w-md text-muted-foreground">
          Search for any Solana token by name, symbol, or mint address.
        </p>

        {/* Search input */}
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Token name, symbol, or mint address..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 pr-9"
            aria-label="Search tokens"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* --------------------------------------------------------------- */}
      {/* Loading State                                                   */}
      {/* --------------------------------------------------------------- */}
      {isLoading && <SearchResultsSkeleton />}

      {/* --------------------------------------------------------------- */}
      {/* Direct Mint Address Analysis                                    */}
      {/* --------------------------------------------------------------- */}
      {showDirectAnalysis && (
        <Card className="mx-auto max-w-lg">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <Search className="size-10 text-emerald-600" />
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold text-foreground">
                Analyze This Address?
              </h3>
              <CardDescription>
                This looks like a Solana mint address. Would you like to analyze
                it directly?
              </CardDescription>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {trimmedQuery}
              </p>
            </div>
            <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
              <Link href={`/token/${trimmedQuery}`}>
                Analyze Token
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* --------------------------------------------------------------- */}
      {/* Search Results                                                  */}
      {/* --------------------------------------------------------------- */}
      {!isLoading && results.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((result) => (
            <TokenCard
              key={result.mint}
              mint={result.mint}
              name={result.name}
              symbol={result.symbol}
              trustRating={result.trust_rating}
              deployerTier={result.deployer_tier}
            />
          ))}
        </div>
      )}

      {/* --------------------------------------------------------------- */}
      {/* Empty State                                                     */}
      {/* --------------------------------------------------------------- */}
      {!isLoading &&
        hasSearched &&
        results.length === 0 &&
        !showDirectAnalysis && (
          <Card className="mx-auto max-w-lg">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Search className="size-10 text-muted-foreground/50" />
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold text-foreground">
                  No tokens found
                </h3>
                <CardDescription>
                  Try a different search term or paste a token mint address
                  directly.
                </CardDescription>
              </div>
            </CardContent>
          </Card>
        )}

      {/* --------------------------------------------------------------- */}
      {/* Initial State: Popular Tokens                                   */}
      {/* --------------------------------------------------------------- */}
      {!isLoading && !hasSearched && (
        <section aria-label="Popular tokens">
          <div className="mb-6 flex items-center gap-2">
            <TrendingUp className="size-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-foreground">
              Popular Tokens
            </h2>
          </div>

          {popularLoading && <SearchResultsSkeleton />}

          {!popularLoading && popularTokens.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {popularTokens.map((token) => (
                <TokenCard
                  key={token.mint}
                  mint={token.mint}
                  name={token.name}
                  symbol={token.symbol}
                  trustRating={token.trust_rating}
                  deployerTier={token.deployer_tier}
                />
              ))}
            </div>
          )}

          {!popularLoading && popularTokens.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <Search className="size-8 text-muted-foreground/40" />
              <p className="text-sm">
                Start typing to search for tokens in our database.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
