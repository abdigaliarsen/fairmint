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
      maxOutputTokens: 200,
      temperature: 0.3,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("AI summary error:", error);
    return new Response(JSON.stringify({ error: "AI summary failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
