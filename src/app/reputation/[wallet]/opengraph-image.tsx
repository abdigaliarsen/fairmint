import { ImageResponse } from "next/og";
import { getFullScore } from "@/services/fairscale";

export const runtime = "edge";
export const alt = "Trust Passport";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TIER_COLORS: Record<string, string> = {
  platinum: "#7c3aed",
  gold: "#eab308",
  silver: "#64748b",
  bronze: "#d97706",
  unrated: "#9ca3af",
};

export default async function Image({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = await params;
  const truncated = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

  let tier = "unrated";
  let score = 0;
  try {
    const data = await getFullScore(wallet);
    if (data) {
      tier = data.tier;
      score = data.decimalScore;
    }
  } catch {
    // Use defaults
  }

  const color = TIER_COLORS[tier] || TIER_COLORS.unrated;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Score circle */}
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: "50%",
            border: `6px solid ${color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 700, color: "white" }}>
            {Math.round(score)}
          </div>
        </div>

        {/* Tier badge */}
        <div
          style={{
            padding: "8px 24px",
            borderRadius: 9999,
            background: color,
            color: "white",
            fontSize: 24,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 2,
            marginBottom: 16,
          }}
        >
          {tier}
        </div>

        {/* Wallet */}
        <div style={{ color: "#94a3b8", fontSize: 20 }}>{truncated}</div>

        {/* Branding */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#10b981",
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          TokenTrust — Trust Passport
        </div>
      </div>
    ),
    { ...size }
  );
}
