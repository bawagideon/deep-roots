import { NextRequest, NextResponse } from "next/server";
import { deepenRabbitHole } from "@/lib/ai/decomposition";
import { getClientIdentifier, checkAndIncrementQuota } from "@/lib/security/quota";

export async function POST(req: NextRequest) {
  try {
    const { clientId, userId } = getClientIdentifier(req);
    const quota = checkAndIncrementQuota(clientId, userId);

    if (!quota.allowed) {
      return NextResponse.json(
        { error: "Daily exploration limit reached. Return tomorrow." },
        { status: 429 }
      );
    }

    const { parentCard, kind, targetComponent, questionText, currentDepth = 0 } = await req.json();

    if (!parentCard) {
      return NextResponse.json({ error: "Missing parentCard" }, { status: 400 });
    }

    if (currentDepth >= 3) {
      return NextResponse.json(
        { error: "Maximum rabbit hole depth of 3 reached." },
        { status: 400 }
      );
    }

    const childCard = await deepenRabbitHole({
      parentCard,
      kind: kind || "question",
      targetComponent,
      questionText,
      currentDepth,
    });

    return NextResponse.json({ card: childCard, depth: currentDepth + 1, quota });
  } catch (error: any) {
    console.error("Deepen API error:", error);
    return NextResponse.json(
      { error: "Failed to deepen rabbit hole." },
      { status: 500 }
    );
  }
}
