import { z } from "zod";
import { Lens, RootsCard } from "@/types/roots";

export const LensEnum = z.enum([
  "language",
  "culture",
  "mind",
  "money",
  "tech",
  "origins",
]);

export const ClaimStatusEnum = z.enum([
  "established",
  "interpretation",
  "open_question",
]);

export const EvidenceStatusEnum = z.enum([
  "supported",
  "contradicted",
  "insufficient",
  "unverified",
]);

export const ClaimSourceSchema = z.object({
  title: z.string().min(2).max(200),
  url: z.string().url(),
  retrievedAt: z.string(),
  excerpt: z.string().optional(),
});

export const ClaimSchema = z.object({
  id: z.string(),
  text: z.string().min(5).max(200, "Claim text must be checkable and concise"),
  status: ClaimStatusEnum,
  evidenceStatus: EvidenceStatusEnum.optional(),
  sources: z.array(ClaimSourceSchema).default([]),
});

export const CardLayerSchema = z.object({
  name: z.string().min(2).max(80),
  lens: LensEnum.nullable().optional().transform((v) => v ?? undefined),
  summary: z.string().min(5).max(350),
  claimIds: z.array(z.string()).default([]),
});

export const CardComponentSchema = z.object({
  name: z.string().min(2).max(80),
  role: z.string().min(3).max(200),
  hiddenFact: z.string().min(5).max(350),
  claimIds: z.array(z.string()).default([]),
  layer: z.string().nullable().optional().transform((v) => v ?? undefined),
  lens: LensEnum.nullable().optional().transform((v) => v ?? undefined),
});

export const NextQuestionSchema = z.object({
  text: z.string().min(5).max(220),
  kind: z.enum(["deepen", "cause", "compare", "contradiction"]),
  targetComponent: z.string().nullable().optional().transform((v) => v ?? undefined),
});

export const CardConceptSchema = z.object({
  label: z.string().min(2).max(80),
  lens: LensEnum.nullable().optional().transform((v) => v ?? undefined),
});

export const RootsCardSchema = z.object({
  title: z.string().min(2).max(90),
  oneLiner: z.string().min(5).max(220),
  inputKind: z.enum(["photo", "screenshot", "text", "question", "link"]),
  inputSummary: z.string().min(3).max(250),
  needsClarification: z.string().nullable().optional().transform((v) => v ?? undefined),
  root: z.object({
    headline: z.string().min(5).max(220),
    body: z.string().min(10).max(600),
    claimIds: z.array(z.string()).min(1, "The Root must cite at least one claim ID"),
    lens: LensEnum.nullable().optional().transform((v) => v ?? undefined),
  }),
  layers: z.array(CardLayerSchema).min(2, "Must identify at least 2 layers").max(5, "Maximum 5 layers"),
  components: z.array(CardComponentSchema).min(3, "Must have at least 3 components").max(6, "Maximum 6 components"),
  lenses: z.array(LensEnum).min(1, "Must have at least 1 lens").max(6, "Maximum 6 lenses"),
  nextQuestions: z.array(NextQuestionSchema).length(3, "Must generate exactly 3 next questions"),
  concepts: z.array(CardConceptSchema).min(2).max(8),
  claims: z.array(ClaimSchema).min(1, "Must contain at least 1 claim"),
});

export type ValidatedRootsCard = z.infer<typeof RootsCardSchema>;

/**
 * Validates cross-reference integrity between claims and components/layers/root.
 */
export function validateRootsCardIntegrity(card: RootsCard | ValidatedRootsCard): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const claimMap = new Set(card.claims.map((c) => c.id));

  // 1. Root claim reference check
  if (!card.root.claimIds || card.root.claimIds.length === 0) {
    errors.push("The Root must cite at least one claim ID.");
  } else {
    for (const cid of card.root.claimIds) {
      if (!claimMap.has(cid)) {
        errors.push(`The Root references non-existent claim ID "${cid}".`);
      }
    }
  }

  // 2. Component claim reference check
  card.components.forEach((comp, idx) => {
    for (const cid of comp.claimIds || []) {
      if (!claimMap.has(cid)) {
        errors.push(`Component #${idx + 1} (${comp.name}) references non-existent claim ID "${cid}".`);
      }
    }
  });

  // 3. Layer claim reference check
  card.layers.forEach((layer, idx) => {
    for (const cid of layer.claimIds || []) {
      if (!claimMap.has(cid)) {
        errors.push(`Layer #${idx + 1} (${layer.name}) references non-existent claim ID "${cid}".`);
      }
    }
  });

  // 4. Clarification guardrail
  if (card.needsClarification && card.needsClarification.trim().length > 0) {
    errors.push("Input requires clarification; card should not be saved as factual discovery.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
