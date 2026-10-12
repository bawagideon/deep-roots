import { z } from "zod";

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

export const ClaimSourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  retrievedAt: z.string(),
});

export const ClaimSchema = z.object({
  id: z.string(),
  text: z.string().max(200),
  status: ClaimStatusEnum,
  sources: z.array(ClaimSourceSchema).default([]),
});

export const CardLayerSchema = z.object({
  name: z.string(),
  lens: LensEnum.optional(),
  summary: z.string(),
  claimIds: z.array(z.string()).default([]),
});

export const CardComponentSchema = z.object({
  name: z.string(),
  role: z.string(),
  hiddenFact: z.string(),
  claimIds: z.array(z.string()).default([]),
  layer: z.string().optional(),
  lens: LensEnum.optional(),
});

export const NextQuestionSchema = z.object({
  text: z.string(),
  kind: z.enum(["deepen", "cause", "compare", "contradiction"]),
  targetComponent: z.string().optional(),
});

export const CardConceptSchema = z.object({
  label: z.string(),
  lens: LensEnum.optional(),
});

export const RootsCardSchema = z.object({
  title: z.string(),
  oneLiner: z.string().max(180),
  inputKind: z.enum(["photo", "screenshot", "text", "question", "link"]),
  inputSummary: z.string(),
  needsClarification: z.string().optional(),
  root: z.object({
    headline: z.string(),
    body: z.string(),
    claimIds: z.array(z.string()),
    lens: LensEnum.optional(),
  }),
  layers: z.array(CardLayerSchema).min(2).max(5),
  components: z.array(CardComponentSchema).min(3).max(6),
  lenses: z.array(LensEnum).min(1).max(6),
  nextQuestions: z.array(NextQuestionSchema).min(2).max(4),
  concepts: z.array(CardConceptSchema).min(2).max(6),
  claims: z.array(ClaimSchema).min(1),
});

export type ValidatedRootsCard = z.infer<typeof RootsCardSchema>;
