"use client";

import { ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthorityBadgesProps {
  mintAuthorityActive: boolean;
  freezeAuthorityActive: boolean;
}

function AuthorityBadge({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        active
          ? "border-red-300 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
          : "border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
      )}
    >
      {active ? (
        <ShieldAlert className="size-3" />
      ) : (
        <ShieldCheck className="size-3" />
      )}
      {label}: {active ? "Active" : "Renounced"}
    </div>
  );
}

export default function AuthorityBadges({
  mintAuthorityActive,
  freezeAuthorityActive,
}: AuthorityBadgesProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <AuthorityBadge label="Mint" active={mintAuthorityActive} />
      <AuthorityBadge label="Freeze" active={freezeAuthorityActive} />
    </div>
  );
}
