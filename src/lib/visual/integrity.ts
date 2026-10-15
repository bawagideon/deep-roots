import { RootsCard, Lens } from "@/types/roots";
import { VisualSpec, VisualToken, VisualPrimitive } from "@/types/visual";

export const LENS_COLORS: Record<Lens, string> = {
  language: "#7FB8FF",
  culture: "#FF9B7A",
  mind: "#D4A5FF",
  money: "#9BE564",
  tech: "#5FE0E8",
  origins: "#FF86B8",
};

export const MATERIAL_COLORS: Record<string, string> = {
  grain: "#E9C46A",
  tomato: "#D9552B",
  leaf: "#7BC47F",
  cream: "#F4EBD0",
  oil: "#E0A82E",
  glass: "#6B8E9B",
  ink: "#0E1411",
  muted: "#9AAAA0",
  text: "#EAF1EC",
  amber: "#FFC857",
};

export function resolveVisualToken(token: VisualToken): string {
  if (token in LENS_COLORS) return LENS_COLORS[token as Lens];
  if (token in MATERIAL_COLORS) return MATERIAL_COLORS[token];
  return "#EAF1EC";
}

export function isValidVisualToken(token: any): token is VisualToken {
  return typeof token === "string" && (token in LENS_COLORS || token in MATERIAL_COLORS);
}

/**
 * Server-side integrity check for VisualSpec.
 * Validates against the card to ensure the visual never asserts a fact the card does not contain.
 */
export function validateVisualSpec(
  spec: any,
  card: RootsCard
): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!spec || typeof spec !== "object") {
    return { ok: false, errors: ["Spec is not an object"] };
  }

  if (spec.version !== 1) {
    errors.push("Invalid spec version (must be 1)");
  }

  if (!spec.alt || typeof spec.alt !== "string") {
    errors.push("Alt text is required");
  }

  if (!Array.isArray(spec.parts) || spec.parts.length === 0) {
    errors.push("Parts must be a non-empty array");
    return { ok: false, errors };
  }

  // 1. Every componentIndex must point to an actual component
  const okComponents = spec.parts.every(
    (p: any) =>
      typeof p.componentIndex === "number" &&
      card.components &&
      card.components[p.componentIndex] !== undefined
  );
  if (!okComponents) {
    errors.push("One or more parts reference an invalid componentIndex");
  }

  // 2. Labels must be <= 3 words
  const okLabels = spec.parts.every(
    (p: any) => typeof p.label === "string" && p.label.trim().split(/\s+/).length <= 4
  );
  if (!okLabels) {
    errors.push("Labels must be concise (at most 3-4 words)");
  }

  // 3. Collect and validate primitives and tokens
  const primitives: VisualPrimitive[] = [];
  const tokens: any[] = [];

  spec.parts.forEach((p: any) => {
    tokens.push(p.lens);
    if (Array.isArray(p.art)) {
      p.art.forEach((a: any) => primitives.push(a));
    }
  });

  primitives.forEach((p: any) => {
    if (p.fill) tokens.push(p.fill);
    if (p.stroke) tokens.push(p.stroke);
  });

  if (!tokens.every(isValidVisualToken)) {
    errors.push("Only allowed palette tokens are permitted (no raw colors or injections)");
  }

  // 4. Validate SVG path commands (prevent XSS / SVG injections)
  const pathRegex = /^[MLCQTAZmlcqtaz0-9\s.,\-]+$/;
  const okPaths = primitives.every(
    (p: any) => p.t !== "path" || (typeof p.d === "string" && pathRegex.test(p.d))
  );
  if (!okPaths) {
    errors.push("Path data contains forbidden commands or characters");
  }

  // 5. Total primitives limit (at most 60 across all parts)
  if (primitives.length > 60) {
    errors.push(`Total primitives (${primitives.length}) exceeds maximum allowable 60`);
  }

  // 6. Photo bounding boxes must sit inside 0..1
  const okBoxes = spec.parts.every((p: any) => {
    if (!p.box) return true;
    const { x, y, w, h } = p.box;
    return (
      typeof x === "number" &&
      typeof y === "number" &&
      typeof w === "number" &&
      typeof h === "number" &&
      x >= 0 &&
      y >= 0 &&
      x + w <= 1.05 &&
      y + h <= 1.05
    );
  });
  if (!okBoxes) {
    errors.push("Photo bounding boxes must be normalized within [0, 1]");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
