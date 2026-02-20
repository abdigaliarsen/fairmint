# TokenTrust - Design System & Project Rules

## Project Overview

TokenTrust is a reputation-powered token intelligence platform for Solana, built with Next.js 14+ (App Router), TypeScript, Tailwind CSS, and shadcn/ui.

---

## Component Organization

- UI components (buttons, cards, badges, inputs): `src/components/ui/`
- Feature components (FairScoreDisplay, TokenCard, TrustRating): `src/components/features/`
- Layout components (header, footer, sidebar, page shells): `src/components/layout/`
- Page-level components: `src/app/` (Next.js App Router file-based routing)
- Hooks: `src/hooks/`
- Services (FairScale, Helius, Token Analyzer, Cache): `src/services/`
- Type definitions: `src/types/`
- Utility functions: `src/lib/`

## Naming Conventions

- React components: PascalCase (`TokenCard.tsx`, `FairScoreDisplay.tsx`)
- Hooks: camelCase with `use` prefix (`useFairScore.ts`, `useWalletAuth.ts`)
- Services: camelCase (`fairscale.ts`, `helius.ts`, `tokenAnalyzer.ts`)
- Types/interfaces: PascalCase with descriptive names (`FairScoreData`, `TokenAnalysis`)
- API routes: kebab-case directories under `src/app/api/`
- All components must be default-exported or named-exported consistently within each directory

---

## Styling Rules

- IMPORTANT: Use Tailwind CSS utility classes for all styling — no inline styles, no standalone CSS files
- IMPORTANT: Use shadcn/ui components as the base for all UI primitives (Button, Card, Input, Dialog, Badge, etc.)
- IMPORTANT: Never hardcode color hex values — always use Tailwind theme colors or CSS variables from the shadcn/ui theme
- Spacing uses Tailwind's default scale (`p-4`, `gap-6`, `mt-8`, etc.)
- Typography uses Tailwind's default type scale (`text-sm`, `text-lg`, `font-semibold`, etc.)
- Dark mode support via Tailwind's `dark:` variant and shadcn/ui theme system
- Use `cn()` utility (from `src/lib/utils.ts`) to merge conditional class names — do not use string concatenation
- Responsive design: mobile-first approach using Tailwind breakpoints (`sm:`, `md:`, `lg:`, `xl:`)
- Use `class-variance-authority` (cva) for component variants that need multiple visual states

### Design Tokens

- Colors: defined in `tailwind.config.ts` extending shadcn/ui's CSS variable system
- Border radius: use shadcn/ui's `rounded-*` tokens
- Shadows: use Tailwind's shadow scale (`shadow-sm`, `shadow-md`, etc.)

### Trust Score Color System

Use these semantic colors consistently for FairScore tiers:
- Bronze: `text-amber-600` / `bg-amber-100` / `border-amber-300`
- Silver: `text-slate-500` / `bg-slate-100` / `border-slate-300`
- Gold: `text-yellow-500` / `bg-yellow-50` / `border-yellow-300`
- Platinum: `text-violet-600` / `bg-violet-50` / `border-violet-300`
- Risk/danger: `text-red-600` / `bg-red-50` / `border-red-300`
- Trust/safe: `text-emerald-600` / `bg-emerald-50` / `border-emerald-300`

---

## Figma MCP Integration Rules

These rules define how to translate Figma inputs into code for this project and must be followed for every Figma-driven change.

### Required Flow (do not skip)

1. Run `get_design_context` first to fetch the structured representation for the exact node(s)
2. If the response is too large or truncated, run `get_metadata` to get the high-level node map, then re-fetch only the required node(s) with `get_design_context`
3. Run `get_screenshot` for a visual reference of the node variant being implemented
4. Only after you have both `get_design_context` and `get_screenshot`, download any assets needed and start implementation
5. Translate the output (usually React + Tailwind) into this project's conventions, styles, and framework
6. Validate against Figma for 1:1 look and behavior before marking complete

### Implementation Rules

- Treat the Figma MCP output (React + Tailwind) as a representation of design and behavior, not as final code style
- Reuse existing shadcn/ui components from `src/components/ui/` instead of duplicating functionality
- Use the project's color system (Tailwind theme + shadcn/ui CSS variables) instead of raw Tailwind colors from Figma output
- Map Figma typography to the project's type scale defined in `tailwind.config.ts`
- Map Figma spacing to Tailwind's default spacing scale
- Respect existing routing (Next.js App Router), state management (React hooks + Context), and data-fetch patterns (server components + API routes)
- Strive for 1:1 visual parity with the Figma design
- Validate the final UI against the Figma screenshot for both look and behavior

---

## Asset Handling

- IMPORTANT: If the Figma MCP server returns a localhost source for an image or SVG, use that source directly
- IMPORTANT: DO NOT import/add new icon packages — all assets should come from the Figma payload or Lucide icons (bundled with shadcn/ui)
- IMPORTANT: DO NOT use or create placeholders if a localhost source is provided
- Store downloaded static assets in `public/assets/`
- Token logos fetched from Helius metadata should be cached and served from `public/assets/tokens/`
- Brand assets (logo, badges) in `public/assets/brand/`

---

## Project-Specific Conventions

### Import Patterns

- Use path aliases: `@/` maps to `src/`
- Example: `import { Button } from "@/components/ui/button"`
- Group imports: React → third-party → internal components → hooks → services → types → utils

### API & Data Fetching

- IMPORTANT: Never expose API keys (FAIRSCALE_API_KEY, HELIUS_API_KEY) on the client — always proxy through Next.js API routes under `src/app/api/`
- Use server components for initial data fetching where possible
- Client-side data fetching via custom hooks (e.g., `useFairScore`, `useTokenData`)
- Cache FairScale responses aggressively (1-hour TTL) to respect rate limits (free tier: 1,000 req/month)

### FairScale Integration

- `/score` endpoint returns decimal scores (0-100 range) — use for full profile display
- `/fairScore` endpoint returns integer scores (0-1000+ range) — use for lightweight/batch checks
- `/walletScore` endpoint returns wallet-only scores — use for holder analysis
- Tier thresholds (integer scale): Bronze (0+), Silver (300+), Gold (600+), Platinum (850+)
- Always handle 404 responses gracefully — new/unknown wallets default to score 0, tier "unrated"

### Authentication

- Wallet-based auth via NextAuth.js with Solana wallet signature verification
- Session stored server-side
- Wallet address is the primary user identifier

### Database

- PostgreSQL via Prisma ORM
- Redis (Upstash) for caching layer
- All database queries go through the service layer, never directly from components

### Security

- IMPORTANT: Never expose API keys in client-side code
- IMPORTANT: Always sanitize and validate user input (wallet addresses, token mints) with Zod schemas
- IMPORTANT: All external API calls must go through server-side API routes
- Use HTTPS exclusively for all external API calls

### Accessibility

- All interactive elements must have appropriate aria-labels
- Color alone should not convey information (pair with text/icons for trust scores)
- Keyboard navigation required for all interactive components
- Use semantic HTML elements (`<main>`, `<nav>`, `<section>`, `<article>`)

### Performance

- Use Next.js `<Image>` component for all images
- Lazy load non-critical components below the fold
- Use React Server Components for data-heavy pages
- Implement loading skeletons for async data (FairScore lookups, token analysis)
