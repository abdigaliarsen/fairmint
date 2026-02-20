import posthog from "posthog-js";

export function initPostHog() {
  if (typeof window !== "undefined" && !posthog.__loaded) {
    posthog.init(
      process.env.NEXT_PUBLIC_POSTHOG_KEY || "phc_placeholder",
      {
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        capture_pageview: false, // We capture manually in the provider
        loaded: (posthog) => {
          if (process.env.NODE_ENV === "development") posthog.debug();
        },
      }
    );
  }
  return posthog;
}
