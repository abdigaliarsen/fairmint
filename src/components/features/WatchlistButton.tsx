"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WatchlistButtonProps {
  isWatched: boolean;
  onToggle: () => void;
  loading?: boolean;
  size?: "sm" | "default";
}

export default function WatchlistButton({
  isWatched,
  onToggle,
  loading = false,
  size = "default",
}: WatchlistButtonProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [wasWatched, setWasWatched] = useState(isWatched);

  useEffect(() => {
    if (isWatched && !wasWatched) {
      setShowFeedback(true);
      const timer = setTimeout(() => setShowFeedback(false), 1500);
      return () => clearTimeout(timer);
    }
    setWasWatched(isWatched);
  }, [isWatched, wasWatched]);

  const iconSize = size === "sm" ? "size-3.5" : "size-4";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(size === "sm" ? "size-7" : "size-8", "relative")}
      onClick={onToggle}
      disabled={loading}
      aria-label={isWatched ? "Remove from watchlist" : "Add to watchlist"}
    >
      <Heart
        className={cn(
          iconSize,
          isWatched
            ? "fill-red-500 text-red-500"
            : "text-muted-foreground hover:text-red-400"
        )}
      />
      {showFeedback && (
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">
          Added!
        </span>
      )}
    </Button>
  );
}
