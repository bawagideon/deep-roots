import { getStoredRoots, getStoredEdges, getUserStats } from "./storage/store";

export function exportTreeAsJSON(): void {
  if (typeof window === "undefined") return;

  const data = {
    exportDate: new Date().toISOString(),
    version: "1.0",
    stats: getUserStats(),
    roots: getStoredRoots(),
    edges: getStoredEdges(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `deep-roots-export-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportTreeAsMarkdown(): void {
  if (typeof window === "undefined") return;

  const roots = getStoredRoots().filter((r) => !r.isSeeded);
  const edges = getStoredEdges();
  const stats = getUserStats();

  let md = `# Deep Roots - Knowledge Tree Export\n\n`;
  md += `Exported on: ${new Date().toLocaleDateString("en-US", { dateStyle: "full" })}\n\n`;
  md += `## Overview\n`;
  md += `- **Total Roots Explored:** ${roots.length}\n`;
  md += `- **Knowledge Graph Connections:** ${edges.length}\n`;
  md += `- **Current Streak:** ${stats.streak} days\n\n`;
  md += `---\n\n`;

  md += `## Roots & Discoveries\n\n`;
  for (const root of roots) {
    md += `### ${root.title}\n`;
    md += `*Discovered on ${new Date(root.createdAt).toLocaleDateString()} | Depth: ${root.depth} | Lenses: ${root.lenses?.join(", ") || "General"}*\n\n`;
    if (root.card.oneLiner) {
      md += `> ${root.card.oneLiner}\n\n`;
    }
    if (root.card.root) {
      md += `**The Root:** ${root.card.root.headline}\n\n${root.card.root.body}\n\n`;
    }
    if (root.card.components && root.card.components.length > 0) {
      md += `#### Key Components:\n`;
      for (const comp of root.card.components) {
        md += `- **${comp.name}** (${comp.role}): ${comp.hiddenFact}\n`;
      }
      md += `\n`;
    }
    if (root.card.claims && root.card.claims.length > 0) {
      md += `#### Checkable Claims & Sources:\n`;
      for (const claim of root.card.claims) {
        const sourcesText =
          claim.sources && claim.sources.length > 0
            ? claim.sources.map((s) => `[${s.title}](${s.url})`).join(", ")
            : "Direct consensus";
        md += `- [${claim.status.toUpperCase()}] ${claim.text} *(Source: ${sourcesText})*\n`;
      }
      md += `\n`;
    }
    md += `---\n\n`;
  }

  if (edges.length > 0) {
    md += `## Graph Relationships\n\n`;
    for (const edge of edges) {
      const from = roots.find((r) => r.id === edge.fromRoot)?.title || edge.fromRoot;
      const to = roots.find((r) => r.id === edge.toRoot)?.title || edge.toRoot;
      md += `- **${from}** ➔ **${to}** (${edge.type}): ${edge.why}\n`;
      if (edge.limits) {
        md += `  *Boundary/Limits: ${edge.limits}*\n`;
      }
    }
  }

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `deep-roots-tree-${new Date().toISOString().split("T")[0]}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
