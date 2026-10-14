import { NextRequest, NextResponse } from "next/server";
import { verifyClaimsPass2 } from "@/lib/ai/evidence";

export async function POST(req: NextRequest) {
  try {
    const { claims } = await req.json();

    if (!claims || !Array.isArray(claims)) {
      return NextResponse.json({ error: "Missing or invalid claims array" }, { status: 400 });
    }

    const verified = await verifyClaimsPass2(claims);
    return NextResponse.json({ claims: verified });
  } catch (error: any) {
    console.error("Evidence API error:", error);
    return NextResponse.json(
      { error: "Failed to verify claims" },
      { status: 500 }
    );
  }
}
