/**
 * NextAuth.js configuration for wallet-based authentication.
 *
 * Authentication flow:
 * 1. User connects a Solana wallet (Phantom, Solflare, etc.)
 * 2. Client signs a message proving wallet ownership
 * 3. Server verifies the signature using tweetnacl
 * 4. NextAuth creates a JWT session with the wallet address
 * 5. User record is upserted in Supabase with FairScore data
 */

import type { AuthOptions, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import nacl from "tweetnacl";
import bs58 from "bs58";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getQuickScore, classifyTier } from "@/services/fairscale";
import type { FairScoreTier } from "@/types/database";

// ---------------------------------------------------------------------------
// Type augmentation for NextAuth
// ---------------------------------------------------------------------------

declare module "next-auth" {
  interface Session {
    user: {
      wallet: string;
      fairScore: number | null;
      fairTier: FairScoreTier | null;
    };
  }

  interface User {
    id: string;
    wallet: string;
    fairScore: number | null;
    fairTier: FairScoreTier | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    wallet: string;
    fairScore: number | null;
    fairTier: FairScoreTier | null;
  }
}

// ---------------------------------------------------------------------------
// Auth configuration
// ---------------------------------------------------------------------------

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Solana Wallet",
      credentials: {
        message: {
          label: "Message",
          type: "text",
          placeholder: "Sign this message to verify wallet ownership",
        },
        signature: {
          label: "Signature",
          type: "text",
          placeholder: "Base58-encoded signature",
        },
        publicKey: {
          label: "Public Key",
          type: "text",
          placeholder: "Wallet public key (base58)",
        },
      },
      async authorize(credentials) {
        if (!credentials?.message || !credentials?.signature || !credentials?.publicKey) {
          return null;
        }

        try {
          // Decode the base58-encoded public key and signature
          const publicKeyBytes = bs58.decode(credentials.publicKey);
          const signatureBytes = bs58.decode(credentials.signature);
          const messageBytes = new TextEncoder().encode(credentials.message);

          // Verify the signature using tweetnacl
          const isValid = nacl.sign.detached.verify(
            messageBytes,
            signatureBytes,
            publicKeyBytes
          );

          if (!isValid) {
            console.error("Wallet signature verification failed");
            return null;
          }

          const wallet = credentials.publicKey;

          // Fetch FairScore for the authenticated wallet
          let fairScore: number | null = null;
          let fairTier: FairScoreTier | null = null;

          try {
            fairScore = await getQuickScore(wallet);
            fairTier = fairScore !== null ? classifyTier(fairScore) : "unrated";
          } catch (error) {
            console.error("Failed to fetch FairScore during auth:", error);
            fairTier = "unrated";
          }

          // Upsert user in Supabase
          try {
            const supabase = createServerSupabaseClient();
            await supabase
              .from("users")
              .upsert(
                {
                  wallet,
                  fair_score: fairScore,
                  fair_tier: fairTier,
                  last_login: new Date().toISOString(),
                },
                { onConflict: "wallet" }
              );
          } catch (error) {
            // Log but do not block auth if DB upsert fails
            console.error("Failed to upsert user in Supabase:", error);
          }

          return {
            id: wallet,
            wallet,
            fairScore,
            fairTier,
          };
        } catch (error) {
          console.error("Wallet auth error:", error);
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },

  callbacks: {
    async jwt({ token, user }): Promise<JWT> {
      // On initial sign-in, persist wallet data into the JWT
      if (user) {
        token.wallet = user.wallet;
        token.fairScore = user.fairScore;
        token.fairTier = user.fairTier;
      }
      return token;
    },

    async session({ session, token }): Promise<Session> {
      // Expose wallet data in the client-side session
      session.user = {
        wallet: token.wallet,
        fairScore: token.fairScore,
        fairTier: token.fairTier,
      };
      return session;
    },
  },

  pages: {
    signIn: "/",
    error: "/",
  },

  secret: process.env.NEXTAUTH_SECRET,
};
