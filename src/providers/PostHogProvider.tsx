"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initPostHog, isPostHogEnabled } from "@/lib/posthog";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isPostHogEnabled()) initPostHog();
  }, []);

  useEffect(() => {
    if (!isPostHogEnabled()) return;
    const posthog = initPostHog();
    if (pathname && posthog.__loaded) {
      posthog.capture("$pageview", { $current_url: window.location.href });
    }
  }, [pathname, searchParams]);

  return <>{children}</>;
}
