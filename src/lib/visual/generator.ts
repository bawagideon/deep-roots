import { RootsCard } from "@/types/roots";
import { VisualSpec, VisualPart, VisualLink } from "@/types/visual";
import { validateVisualSpec } from "./integrity";

/**
 * Universal instant local fallback.
 * Generates a validated Constellation VisualSpec directly from the card facts.
 * Guaranteed to succeed without any network or AI calls.
 */
export function buildConstellationSpec(card: RootsCard): VisualSpec {
  const components = card.components || [];

  const parts: VisualPart[] = components.slice(0, 6).map((comp, idx) => ({
    id: `part-${idx}`,
    componentIndex: idx,
    label: comp.name.split(/\s+/).slice(0, 3).join(" "),
    lens: comp.lens || card.lenses?.[idx % card.lenses.length] || "tech",
    order: idx,
  }));

  const links: VisualLink[] = parts.map((p) => ({
    from: "root",
    to: p.id,
    kind: "contains",
  }));

  const spec: VisualSpec = {
    version: 1,
    archetype: "constellation",
    subject: card.title,
    alt: `Constellation view of ${card.title} showing its core components around the Root.`,
    parts,
    links,
    motion: {
      preset: "float",
      intensity: 1,
    },
    status: "ready",
  };

  return spec;
}

/**
 * Generates a Flow VisualSpec for processes, systems, and supply chains.
 */
export function buildFlowSpec(card: RootsCard): VisualSpec {
  const components = card.components || [];
  const parts: VisualPart[] = [];
  const links: VisualLink[] = [];

  // Arrange in flow grid
  const positions: [number, number][] = [
    [16, 28],
    [16, 72],
    [48, 48],
    [48, 84],
    [80, 50],
  ];

  components.slice(0, 4).forEach((comp, idx) => {
    const id = `flow-${idx}`;
    parts.push({
      id,
      componentIndex: idx,
      label: comp.name.split(/\s+/).slice(0, 3).join(" "),
      lens: comp.lens || "tech",
      order: idx,
      pos: positions[idx] || [30 + idx * 15, 40],
    });

    if (idx > 0) {
      links.push({
        from: `flow-${idx - 1}`,
        to: id,
        kind: idx % 2 === 0 ? "becomes" : "flows",
      });
    }
  });

  if (parts.length > 0) {
    links.push({
      from: parts[parts.length - 1].id,
      to: "root",
      kind: "becomes",
    });
  }

  const spec: VisualSpec = {
    version: 1,
    archetype: "flow",
    subject: card.title,
    alt: `Flow diagram of ${card.title} showing how its stages connect into the final discovery.`,
    parts,
    rootNode: {
      label: card.title.split(/\s+/).slice(0, 3).join(" "),
      pos: [84, 52],
    },
    links,
    motion: {
      preset: "pathflow",
      intensity: 2,
    },
    status: "ready",
  };

  const check = validateVisualSpec(spec, card);
  return check.ok ? spec : buildConstellationSpec(card);
}

/**
 * Builds VisualSpec for a card.
 * Lane 2: Returns constellation immediately or generates archetype based on input.
 */
export async function getCardVisualSpec(
  card: RootsCard,
  options?: { preferredArchetype?: "constellation" | "flow" | "explode" }
): Promise<VisualSpec> {
  const preferred = options?.preferredArchetype;

  if (preferred === "flow" || card.layers?.some((l) => l.name.toLowerCase().includes("process") || l.name.toLowerCase().includes("supply"))) {
    return buildFlowSpec(card);
  }

  return buildConstellationSpec(card);
}
