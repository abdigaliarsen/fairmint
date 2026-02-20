import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeToken } from "@/services/tokenAnalyzer";

const querySchema = z.object({
  mints: z
    .string()
    .transform((s) =>
      s
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean)
    )
    .pipe(z.array(z.string().min(32).max(44)).min(1).max(4)),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = querySchema.safeParse({
      mints: searchParams.get("mints") ?? "",
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      parsed.data.mints.map((mint) => analyzeToken(mint))
    );

    return NextResponse.json({
      tokens: results.filter(Boolean),
    });
  } catch (error) {
    console.error("GET /api/compare error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
