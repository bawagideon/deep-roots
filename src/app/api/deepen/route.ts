import { NextRequest, NextResponse } from "next/server";
import { deepenRabbitHole } from "@/lib/ai/decomposition";

export async function POST(req: NextRequest) {
  try {
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

    return NextResponse.json({ card: childCard, depth: currentDepth + 1 });
  } catch (error: any) {
    console.error("Deepen API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to deepen rabbit hole." },
      { status: 500 }
    );
  }
}
