import { NextRequest, NextResponse } from "next/server";
import { StoredRoot, GraphEdge } from "@/types/roots";

export async function POST(req: NextRequest) {
  try {
    const { newRoot, existingRoots }: { newRoot: StoredRoot; existingRoots: StoredRoot[] } =
      await req.json();

    if (!newRoot || !existingRoots || existingRoots.length === 0) {
      return NextResponse.json({ edges: [], unexpected: null });
    }

    const createdEdges: GraphEdge[] = [];
    let unexpectedEdge: GraphEdge | null = null;

    const newConcepts = newRoot.card.concepts.map((c) => c.label.toLowerCase());

    for (const candidate of existingRoots) {
      if (candidate.id === newRoot.id) continue;

      const candidateConcepts = candidate.card.concepts.map((c) => c.label.toLowerCase());
      const common = newConcepts.filter((nc) =>
        candidateConcepts.some((cc) => cc.includes(nc) || nc.includes(cc))
      );

      // Check lens intersection
      const newLenses = new Set(newRoot.card.lenses);
      const candLenses = new Set(candidate.card.lenses);
      const isCrossLens = !Array.from(newLenses).some((l) => candLenses.has(l));

      if (common.length > 0) {
        const edge: GraphEdge = {
          id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          fromRoot: candidate.id,
          toRoot: newRoot.id,
          type: "shared_concept",
          why: `Both touch the systemic concept of "${common[0]}".`,
          createdAt: new Date().toISOString(),
        };
        createdEdges.push(edge);
      } else if (isCrossLens && existingRoots.length >= 2) {
        // Evaluate for unexpected connection signature mechanic
        unexpectedEdge = {
          id: `edge-unexpected-${Date.now()}`,
          fromRoot: candidate.id,
          toRoot: newRoot.id,
          type: "unexpected",
          why: `Connects ${candidate.title} (${candidate.card.lenses.join(", ")}) to ${newRoot.title} (${newRoot.card.lenses.join(", ")}) through shared industrial & cultural transformation.`,
          limits: "Operate across distinct domains with differing consumer velocities.",
          createdAt: new Date().toISOString(),
        };
        createdEdges.push(unexpectedEdge);
        break;
      }
    }

    return NextResponse.json({ edges: createdEdges, unexpected: unexpectedEdge });
  } catch (error: any) {
    console.error("Link API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to link cards" },
      { status: 500 }
    );
  }
}
