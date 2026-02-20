"use client";

import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAISummary } from "@/hooks/useAISummary";

interface AISummaryCardProps {
  type: "token" | "deployer" | "reputation";
  context: Record<string, unknown> | null;
}

export default function AISummaryCard({ type, context }: AISummaryCardProps) {
  const { text, loading, error } = useAISummary({ type, context });

  // Don't render anything if AI is not configured or errored silently
  if (error && !text) return null;

  // Don't render until we have context data
  if (!context) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-violet-500" />
          AI Analysis
          <span className="ml-auto text-[10px] font-normal text-muted-foreground">
            Powered by Groq
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && !text && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        )}
        {text && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {text}
            {loading && (
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-violet-500" />
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
