"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import type { BrowsingHistoryType, FairScoreTier } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocalHistoryEntry {
  id: string;
  type: BrowsingHistoryType;
  subject: string;
  name: string | null;
  symbol: string | null;
  score: number | null;
  tier: FairScoreTier | null;
  visitedAt: string;
}

interface UseBrowsingHistoryReturn {
  entries: LocalHistoryEntry[];
  recordVisit: (entry: Omit<LocalHistoryEntry, "id" | "visitedAt">) => void;
  clearHistory: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "tokentrust_history";
const MAX_ENTRIES = 200;
const SYNC_INTERVAL_MS = 60_000;
const LAST_SYNCED_KEY = "tokentrust_history_last_synced";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return crypto.randomUUID();
}

function readLocalHistory(): LocalHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalHistoryEntry[];
  } catch {
    return [];
  }
}

function writeLocalHistory(entries: LocalHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage might be full — silently fail
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBrowsingHistory(): UseBrowsingHistoryReturn {
  const { data: session } = useSession();
  const wallet = session?.user?.wallet ?? null;
  const [entries, setEntries] = useState<LocalHistoryEntry[]>([]);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setEntries(readLocalHistory());
  }, []);

  // Record a visit
  const recordVisit = useCallback(
    (entry: Omit<LocalHistoryEntry, "id" | "visitedAt">) => {
      setEntries((prev) => {
        const existingIndex = prev.findIndex(
          (e) => e.type === entry.type && e.subject === entry.subject
        );

        const now = new Date().toISOString();
        let updated: LocalHistoryEntry[];

        if (existingIndex >= 0) {
          const existing = prev[existingIndex];
          const updatedEntry: LocalHistoryEntry = {
            ...existing,
            name: entry.name ?? existing.name,
            symbol: entry.symbol ?? existing.symbol,
            score: entry.score ?? existing.score,
            tier: entry.tier ?? existing.tier,
            visitedAt: now,
          };
          updated = [
            updatedEntry,
            ...prev.slice(0, existingIndex),
            ...prev.slice(existingIndex + 1),
          ];
        } else {
          const newEntry: LocalHistoryEntry = {
            id: generateId(),
            ...entry,
            visitedAt: now,
          };
          updated = [newEntry, ...prev];
        }

        if (updated.length > MAX_ENTRIES) {
          updated = updated.slice(0, MAX_ENTRIES);
        }

        writeLocalHistory(updated);
        return updated;
      });
    },
    []
  );

  // Clear all history
  const clearHistory = useCallback(() => {
    setEntries([]);
    writeLocalHistory([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(LAST_SYNCED_KEY);
    }
  }, []);

  // Periodic sync to Supabase for authenticated users
  useEffect(() => {
    if (!wallet) {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      return;
    }

    async function syncToServer() {
      if (!wallet) return;
      const current = readLocalHistory();
      if (current.length === 0) return;

      const lastSynced = localStorage.getItem(LAST_SYNCED_KEY);
      const entriesToSync = lastSynced
        ? current.filter((e) => e.visitedAt > lastSynced)
        : current;

      if (entriesToSync.length === 0) return;

      try {
        const res = await fetch("/api/history/browsing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet, entries: entriesToSync }),
        });
        if (res.ok) {
          localStorage.setItem(LAST_SYNCED_KEY, new Date().toISOString());
        }
      } catch {
        // Silently fail — will retry next interval
      }
    }

    syncToServer();

    syncTimerRef.current = setInterval(syncToServer, SYNC_INTERVAL_MS);

    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [wallet]);

  return { entries, recordVisit, clearHistory };
}
