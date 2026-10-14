import { NextRequest, NextResponse } from "next/server";
import { StoredRoot, GraphEdge } from "@/types/roots";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const { newRoot, existingRoots }: { newRoot: StoredRoot; existingRoots: StoredRoot[] } =
      await req.json();

    if (!newRoot || !existingRoots || existingRoots.length === 0) {
      return NextResponse.json({ edges: [], unexpected: null });
    }

    const createdEdges: GraphEdge[] = [];
    let unexpectedEdge: GraphEdge | null = null;

    // Filter candidates (exclude self)
    const candidates = existingRoots.filter((r) => r.id !== newRoot.id).slice(0, 5);
    if (candidates.length === 0) {
      return NextResponse.json({ edges: [], unexpected: null });
    }

    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
          model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
          systemInstruction: `
You are the Knowledge Graph Adjudicator for Deep Roots.
Evaluate whether a new Roots Card has a GENUINE systemic or historical relationship to any existing cards.
Rules:
- Returning NO links (empty array []) is completely normal and valid. NEVER force connections.
- Only link if there is an explicit, real causal, conceptual, or contrasting mechanism.
- "type" must be one of: "shared_concept", "cause", "contrast", "unexpected".
- "unexpected" should ONLY be used if the connection links different lenses in a surprising, verifiable way.
- "why" must be under 140 characters and explain the specific relationship.
- Include "limits" stating where the analogy or link breaks down.

Output format:
{
  "links": [
    {
      "candidateId": string,
      "type": "shared_concept" | "cause" | "contrast" | "unexpected",
      "why": string,
      "limits": string
    }
  ]
}
`,
        });

        const prompt = `New Card:
Title: "${newRoot.title}"
Root: "${newRoot.card.root.headline}"
Concepts: ${newRoot.card.concepts.map((c) => c.label).join(", ")}
Lenses: ${newRoot.card.lenses.join(", ")}

Candidate Existing Cards:
${candidates
  .map(
    (c) =>
      `- ID: "${c.id}" | Title: "${c.title}" | Root: "${c.card.root.headline}" | Concepts: ${c.card.concepts
        .map((x) => x.label)
        .join(", ")} | Lenses: ${c.card.lenses.join(", ")}`
  )
  .join("\n")}

Determine if any genuine relationships exist.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const parsed = JSON.parse(text);

        if (Array.isArray(parsed.links)) {
          for (const item of parsed.links) {
            const edge: GraphEdge = {
              id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              fromRoot: item.candidateId,
              toRoot: newRoot.id,
              type: item.type || "shared_concept",
              why: (item.why || "").slice(0, 140),
              limits: item.limits,
              createdAt: new Date().toISOString(),
            };
            createdEdges.push(edge);
            if (edge.type === "unexpected" && !unexpectedEdge) {
              unexpectedEdge = edge;
            }
          }
        }
      } catch (err) {
        console.warn("AI graph adjudication error:", err);
      }
    }

    return NextResponse.json({ edges: createdEdges, unexpected: unexpectedEdge });
  } catch (error: any) {
    console.error("Link API error:", error);
    return NextResponse.json(
      { error: "Failed to evaluate cross-scan links" },
      { status: 500 }
    );
  }
}
