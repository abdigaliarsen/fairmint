/**
 * NextAuth.js App Router route handler.
 *
 * This catch-all route handles all NextAuth endpoints:
 *   /api/auth/signin
 *   /api/auth/signout
 *   /api/auth/session
 *   /api/auth/csrf
 *   /api/auth/providers
 *   /api/auth/callback/credentials
 */

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
