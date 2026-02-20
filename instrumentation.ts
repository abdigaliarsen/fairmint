export function register() {
  // No-op for initialization
}

export const onRequestError = async (
  err: Error,
  request: { headers: { cookie?: string | string[] } },
  _context: unknown
) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getPostHogServer } = await import("./src/lib/posthog-server");
    const posthog = getPostHogServer();

    let distinctId: string | undefined;

    if (request.headers.cookie) {
      const cookieString = Array.isArray(request.headers.cookie)
        ? request.headers.cookie.join("; ")
        : request.headers.cookie;

      const postHogCookieMatch = cookieString.match(
        /ph_phc_.*?_posthog=([^;]+)/
      );

      if (postHogCookieMatch?.[1]) {
        try {
          const decodedCookie = decodeURIComponent(postHogCookieMatch[1]);
          const postHogData = JSON.parse(decodedCookie);
          distinctId = postHogData.distinct_id;
        } catch {
          // Ignore cookie parsing errors
        }
      }
    }

    await posthog.captureException(err, distinctId);
  }
};
