# Groq AI Summary Feature — Design

## Goal

Add auto-generated, streaming AI summaries to the token, deployer, and reputation pages using Groq (llama-3.3-70b-versatile) via the Vercel AI SDK.

## Architecture

One streaming API route (`POST /api/ai/summary`) receives page context and returns a streamed plain-English summary. A shared `useAISummary` hook auto-fires when page data loads. An `AISummaryCard` component renders the streaming text.

```
Page loads data → useAISummary fires POST → Groq generates → streams back → AISummaryCard renders word-by-word
```

### Dependencies

- `ai` (Vercel AI SDK)
- `@ai-sdk/groq` (Groq provider)

### Files

| File | Action |
|---|---|
| `src/app/api/ai/summary/route.ts` | Create — streaming POST endpoint |
| `src/hooks/useAISummary.ts` | Create — client hook wrapping `useCompletion()` |
| `src/components/features/AISummaryCard.tsx` | Create — UI card with streaming text |
| `src/app/token/[mint]/page.tsx` | Modify — add `<AISummaryCard>` |
| `src/app/deployer/[wallet]/page.tsx` | Modify — add `<AISummaryCard>` |
| `src/app/reputation/[wallet]/page.tsx` | Modify — add `<AISummaryCard>` |

### Environment

- `GROQ_API_KEY` — server-side only, never exposed to client

## Prompt Design

System prompt instructs the model it is a TokenTrust AI analyst. Rules:

- No financial advice or buy/sell recommendations
- Reference specific data points (e.g. "trust rating of 72")
- Keep it under 4 sentences
- Use plain language, no jargon

### Context per page type

**Token (`type: "token"`):** name, symbol, trust rating, deployer score/tier, holder count, top holder concentration, holder quality score, risk flags.

**Deployer (`type: "deployer"`):** wallet (truncated), FairScore decimal + tier, badge count, token count, badge labels.

**Reputation (`type: "reputation"`):** wallet (truncated), FairScore decimal + integer, wallet score, tier, badge labels.

## UI

`AISummaryCard` — shadcn Card placed near the top of each page (below score header, above detail sections).

- Header: sparkle icon + "AI Analysis" + "Powered by Groq" subtitle
- Body: streaming text with blinking cursor while generating
- Loading: pulsing skeleton line
- Error: muted "AI summary unavailable" text (non-blocking)

Auto-generates on page data load. Gracefully hides on failure. Purely additive — never blocks the page.

## Model

`llama-3.3-70b-versatile` — fast, capable, within Groq free tier limits.
