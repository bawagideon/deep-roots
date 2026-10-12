import { NextRequest, NextResponse } from "next/server";
import { fetchEvidencePass2 } from "@/lib/ai/decomposition";

export async function POST(req: NextRequest) {
  try {
    const { claims } = await req.json();

    if (!claims || !Array.isArray(claims)) {
      return NextResponse.json({ error: "Missing or invalid claims array" }, { status: 400 });
    }

    const verifiedClaims = await fetchEvidencePass2(claims);
    return NextResponse.json({ claims: verifiedClaims });
  } catch (error: any) {
    console.error("Evidence API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve evidence." },
      { status: 500 }
    );
  }
}
