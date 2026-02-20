"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Shield, Search, LayoutDashboard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Header() {
  const { publicKey, disconnect, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const truncatedAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md"
      )}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-foreground transition-colors hover:text-foreground/80"
          aria-label="TokenTrust home"
        >
          <Shield className="size-6 text-emerald-600" />
          <span className="text-lg font-semibold tracking-tight">
            TokenTrust
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden items-center gap-1 sm:flex" aria-label="Main navigation">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/search">
              <Search className="size-4" />
              Search
            </Link>
          </Button>
          {connected && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <LayoutDashboard className="size-4" />
                Dashboard
              </Link>
            </Button>
          )}
        </nav>

        {/* Wallet Actions */}
        <div className="flex items-center gap-2">
          {/* Mobile nav links */}
          <div className="flex items-center gap-1 sm:hidden">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/search" aria-label="Search">
                <Search className="size-4" />
              </Link>
            </Button>
            {connected && (
              <Button variant="ghost" size="icon" asChild>
                <Link href="/dashboard" aria-label="Dashboard">
                  <LayoutDashboard className="size-4" />
                </Link>
              </Button>
            )}
          </div>

          {connected && truncatedAddress ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-muted-foreground sm:inline-block">
                {truncatedAddress}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnect()}
                aria-label="Disconnect wallet"
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Disconnect</span>
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => setVisible(true)}
              aria-label="Connect wallet"
            >
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
