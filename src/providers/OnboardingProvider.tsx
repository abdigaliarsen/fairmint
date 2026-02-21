"use client";

import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Shield, Search, TrendingUp, type LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OnboardingPhase = "idle" | "welcome" | "spotlight";

export interface WelcomeSlide {
  icon: LucideIcon;
  title: string;
  description: string;
}

export type TourPlacement = "top" | "bottom" | "left" | "right";

export interface TourStep {
  target: string; // data-tour attribute value
  title: string;
  description: string;
  placement: TourPlacement;
}

export interface OnboardingContextValue {
  phase: OnboardingPhase;
  // Welcome
  welcomeStep: number;
  welcomeSlides: WelcomeSlide[];
  welcomeCompleted: boolean;
  nextWelcome: () => void;
  prevWelcome: () => void;
  skipWelcome: () => void;
  completeWelcome: () => void;
  // Spotlight
  spotlightStep: number;
  tourSteps: TourStep[];
  spotlightCompleted: boolean;
  nextSpotlight: () => void;
  prevSpotlight: () => void;
  skipSpotlight: () => void;
  completeSpotlight: () => void;
  startSpotlightTour: () => void;
  // Reset
  resetOnboarding: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "tokentrust_onboarding";

export const WELCOME_SLIDES: WelcomeSlide[] = [
  {
    icon: Shield,
    title: "Welcome to TokenTrust",
    description:
      "Your reputation-powered intelligence platform for Solana tokens. We help you trade smarter by analyzing token deployers, holder quality, and on-chain reputation.",
  },
  {
    icon: Search,
    title: "Search & Analyze Any Token",
    description:
      "Paste any Solana token mint address or search by name. Get instant trust scores, deployer history, holder analysis, and risk flags — all in one place.",
  },
  {
    icon: TrendingUp,
    title: "Connect to Unlock More",
    description:
      "Connect your wallet to access your personal dashboard, watchlist, comparison slots, and reputation score. Your on-chain identity unlocks premium features.",
  },
];

export const TOUR_STEPS: TourStep[] = [
  {
    target: "tour-search",
    title: "Token Search",
    description:
      "Search any Solana token by name, symbol, or mint address to get instant trust analysis.",
    placement: "bottom",
  },
  {
    target: "tour-discover",
    title: "Discover Tokens",
    description:
      "Browse trending, new, and top-trusted tokens curated by reputation score.",
    placement: "bottom",
  },
  {
    target: "tour-compare",
    title: "Compare Side by Side",
    description:
      "Compare tokens, wallets, or deployers head to head. Higher reputation tiers unlock more comparison slots.",
    placement: "bottom",
  },
  {
    target: "tour-wallets",
    title: "Wallet Leaderboard",
    description:
      "Explore top-ranked wallets by FairScale reputation score and tier.",
    placement: "bottom",
  },
  {
    target: "tour-dashboard",
    title: "Your Dashboard",
    description:
      "Your personal FairScore, watchlist, and token recommendations — all in one place.",
    placement: "bottom",
  },
  {
    target: "tour-wallet-info",
    title: "Your Wallet",
    description:
      "Notifications, wallet address, and session management live here.",
    placement: "left",
  },
];

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

interface StoredOnboarding {
  welcomeCompleted: boolean;
  spotlightCompleted: boolean;
}

function readStorage(): StoredOnboarding {
  if (typeof window === "undefined")
    return { welcomeCompleted: false, spotlightCompleted: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { welcomeCompleted: false, spotlightCompleted: false };
    return JSON.parse(raw) as StoredOnboarding;
  } catch {
    return { welcomeCompleted: false, spotlightCompleted: false };
  }
}

function writeStorage(data: StoredOnboarding) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be unavailable
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const OnboardingContext = createContext<OnboardingContextValue | null>(
  null
);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export default function OnboardingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { connected } = useWallet();
  const prevConnected = useRef(false);

  const [phase, setPhase] = useState<OnboardingPhase>("idle");
  const [welcomeStep, setWelcomeStep] = useState(0);
  const [spotlightStep, setSpotlightStep] = useState(0);
  const [welcomeCompleted, setWelcomeCompleted] = useState(true);
  const [spotlightCompleted, setSpotlightCompleted] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Read localStorage on mount
  useEffect(() => {
    const stored = readStorage();
    setWelcomeCompleted(stored.welcomeCompleted);
    setSpotlightCompleted(stored.spotlightCompleted);

    // Show welcome if first visit
    if (!stored.welcomeCompleted) {
      setPhase("welcome");
    }
    setMounted(true);
  }, []);

  // Auto-trigger spotlight on wallet connect
  useEffect(() => {
    if (!mounted) return;
    if (connected && !prevConnected.current && !spotlightCompleted) {
      // Small delay to let UI settle after wallet connect
      const timer = setTimeout(() => {
        setPhase("spotlight");
        setSpotlightStep(0);
      }, 500);
      return () => clearTimeout(timer);
    }
    prevConnected.current = connected;
  }, [connected, spotlightCompleted, mounted]);

  // Welcome actions
  const nextWelcome = useCallback(() => {
    setWelcomeStep((s) => Math.min(s + 1, WELCOME_SLIDES.length - 1));
  }, []);

  const prevWelcome = useCallback(() => {
    setWelcomeStep((s) => Math.max(s - 1, 0));
  }, []);

  const completeWelcome = useCallback(() => {
    setWelcomeCompleted(true);
    setPhase("idle");
    setWelcomeStep(0);
    const stored = readStorage();
    writeStorage({ ...stored, welcomeCompleted: true });
  }, []);

  const skipWelcome = completeWelcome;

  // Spotlight actions
  const nextSpotlight = useCallback(() => {
    setSpotlightStep((s) => s + 1);
  }, []);

  const prevSpotlight = useCallback(() => {
    setSpotlightStep((s) => Math.max(s - 1, 0));
  }, []);

  const completeSpotlight = useCallback(() => {
    setSpotlightCompleted(true);
    setPhase("idle");
    setSpotlightStep(0);
    const stored = readStorage();
    writeStorage({ ...stored, spotlightCompleted: true });
  }, []);

  const skipSpotlight = completeSpotlight;

  const startSpotlightTour = useCallback(() => {
    setSpotlightStep(0);
    setPhase("spotlight");
  }, []);

  // Reset
  const resetOnboarding = useCallback(() => {
    setWelcomeCompleted(false);
    setSpotlightCompleted(false);
    setWelcomeStep(0);
    setSpotlightStep(0);
    setPhase("welcome");
    writeStorage({ welcomeCompleted: false, spotlightCompleted: false });
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        phase,
        welcomeStep,
        welcomeSlides: WELCOME_SLIDES,
        welcomeCompleted,
        nextWelcome,
        prevWelcome,
        skipWelcome,
        completeWelcome,
        spotlightStep,
        tourSteps: TOUR_STEPS,
        spotlightCompleted,
        nextSpotlight,
        prevSpotlight,
        skipSpotlight,
        completeSpotlight,
        startSpotlightTour,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}
