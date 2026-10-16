import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateRootsCardIntegrity, RootsCardSchema } from "../src/lib/schema";
import { RootsCard } from "../src/types/roots";

describe("Schema & Graph Cross-Reference Integrity", () => {
  const sampleCard: RootsCard = {
    title: "Bicycle Chain",
    oneLiner: "The interlocking link mechanism that converted human pedaling into industrial velocity.",
    inputKind: "text",
    inputSummary: "Bicycle chain",
    root: {
      headline: "The bush roller chain enabled modern synchronized power transmission.",
      body: "Invented by Hans Renold in 1880, the bush roller chain removed friction and allowed uniform power delivery.",
      claimIds: ["c1", "c2"],
      lens: "tech",
    },
    layers: [
      {
        name: "Materials & Metallurgy",
        summary: "Hardened steel alloy links with carbon heat treatment.",
        claimIds: ["c1"],
        lens: "tech",
      },
      {
        name: "Industrial Velocity",
        summary: "The adoption of pedal transit revolutionized urban labor and mobility.",
        claimIds: ["c2"],
        lens: "origins",
      },
    ],
    components: [
      {
        name: "Outer Plate",
        role: "Structural link holding pin tension",
        hiddenFact: "Punched from high-carbon cold-rolled sheet steel.",
        claimIds: ["c1"],
      },
      {
        name: "Bushing & Roller",
        role: "Rotating contact point with sprocket teeth",
        hiddenFact: "Distributes force over rolling contact instead of sliding friction.",
        claimIds: ["c1"],
      },
      {
        name: "Bearing Pin",
        role: "Axle for link rotation",
        hiddenFact: "Induction-hardened to withstand hundreds of pounds of cyclical tensile force.",
        claimIds: ["c2"],
      },
    ],
    lenses: ["tech", "origins", "money"],
    nextQuestions: [
      {
        kind: "deepen",
        text: "How did early bicycle chains influence motorcycle and tank drive systems?",
        targetComponent: "Bushing & Roller",
      },
      {
        kind: "cause",
        text: "Why did roller chains replace shaft-drive systems in early safety bicycles?",
      },
      {
        kind: "compare",
        text: "How does chain efficiency compare to modern carbon belt drive systems?",
      },
    ],
    concepts: [
      { label: "Bush Roller Chain", lens: "tech" },
      { label: "Safety Bicycle", lens: "origins" },
    ],
    claims: [
      {
        id: "c1",
        text: "Hans Renold patented the bush roller chain in Manchester in 1880.",
        status: "established",
        evidenceStatus: "supported",
        sources: [
          {
            title: "Hans Renold — Wikipedia",
            url: "https://en.wikipedia.org/wiki/Hans_Renold",
            retrievedAt: new Date().toISOString(),
            excerpt: "In 1880, he patented the bush roller chain.",
          },
        ],
      },
      {
        id: "c2",
        text: "The roller chain achieved over 98 percent power transmission efficiency.",
        status: "established",
        evidenceStatus: "supported",
        sources: [],
      },
    ],
  };

  it("passes validation for a fully consistent card", () => {
    const integrity = validateRootsCardIntegrity(sampleCard);
    assert.equal(integrity.isValid, true);
    assert.equal(integrity.errors.length, 0);
  });

  it("fails validation when root cites non-existent claim ID", () => {
    const invalidCard = {
      ...sampleCard,
      root: {
        ...sampleCard.root,
        claimIds: ["c_non_existent"],
      },
    };
    const integrity = validateRootsCardIntegrity(invalidCard);
    assert.equal(integrity.isValid, false);
    assert.ok(integrity.errors.some((e) => e.includes("non-existent claim ID")));
  });

  it("fails validation when component cites non-existent claim ID", () => {
    const invalidCard = {
      ...sampleCard,
      components: [
        {
          ...sampleCard.components[0],
          claimIds: ["c_ghost"],
        },
        ...sampleCard.components.slice(1),
      ],
    };
    const integrity = validateRootsCardIntegrity(invalidCard);
    assert.equal(integrity.isValid, false);
    assert.ok(integrity.errors.some((e) => e.includes("references non-existent claim ID")));
  });

  it("fails validation when input required clarification", () => {
    const clarificationCard = {
      ...sampleCard,
      needsClarification: "Image is blurry or ambiguous",
    };
    const integrity = validateRootsCardIntegrity(clarificationCard);
    assert.equal(integrity.isValid, false);
    assert.ok(integrity.errors.some((e) => e.includes("requires clarification")));
  });

  it("Zod schema rejects cards with fewer than 3 components", () => {
    const badCard = {
      ...sampleCard,
      components: sampleCard.components.slice(0, 2),
    };
    const res = RootsCardSchema.safeParse(badCard);
    assert.equal(res.success, false);
  });
});
