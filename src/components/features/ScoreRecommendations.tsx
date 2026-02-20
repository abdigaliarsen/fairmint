"use client";

import { Lightbulb, ArrowUpRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Recommendation } from "@/lib/recommendations";

interface ScoreRecommendationsProps {
  recommendations: Recommendation[];
}

const priorityStyles: Record<string, { badge: string; border: string }> = {
  high: {
    badge: "bg-red-50 text-red-600 border-red-300",
    border: "border-l-red-500",
  },
  medium: {
    badge: "bg-yellow-50 text-yellow-600 border-yellow-300",
    border: "border-l-yellow-500",
  },
  low: {
    badge: "bg-emerald-50 text-emerald-600 border-emerald-300",
    border: "border-l-emerald-500",
  },
};

export default function ScoreRecommendations({
  recommendations,
}: ScoreRecommendationsProps) {
  if (recommendations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <Lightbulb className="size-8 text-emerald-500" />
          <p className="text-sm text-muted-foreground">
            Great job! No improvement recommendations at this time.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="size-5 text-yellow-500" />
          Score Improvement Tips
        </CardTitle>
        <CardDescription>
          Actionable steps to improve your FairScale reputation.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {recommendations.map((rec) => {
          const styles = priorityStyles[rec.priority];
          return (
            <div
              key={rec.id}
              className={cn(
                "rounded-lg border border-l-4 p-4",
                styles.border
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground">
                      {rec.title}
                    </h4>
                    <Badge
                      className={cn(
                        "border text-xs capitalize",
                        styles.badge
                      )}
                    >
                      {rec.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {rec.description}
                  </p>
                </div>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
