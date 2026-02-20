"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
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

/** Description is considered expandable only when it's long enough to be truncated by line-clamp-1. */
const EXPAND_THRESHOLD = 80;

function RiskFlagItem({ flag }: { flag: RiskFlag }) {
  const [expanded, setExpanded] = useState(false);
  const styles = getSeverityStyles(flag.severity);

  const hasExpandableDescription =
    !!flag.description && flag.description.length > EXPAND_THRESHOLD;

  return (
    <li
      className={cn(
        "flex flex-col rounded-lg border",
        styles.bg,
        styles.border
      )}
    >
      <div
        role={hasExpandableDescription ? "button" : undefined}
        tabIndex={hasExpandableDescription ? 0 : undefined}
        onClick={() => hasExpandableDescription && setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (hasExpandableDescription && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        className={cn(
          "flex items-start gap-3 p-3 text-left",
          hasExpandableDescription && "cursor-pointer"
        )}
        aria-expanded={hasExpandableDescription ? expanded : undefined}
      >
        <AlertTriangle
          className={cn("mt-0.5 size-4 shrink-0", styles.icon)}
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
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
          {flag.description && !(expanded && hasExpandableDescription) && (
            <p className={cn(
              "text-xs text-muted-foreground",
              hasExpandableDescription && "line-clamp-1"
            )}>
              {flag.description}
            </p>
          )}
        </div>
        {hasExpandableDescription && (
          <span className="mt-0.5 shrink-0">
            {expanded ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </span>
        )}
      </div>
      {expanded && hasExpandableDescription && (
        <div className="border-t border-inherit px-3 pb-3 pt-2">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {flag.description}
          </p>
        </div>
      )}
    </li>
  );
}

export default function RiskFlags({ flags }: RiskFlagsProps) {
  if (flags.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No risk flags detected.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Risk flags">
      {flags.map((flag) => (
        <RiskFlagItem key={flag.id} flag={flag} />
      ))}
    </ul>
  );
}
