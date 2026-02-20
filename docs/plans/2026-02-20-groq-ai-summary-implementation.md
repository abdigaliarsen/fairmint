# Groq AI Summary Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add streaming AI-generated summaries to token, deployer, and reputation pages using Groq via the Vercel AI SDK.

**Architecture:** A single streaming POST endpoint (`/api/ai/summary`) accepts page type + context data and returns a streamed response from Groq's llama-3.3-70b-versatile model. A shared `useAISummary` hook wraps the Vercel AI SDK's `useCompletion()` and auto-fires when page data loads. An `AISummaryCard` component renders the streaming text.

**Tech Stack:** Vercel AI SDK (`ai`), Groq provider (`@ai-sdk/groq`), Next.js App Router, React, Tailwind/shadcn

---

### Task 1: Install dependencies

**Step 1: Install Vercel AI SDK and Groq provider**

Run:
```bash
npm install ai @ai-sdk/groq
```

**Step 2: Verify installation**

Run:
```bash
node -e "require('ai'); require('@ai-sdk/groq'); console.log('OK')"
```
Expected: `OK`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Vercel AI SDK and Groq provider dependencies"
```

---

### Task 2: Create the streaming API route

**Files:**
- Create: `src/app/api/ai/summary/route.ts`

**Step 1: Create the API route**

```typescript
import { streamText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are TokenTrust AI, a concise analyst for a Solana token intelligence platform powered by the FairScale reputation API.

Rules:
- Write 2-4 sentences maximum.
- Reference specific data points (e.g. "trust rating of 72", "3 risk flags").
- Use plain language. No jargon. No markdown formatting.
- NEVER give financial advice, buy/sell recommendations, or price predictions.
- Focus on what the data tells us about trustworthiness and risk.`;

const bodySchema = z.object({
  type: z.enum(["token", "deployer", "reputation"]),
  context: z.record(z.unknown()),
});

function buildUserPrompt(
  type: "token" | "deployer" | "reputation",
  context: Record<string, unknown>
): string {
  switch (type) {
    case "token":
      return `Summarize this Solana token's trustworthiness:
Name: ${context.name ?? "Unknown"} (${context.symbol ?? "N/A"})
Trust Rating: ${context.trustRating}/100
Deployer Score: ${context.deployerScore ?? "Unknown"} (Tier: ${context.deployerTier ?? "unrated"})
Holder Count: ${context.holderCount ?? "N/A"}
Top Holder Concentration: ${context.topHolderConcentration ?? "N/A"}%
Holder Quality Score: ${context.holderQualityScore ?? "N/A"}
Risk Flags: ${Array.isArray(context.riskFlags) && context.riskFlags.length > 0 ? (context.riskFlags as Array<{ label: string; severity: string }>).map((f) => `${f.label} (${f.severity})`).join(", ") : "None"}`;

    case "deployer":
      return `Summarize this Solana token deployer's reputation:
Wallet: ${context.wallet ?? "Unknown"}
FairScore: ${context.score ?? "N/A"}/100 (Tier: ${context.tier ?? "unrated"})
Tokens Deployed: ${context.tokenCount ?? 0}
Badges Earned: ${context.badgeCount ?? 0}${context.badgeLabels ? `\nBadge Names: ${context.badgeLabels}` : ""}`;

    case "reputation":
      return `Summarize this Solana wallet's trust reputation:
Wallet: ${context.wallet ?? "Unknown"}
FairScore (Decimal): ${context.decimalScore ?? "N/A"}/100
FairScore (Integer): ${context.integerScore ?? "N/A"}
Wallet Score: ${context.walletScore ?? "N/A"}
Tier: ${context.tier ?? "unrated"}
Badges: ${context.badgeCount ?? 0}${context.badgeLabels ? `\nBadge Names: ${context.badgeLabels}` : ""}`;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!process.env.GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { type, context } = parsed.data;
    const userPrompt = buildUserPrompt(type, context);

    const result = streamText({
      model: groq("llama-3.3-70b-versatile"),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 200,
      temperature: 0.3,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("AI summary error:", error);
    return new Response(JSON.stringify({ error: "AI summary failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```

**Step 2: Verify it builds**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors

**Step 3: Commit**

```bash
git add src/app/api/ai/summary/route.ts
git commit -m "feat: add streaming AI summary API route with Groq"
```

---

### Task 3: Create the useAISummary hook

**Files:**
- Create: `src/hooks/useAISummary.ts`

**Step 1: Create the hook**

```typescript
"use client";

import { useCompletion } from "ai/react";
import { useEffect, useRef } from "react";

interface UseAISummaryOptions {
  type: "token" | "deployer" | "reputation";
  context: Record<string, unknown> | null;
}

export function useAISummary({ type, context }: UseAISummaryOptions) {
  const hasFired = useRef(false);

  const { completion, isLoading, error, complete } = useCompletion({
    api: "/api/ai/summary",
  });

  useEffect(() => {
    if (!context || hasFired.current) return;
    hasFired.current = true;

    complete("", {
      body: { type, context },
    });
  }, [context, type, complete]);

  return { text: completion, loading: isLoading, error: !!error };
}
```

**Step 2: Verify it builds**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors

**Step 3: Commit**

```bash
git add src/hooks/useAISummary.ts
git commit -m "feat: add useAISummary hook for streaming AI completions"
```

---

### Task 4: Create the AISummaryCard component

**Files:**
- Create: `src/components/features/AISummaryCard.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAISummary } from "@/hooks/useAISummary";

interface AISummaryCardProps {
  type: "token" | "deployer" | "reputation";
  context: Record<string, unknown> | null;
}

export default function AISummaryCard({ type, context }: AISummaryCardProps) {
  const { text, loading, error } = useAISummary({ type, context });

  // Don't render anything if AI is not configured or errored silently
  if (error && !text) return null;

  // Don't render until we have context data
  if (!context) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-violet-500" />
          AI Analysis
          <span className="ml-auto text-[10px] font-normal text-muted-foreground">
            Powered by Groq
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && !text && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        )}
        {text && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {text}
            {loading && (
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-violet-500" />
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify it builds**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors

**Step 3: Commit**

```bash
git add src/components/features/AISummaryCard.tsx
git commit -m "feat: add AISummaryCard component with streaming text"
```

---

### Task 5: Add AISummaryCard to the token page

**Files:**
- Modify: `src/app/token/[mint]/page.tsx`

**Step 1: Add import**

Add to the imports section:
```typescript
import AISummaryCard from "@/components/features/AISummaryCard";
```

**Step 2: Add the card**

Insert the `<AISummaryCard>` after the score header area (after the `<Separator />` and before the Score Breakdown section). Pass token analysis data as context:

```tsx
<AISummaryCard
  type="token"
  context={data ? {
    name: data.name,
    symbol: data.symbol,
    trustRating: data.trustRating,
    deployerScore: data.deployerScore,
    deployerTier: data.deployerTier,
    holderCount: data.holderCount,
    topHolderConcentration: data.topHolderConcentration,
    holderQualityScore: data.holderQualityScore,
    riskFlags: data.riskFlags,
  } : null}
/>
```

**Step 3: Verify it builds**

Run:
```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/app/token/[mint]/page.tsx
git commit -m "feat: add AI summary to token page"
```

---

### Task 6: Add AISummaryCard to the deployer page

**Files:**
- Modify: `src/app/deployer/[wallet]/page.tsx`

**Step 1: Add import**

```typescript
import AISummaryCard from "@/components/features/AISummaryCard";
```

**Step 2: Add the card**

Insert after the `<Separator />` and before the Score Breakdown section:

```tsx
<AISummaryCard
  type="deployer"
  context={data ? {
    wallet: truncateAddress(data.wallet),
    score: data.fairScore?.score,
    tier: data.fairScore?.tier,
    tokenCount: data.tokenCount,
    badgeCount: data.fairScore?.badges?.length ?? 0,
    badgeLabels: data.fairScore?.badges?.map((b) => b.label).join(", "),
  } : null}
/>
```

**Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add src/app/deployer/[wallet]/page.tsx
git commit -m "feat: add AI summary to deployer page"
```

---

### Task 7: Add AISummaryCard to the reputation page

**Files:**
- Modify: `src/app/reputation/[wallet]/page.tsx`

**Step 1: Add import**

```typescript
import AISummaryCard from "@/components/features/AISummaryCard";
```

**Step 2: Add the card**

Insert after the `<Separator />` and before the Badges section:

```tsx
<AISummaryCard
  type="reputation"
  context={data ? {
    wallet: truncateAddress(data.wallet),
    decimalScore: data.fairScore?.decimalScore,
    integerScore: data.fairScore?.integerScore,
    walletScore: data.fairScore?.walletScore,
    tier: data.fairScore?.tier,
    badgeCount: data.fairScore?.badges?.length ?? 0,
    badgeLabels: data.fairScore?.badges?.map((b: { label: string }) => b.label).join(", "),
  } : null}
/>
```

**Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add src/app/reputation/[wallet]/page.tsx
git commit -m "feat: add AI summary to reputation page"
```

---

### Task 8: Add GROQ_API_KEY to Vercel and verify

**Step 1: Add env var to Vercel**

Run:
```bash
echo "Add GROQ_API_KEY to Vercel environment variables via the Vercel dashboard (Settings > Environment Variables). Value: the key from .env.local."
```

**Step 2: Full build check**

Run:
```bash
npx next build
```
Expected: builds successfully

**Step 3: Push and deploy**

```bash
git push origin main
```

**Step 4: Manual verification**

- Visit `/token/<any-analyzed-mint>` — AI Analysis card should appear near the top with streaming text
- Visit `/deployer/<any-wallet>` — AI Analysis card with deployer summary
- Visit `/reputation/<any-wallet>` — AI Analysis card with reputation summary
- If `GROQ_API_KEY` is missing on Vercel, the card should silently not render (no errors)
