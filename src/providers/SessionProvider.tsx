"use client";

/**
 * NextAuth session provider.
 *
 * Client component that wraps the app with NextAuth's SessionProvider
 * so that `useSession()` is available throughout the component tree.
 */

import { type ReactNode } from "react";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

interface SessionProviderProps {
  children: ReactNode;
}

export default function SessionProvider({ children }: SessionProviderProps) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
