import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import WalletProvider from "@/providers/WalletProvider";
import SessionProvider from "@/providers/SessionProvider";
import OnboardingProvider from "@/providers/OnboardingProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "@/components/layout/Header";
import ThemeProvider from "@/providers/ThemeProvider";
import Footer from "@/components/layout/Footer";
import WelcomeDialog from "@/components/features/WelcomeDialog";
import SpotlightTour from "@/components/features/SpotlightTour";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TokenTrust — Reputation-Powered Token Intelligence",
  description:
    "Solana token intelligence powered by FairScale reputation scores. Analyze tokens, deployers, and holder quality before you trade.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <WalletProvider>
            <SessionProvider>
              <TooltipProvider>
                <OnboardingProvider>
                  <div className="flex min-h-svh flex-col">
                    <Header />
                    <main className="flex-1">{children}</main>
                    <Footer />
                  </div>
                  <WelcomeDialog />
                  <SpotlightTour />
                </OnboardingProvider>
              </TooltipProvider>
            </SessionProvider>
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
