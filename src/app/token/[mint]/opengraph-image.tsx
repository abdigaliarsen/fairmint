import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";
export const alt = "Token Trust Analysis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const RATING_COLORS: Record<string, string> = {
  trusted: "#10b981",
  caution: "#eab308",
  risky: "#ef4444",
};

export default async function Image({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = await params;
  const truncated = `${mint.slice(0, 6)}...${mint.slice(-4)}`;

  let name = "Unknown Token";
  let symbol = "";
  let trustRating = 0;
  let deployerTier = "unrated";

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data } = await supabase
        .from("token_analyses")
        .select("name, symbol, trust_rating, deployer_tier")
        .eq("mint", mint)
        .maybeSingle();

      if (data) {
        name = data.name ?? "Unknown Token";
        symbol = data.symbol ?? "";
        trustRating = data.trust_rating ?? 0;
        deployerTier = data.deployer_tier ?? "unrated";
      }
    }
  } catch {
    // Use defaults
  }

  const ratingLabel = trustRating >= 60 ? "trusted" : trustRating >= 30 ? "caution" : "risky";
  const ratingColor = RATING_COLORS[ratingLabel] ?? RATING_COLORS.risky;

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
        {/* Token name */}
        <div style={{ fontSize: 40, fontWeight: 700, color: "white", marginBottom: 4 }}>
          {name}
        </div>
        {symbol && (
          <div style={{ fontSize: 22, color: "#94a3b8", marginBottom: 24 }}>
            ${symbol}
          </div>
        )}

        {/* Trust Rating circle */}
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: "50%",
            border: `6px solid ${ratingColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 44, fontWeight: 700, color: "white" }}>
            {Math.round(trustRating)}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>/ 100</div>
        </div>

        {/* Rating label */}
        <div
          style={{
            padding: "6px 20px",
            borderRadius: 9999,
            background: ratingColor,
            color: "white",
            fontSize: 18,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 2,
            marginBottom: 12,
          }}
        >
          {ratingLabel}
        </div>

        {/* Mint address */}
        <div style={{ color: "#64748b", fontSize: 16 }}>{truncated}</div>

        {/* Deployer tier */}
        {deployerTier !== "unrated" && (
          <div style={{ color: "#94a3b8", fontSize: 14, marginTop: 8 }}>
            Deployer: {deployerTier.charAt(0).toUpperCase() + deployerTier.slice(1)} Tier
          </div>
        )}

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
          TokenTrust — Token Analysis
        </div>
      </div>
    ),
    { ...size }
  );
}
