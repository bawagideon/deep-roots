import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { RootsCard } from "@/types/roots";
import { RootsCardSchema, validateRootsCardIntegrity } from "@/lib/schema";
import { safeFetchUrl } from "@/lib/security/safe-fetch";

const SYSTEM_DECOMPOSITION_PROMPT = `
You are the Decomposition Engine for Deep Roots.
Your purpose: Make people look at ordinary things differently. Break any input into components, reveal the hidden systems behind it, and show how those components connect to other parts of human life.

CRITICAL PRODUCT CONTRACT:
1. DYNAMIC LAYERS (2 to 5): Choose ONLY layers that actually matter for THIS specific input (e.g., Biology, Etymology, Trade Logistics, Psychology, Materials, Postwar Geopolitics).
2. THE ROOT: One genuinely surprising, checkable discovery (the hidden layer) that changes how the user sees the input. The headline must be provocative and true. The body explains it concisely (under 400 chars).
   - MUST cite at least one claim ID in root.claimIds (e.g. ["c1"]).
3. COMPONENTS (3 to 6): Each component must have:
   - name: Distinct physical, linguistic, or structural component
   - role: Its functional job (under 120 chars)
   - hiddenFact: An unexpected, factual insight (under 250 chars)
   - claimIds: Array of cited claim IDs from claims
   - layer: Which layer it belongs to
   - lens: One of the 6 lenses ("language", "culture", "mind", "money", "tech", "origins")
4. FLEXIBLE LENSES (1 to 6): ONLY list lenses with a genuine, demonstrable link from: "language", "culture", "mind", "money", "tech", "origins". Never invent or pad lenses to fill space.
5. EVIDENCE & CLAIMS: Every factual assertion MUST be listed in claims.
   - id: "c1", "c2", "c3", etc.
   - text: Checkable factual claim under 140 characters.
   - status: "established" (verified scientific or historical consensus), "interpretation" (contested history or plausible hypothesis), or "open_question" (unresolved mystery).
   - sources: Must be empty [] in Pass 1.
6. NEXT QUESTIONS: Exactly 3 exploratory questions:
   - Must use kind: "deepen", "cause", "compare", or "contradiction".
7. CONCEPTS (2 to 5): Key conceptual anchors for cross-scan linking (e.g. "Monobloc", "Flash-frying", "Quarantine").
8. PRIVACY: For receipts, chats, or personal IDs, analyze the systemic and cultural structure only. NEVER output personal names, phone numbers, addresses, or account numbers.

OUTPUT VALID JSON ONLY matching this schema:
{
  "title": string,
  "oneLiner": string,
  "inputKind": "photo" | "screenshot" | "text" | "question" | "link",
  "inputSummary": string,
  "needsClarification": null,
  "root": {
    "headline": string,
    "body": string,
    "claimIds": ["c1"],
    "lens": "tech"
  },
  "layers": [
    {
      "name": string,
      "lens": "tech",
      "summary": string,
      "claimIds": ["c1"]
    }
  ],
  "components": [
    {
      "name": string,
      "role": string,
      "hiddenFact": string,
      "claimIds": ["c1"],
      "layer": string,
      "lens": "tech"
    }
  ],
  "lenses": ["tech"],
  "nextQuestions": [
    {
      "text": string,
      "kind": "deepen"
    }
  ],
  "concepts": [
    {
      "label": string,
      "lens": "tech"
    }
  ],
  "claims": [
    {
      "id": "c1",
      "text": string,
      "status": "established",
      "sources": []
    }
  ]
}
`;

function sanitizeAndRepairCard(raw: any, inputKind: string, inputText?: string): any {
  const card = { ...raw };

  card.title = (card.title || inputText || "Discovery").slice(0, 80);
  card.oneLiner = (card.oneLiner || "Exploring hidden systems and origins.").slice(0, 200);
  card.inputKind = card.inputKind || inputKind;
  card.inputSummary = (card.inputSummary || `Inspection of ${card.title}`).slice(0, 200);

  // Claims repair
  if (!Array.isArray(card.claims) || card.claims.length === 0) {
    card.claims = [
      {
        id: "c1",
        text: `${card.title} emerged from specific historical, material, or social developments.`.slice(0, 140),
        status: "established",
        sources: [],
      },
    ];
  } else {
    card.claims = card.claims.map((c: any, i: number) => ({
      id: c.id || `c${i + 1}`,
      text: (c.text || "").slice(0, 190),
      status: ["established", "interpretation", "open_question"].includes(c.status)
        ? c.status
        : "established",
      sources: Array.isArray(c.sources) ? c.sources : [],
    }));
  }

  const claimIdsSet = new Set(card.claims.map((c: any) => c.id));
  const fallbackClaimId = card.claims[0].id;

  // Root repair
  card.root = card.root || {};
  card.root.headline = (card.root.headline || `${card.title} holds surprising origins`).slice(0, 200);
  card.root.body = (card.root.body || "Detailed systemic breakdown.").slice(0, 580);
  if (!Array.isArray(card.root.claimIds) || card.root.claimIds.length === 0) {
    card.root.claimIds = [fallbackClaimId];
  } else {
    card.root.claimIds = card.root.claimIds.filter((id: string) => claimIdsSet.has(id));
    if (card.root.claimIds.length === 0) card.root.claimIds = [fallbackClaimId];
  }

  // Layers repair (2 to 5)
  if (!Array.isArray(card.layers) || card.layers.length < 2) {
    card.layers = [
      {
        name: "Origins & Materials",
        summary: "The elemental inputs and historical origins.",
        claimIds: [fallbackClaimId],
        lens: card.lenses?.[0] || "origins",
      },
      {
        name: "Human System",
        summary: "The economic or cultural interactions.",
        claimIds: [fallbackClaimId],
        lens: card.lenses?.[1] || "culture",
      },
    ];
  } else {
    card.layers = card.layers.slice(0, 5).map((l: any) => ({
      ...l,
      name: (l.name || "Layer").slice(0, 70),
      summary: (l.summary || "").slice(0, 320),
      claimIds: Array.isArray(l.claimIds)
        ? l.claimIds.filter((id: string) => claimIdsSet.has(id))
        : [fallbackClaimId],
    }));
  }

  // Components repair (3 to 6)
  if (!Array.isArray(card.components) || card.components.length < 3) {
    const existing = Array.isArray(card.components) ? card.components : [];
    while (existing.length < 3) {
      existing.push({
        name: `Component ${existing.length + 1}`,
        role: "Essential structural function",
        hiddenFact: "Operates according to standard physical or systemic principles.",
        claimIds: [fallbackClaimId],
      });
    }
    card.components = existing;
  }
  card.components = card.components.slice(0, 6).map((c: any) => ({
    ...c,
    name: (c.name || "Part").slice(0, 70),
    role: (c.role || "").slice(0, 180),
    hiddenFact: (c.hiddenFact || "").slice(0, 320),
    claimIds: Array.isArray(c.claimIds)
      ? c.claimIds.filter((id: string) => claimIdsSet.has(id))
      : [fallbackClaimId],
  }));

  // Lenses repair (1 to 6)
  const validLenses = ["language", "culture", "mind", "money", "tech", "origins"];
  if (!Array.isArray(card.lenses) || card.lenses.length === 0) {
    card.lenses = ["tech"];
  } else {
    card.lenses = card.lenses.filter((l: string) => validLenses.includes(l));
    if (card.lenses.length === 0) card.lenses = ["tech"];
  }

  // NextQuestions repair (exactly 3)
  const validKinds = ["deepen", "cause", "compare", "contradiction"];
  if (!Array.isArray(card.nextQuestions)) card.nextQuestions = [];
  card.nextQuestions = card.nextQuestions.slice(0, 3).map((q: any) => ({
    text: (q.text || "").slice(0, 200),
    kind: validKinds.includes(q.kind) ? q.kind : "deepen",
    targetComponent: q.targetComponent ? String(q.targetComponent).slice(0, 60) : undefined,
  }));
  while (card.nextQuestions.length < 3) {
    const kinds: ("deepen" | "cause" | "compare")[] = ["deepen", "cause", "compare"];
    card.nextQuestions.push({
      text: `What systemic question remains unanswered about ${card.title}?`,
      kind: kinds[card.nextQuestions.length] || "deepen",
    });
  }

  // Concepts repair (2 to 8)
  if (!Array.isArray(card.concepts) || card.concepts.length < 2) {
    card.concepts = [
      { label: card.title, lens: card.lenses[0] },
      { label: "Underlying mechanism", lens: card.lenses[1] || card.lenses[0] },
    ];
  } else {
    card.concepts = card.concepts.slice(0, 8).map((con: any) => ({
      label: (con.label || "Concept").slice(0, 60),
      lens: validLenses.includes(con.lens) ? con.lens : undefined,
    }));
  }

  return card;
}

export async function decomposeInput({
  inputKind,
  inputText,
  imageBase64,
  mimeType = "image/jpeg",
}: {
  inputKind: "photo" | "screenshot" | "text" | "question" | "link";
  inputText?: string;
  imageBase64?: string;
  mimeType?: string;
}): Promise<RootsCard> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  let effectiveInputText = inputText;

  // If input is a Link, safely fetch and extract webpage content
  if (inputKind === "link" && inputText) {
    try {
      const fetched = await safeFetchUrl(inputText);
      effectiveInputText = `Webpage Title: "${fetched.title}"\nURL: ${fetched.finalUrl}\nContent excerpt: ${fetched.extractedText}`;
    } catch (err: any) {
      throw new Error(`Failed to safely fetch link: ${err.message}`);
    }
  }

  let rawJsonText: string | null = null;
  let lastError: Error | null = null;

  // 1. Try Gemini models (Primary model + Fallback model)
  if (geminiKey) {
    const primaryModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.7-flash";
    const modelsToTry = [primaryModel, fallbackModel];

    const genAI = new GoogleGenerativeAI(geminiKey);

    for (const mName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({
          model: mName,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
          systemInstruction: SYSTEM_DECOMPOSITION_PROMPT,
        });

        const parts: any[] = [];
        if (imageBase64) {
          const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
          parts.push({
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType || "image/jpeg",
            },
          });
        }

        const promptText = `Input kind: ${inputKind}\n${
          effectiveInputText ? `Input content: "${effectiveInputText}"` : "Analyze this visual input."
        }\nReturn complete Deep Roots decomposition now. Ensure root.claimIds contains valid claim IDs from claims.`;
        parts.push(promptText);

        const result = await model.generateContent(parts);
        rawJsonText = result.response.text();
        if (rawJsonText) break; // Succeeded!
      } catch (err: any) {
        console.warn(`Gemini (${mName}) attempt error:`, err.message);
        lastError = err;
      }
    }
  }

  // 2. Try Anthropic Claude if available
  if (!rawJsonText && anthropicKey) {
    try {
      const anthropic = new Anthropic({ apiKey: anthropicKey });
      const modelName = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

      const content: any[] = [];
      if (imageBase64) {
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: (mimeType as any) || "image/jpeg",
            data: cleanBase64,
          },
        });
      }

      content.push({
        type: "text",
        text: `Input kind: ${inputKind}\n${
          effectiveInputText ? `Input content: "${effectiveInputText}"` : "Analyze this visual input."
        }\nDecompose now into valid JSON only.`,
      });

      const response = await anthropic.messages.create({
        model: modelName,
        max_tokens: 3000,
        system: SYSTEM_DECOMPOSITION_PROMPT,
        messages: [{ role: "user", content }],
      });

      const block = response.content[0];
      if (block.type === "text") {
        rawJsonText = block.text;
      }
    } catch (err: any) {
      console.warn("Anthropic decomposition failed:", err.message);
      lastError = err;
    }
  }

  if (!rawJsonText) {
    throw new Error(
      lastError
        ? `Decomposition service temporarily unavailable: ${lastError.message}`
        : "AI provider credentials not configured on server. Please check GEMINI_API_KEY or ANTHROPIC_API_KEY."
    );
  }

  // Clean JSON string
  const cleaned = rawJsonText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    throw new Error("AI returned malformed JSON response. Please retry.");
  }

  // Sanitize, normalize, and repair before validation
  const repaired = sanitizeAndRepairCard(parsed, inputKind, effectiveInputText);

  // Validate with Zod
  const validated = RootsCardSchema.parse(repaired);
  return validated;
}

export async function deepenRabbitHole({
  parentCard,
  kind,
  targetComponent,
  questionText,
  currentDepth,
}: {
  parentCard: RootsCard;
  kind: "component" | "question";
  targetComponent?: string;
  questionText?: string;
  currentDepth: number;
}): Promise<RootsCard> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  const targetTopic = questionText || targetComponent || "Underlying mechanism";
  const prompt = `We are exploring a rabbit hole into "${parentCard.title}" (current depth ${currentDepth + 1} of 3).
Parent context:
- Parent title: ${parentCard.title}
- Parent root headline: ${parentCard.root.headline}
- Focus topic: ${kind === "component" ? `Component: ${targetComponent}` : `Question: ${questionText}`}

Decompose THIS specific sub-topic into its own complete child Roots Card. Keep it grounded in the parent context.
Focus on the deeper causal mechanism or hidden system. Return valid JSON only.`;

  let rawJsonText: string | null = null;
  let lastError: Error | null = null;

  if (geminiKey) {
    const primaryModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.7-flash";
    const modelsToTry = [primaryModel, fallbackModel];

    const genAI = new GoogleGenerativeAI(geminiKey);

    for (const mName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({
          model: mName,
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
          systemInstruction: SYSTEM_DECOMPOSITION_PROMPT,
        });
        const result = await model.generateContent(prompt);
        rawJsonText = result.response.text();
        if (rawJsonText) break;
      } catch (err: any) {
        lastError = err;
      }
    }
  }

  if (!rawJsonText && anthropicKey) {
    try {
      const anthropic = new Anthropic({ apiKey: anthropicKey });
      const response = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022",
        max_tokens: 2500,
        system: SYSTEM_DECOMPOSITION_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });
      const block = response.content[0];
      if (block.type === "text") rawJsonText = block.text;
    } catch (err: any) {
      lastError = err;
    }
  }

  if (!rawJsonText) {
    throw new Error(
      lastError
        ? `Unable to deepen rabbit hole: ${lastError.message}`
        : "AI service credentials missing."
    );
  }

  const cleaned = rawJsonText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);
  const repaired = sanitizeAndRepairCard(parsed, "question", targetTopic);
  return RootsCardSchema.parse(repaired);
}
