"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiskFlag } from "@/types/database";

interface RiskFlagsProps {
  flags: RiskFlag[];
}

function getSeverityStyles(severity: RiskFlag["severity"]): {
  icon: string;
  bg: string;
  border: string;
  text: string;
} {
  switch (severity) {
    case "critical":
    case "high":
      return {
        icon: "text-red-600",
        bg: "bg-red-50 dark:bg-red-950/30",
        border: "border-red-200 dark:border-red-900",
        text: "text-red-800 dark:text-red-300",
      };
    case "medium":
      return {
        icon: "text-yellow-600",
        bg: "bg-yellow-50 dark:bg-yellow-950/30",
        border: "border-yellow-200 dark:border-yellow-900",
        text: "text-yellow-800 dark:text-yellow-300",
      };
    case "low":
      return {
        icon: "text-gray-500",
        bg: "bg-gray-50 dark:bg-gray-900/30",
        border: "border-gray-200 dark:border-gray-800",
        text: "text-gray-700 dark:text-gray-400",
      };
  }
}

export default function RiskFlags({ flags }: RiskFlagsProps) {
  if (flags.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No risk flags detected.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Risk flags">
      {flags.map((flag) => {
        const styles = getSeverityStyles(flag.severity);
        return (
          <li
            key={flag.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3",
              styles.bg,
              styles.border
            )}
          >
            <AlertTriangle
              className={cn("mt-0.5 size-4 shrink-0", styles.icon)}
              aria-hidden="true"
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-medium", styles.text)}>
                  {flag.label}
                </span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase",
                    styles.bg,
                    styles.text
                  )}
                >
                  {flag.severity}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {flag.description}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
