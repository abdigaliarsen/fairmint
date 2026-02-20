"use client";

import { useCallback, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { signIn, signOut, useSession } from "next-auth/react";
import bs58 from "bs58";

/**
 * Bridges Solana wallet adapter with NextAuth session.
 *
 * After the user connects a wallet, this hook automatically prompts them to
 * sign a verification message. The signature is sent to NextAuth's
 * CredentialsProvider which verifies it and creates a session.
 */
export function useWalletAuth() {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const { data: session, status } = useSession();
  const signingRef = useRef(false);

  const walletAddress = publicKey?.toBase58() ?? null;
  const isSessionForCurrentWallet =
    session?.user?.wallet === walletAddress;

  const authenticate = useCallback(async () => {
    if (!publicKey || !signMessage || signingRef.current) return;
    if (isSessionForCurrentWallet) return; // already authenticated

    signingRef.current = true;

    try {
      const message = `Sign this message to verify your wallet ownership for TokenTrust.\n\nWallet: ${publicKey.toBase58()}\nTimestamp: ${Date.now()}`;
      const encodedMessage = new TextEncoder().encode(message);
      const signature = await signMessage(encodedMessage);

      await signIn("credentials", {
        message,
        signature: bs58.encode(signature),
        publicKey: publicKey.toBase58(),
        redirect: false,
      });
    } catch (err) {
      // User rejected the signature — disconnect wallet
      console.warn("Wallet signature rejected:", err);
      disconnect();
    } finally {
      signingRef.current = false;
    }
  }, [publicKey, signMessage, isSessionForCurrentWallet, disconnect]);

  // Auto-trigger sign-in when wallet connects but session doesn't match
  useEffect(() => {
    if (connected && !isSessionForCurrentWallet && status !== "loading") {
      authenticate();
    }
  }, [connected, isSessionForCurrentWallet, status, authenticate]);

  // Sign out NextAuth when wallet disconnects
  useEffect(() => {
    if (!connected && session) {
      signOut({ redirect: false });
    }
  }, [connected, session]);

  return {
    isAuthenticated: connected && isSessionForCurrentWallet,
    isAuthenticating: signingRef.current || status === "loading",
    walletAddress,
    session,
  };
}
