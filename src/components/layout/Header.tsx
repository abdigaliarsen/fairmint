"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Shield, Search, LayoutDashboard, LogOut, Scale, Sun, Moon, Clock, Compass, Crown, HelpCircle } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationBell from "@/components/features/NotificationBell";
import { useOnboarding } from "@/hooks/useOnboarding";

export default function Header() {
  const { publicKey, disconnect, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { theme, setTheme } = useTheme();
  // Bridges wallet adapter ↔ NextAuth: auto-signs message on connect
  useWalletAuth();

  const walletAddress = publicKey?.toBase58() ?? null;
  const { notifications, unreadCount, markAsRead, markAllRead } =
    useNotifications(walletAddress);
  const { phase, spotlightCompleted, startSpotlightTour } = useOnboarding();

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
          <Button variant="ghost" size="sm" asChild data-tour="tour-search">
            <Link href="/search">
              <Search className="size-4" />
              Search
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild data-tour="tour-compare">
            <Link href="/compare">
              <Scale className="size-4" />
              Compare
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild data-tour="tour-discover">
            <Link href="/discover">
              <Compass className="size-4" />
              Discover
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild data-tour="tour-wallets">
            <Link href="/wallets">
              <Crown className="size-4" />
              Wallets
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/history">
              <Clock className="size-4" />
              History
            </Link>
          </Button>
          {connected && (
            <Button variant="ghost" size="sm" asChild data-tour="tour-dashboard">
              <Link href="/dashboard">
                <LayoutDashboard className="size-4" />
                Dashboard
              </Link>
            </Button>
          )}
        </nav>

        {/* Wallet Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="size-8"
          >
            <Sun className="size-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          </Button>
          {/* Mobile nav links */}
          <div className="flex items-center gap-1 sm:hidden">
            <Button variant="ghost" size="icon" asChild data-tour="tour-search">
              <Link href="/search" aria-label="Search">
                <Search className="size-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild data-tour="tour-compare">
              <Link href="/compare" aria-label="Compare">
                <Scale className="size-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild data-tour="tour-discover">
              <Link href="/discover" aria-label="Discover">
                <Compass className="size-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild data-tour="tour-wallets">
              <Link href="/wallets" aria-label="Wallets">
                <Crown className="size-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link href="/history" aria-label="History">
                <Clock className="size-4" />
              </Link>
            </Button>
            {connected && (
              <Button variant="ghost" size="icon" asChild data-tour="tour-dashboard">
                <Link href="/dashboard" aria-label="Dashboard">
                  <LayoutDashboard className="size-4" />
                </Link>
              </Button>
            )}
          </div>

          {/* Take Tour replay button */}
          {connected && spotlightCompleted && phase === "idle" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={startSpotlightTour}
              aria-label="Take a tour"
              className="size-8"
            >
              <HelpCircle className="size-4" />
            </Button>
          )}

          {connected && truncatedAddress ? (
            <div className="flex items-center gap-2" data-tour="tour-wallet-info">
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAllRead={markAllRead}
                onMarkRead={(ids) => markAsRead(ids)}
              />
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
