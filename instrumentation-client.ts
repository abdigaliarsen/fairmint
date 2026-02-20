import "./sentry.client.config";
import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";

// Sentry navigation instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

if (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_POSTHOG_KEY &&
  process.env.NEXT_PUBLIC_POSTHOG_KEY !== "phc_placeholder"
) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
  });
}
