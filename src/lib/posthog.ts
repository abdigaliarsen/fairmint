import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

export function isPostHogEnabled() {
  return !!POSTHOG_KEY && POSTHOG_KEY !== "phc_placeholder";
}

export function initPostHog() {
  if (typeof window !== "undefined" && isPostHogEnabled() && !posthog.__loaded) {
    posthog.init(POSTHOG_KEY!, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      capture_pageview: false,
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") ph.debug();
      },
    });
  }
  return posthog;
}
