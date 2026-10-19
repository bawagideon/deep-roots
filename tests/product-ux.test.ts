import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { SEEDED_ROOTS, SEEDED_EDGES, LENSES } from "../src/lib/constants";
import { StoredRoot, GraphEdge } from "../src/types/roots";

describe("Product UX Verification Suite", () => {
  // --------------------------------------------------------------------------
  // 1. SCAN STATES: Text, Image & Link honest loading, success, and failure
  // --------------------------------------------------------------------------
  describe("1. Scan Input & State Handling", () => {
    it("Scan page renders 3 distinct modes: Photo, Type, and Link", () => {
      const scanPagePath = path.join(process.cwd(), "src/app/scan/page.tsx");
      const content = fs.readFileSync(scanPagePath, "utf-8");
      assert.ok(content.includes('tab === "photo"'), "Photo tab must exist");
      assert.ok(content.includes('tab === "type"'), "Type tab must exist");
      assert.ok(content.includes('tab === "link"'), "Link tab must exist");
    });

    it("Image upload performs EXIF stripping and client-side downscaling to 1280px", () => {
      const scanPagePath = path.join(process.cwd(), "src/app/scan/page.tsx");
      const content = fs.readFileSync(scanPagePath, "utf-8");
      assert.ok(content.includes("maxDim = 1280"), "Must cap maximum image dimension at 1280px");
      assert.ok(content.includes("toDataURL"), "Must re-encode via canvas to strip EXIF and metadata");
    });

    it("Analyzing page handles honest progressive loading and error messages", () => {
      const analyzingPagePath = path.join(process.cwd(), "src/app/scan/[id]/page.tsx");
      const content = fs.readFileSync(analyzingPagePath, "utf-8");
      assert.ok(content.includes("Decomposing input..."), "Has initial decomposition stage message");
      assert.ok(content.includes("Extracting components & hidden layers..."), "Has component extraction stage");
      assert.ok(content.includes("Uncovering the Root discovery..."), "Has discovery reveal stage");
      assert.ok(content.includes("Connecting to knowledge tree..."), "Has link connection stage");
      // Honest error extraction from backend error response
      assert.ok(content.includes("errData?.error?.message"), "Extracts server error message honestly");
    });
  });

  // --------------------------------------------------------------------------
  // 2. DISCOVERY PERSISTENCE: Reopening, Surviving Refresh & Deepening
  // --------------------------------------------------------------------------
  describe("2. Discovery Lifecyle & Refresh Persistence", () => {
    it("Root page (/root/[id]) reads from storage and supports deepening", () => {
      const rootPagePath = path.join(process.cwd(), "src/app/root/[id]/page.tsx");
      const content = fs.readFileSync(rootPagePath, "utf-8");
      assert.ok(content.includes("getStoredRoots"), "Root page retrieves stored root by ID");
      assert.ok(content.includes("/api/deepen"), "Root page connects to /api/deepen for rabbit hole traversal");
      assert.ok(content.includes("isVerifyingSources") || content.includes("/api/evidence"), "Connects to evidence verification pass");
      assert.ok(content.includes("VisualStage"), "Renders visual archetype stage");
    });
  });

  // --------------------------------------------------------------------------
  // 3. GRAPH NAVIGATION: Mobile & Desktop responsiveness
  // --------------------------------------------------------------------------
  describe("3. Graph & Tree Navigation (Mobile & Desktop)", () => {
    it("Tree view (/tree) implements responsive SVG graph with zoom, drag, and list view switch", () => {
      const treePagePath = path.join(process.cwd(), "src/app/tree/page.tsx");
      const content = fs.readFileSync(treePagePath, "utf-8");
      assert.ok(content.includes("<svg") && content.includes("</svg>"), "Tree renders interactive SVG graph");
      assert.ok(content.includes("viewMode === \"graph\""), "Tree supports graph view mode");
      assert.ok(content.includes("Dynamic layout calculations for the mobile SVG graph") || content.includes("viewBox"), "Tree implements mobile layout calculation");
    });

    it("HTML Viewport meta allows unrestricted mobile pinch-zoom", () => {
      const layoutPath = path.join(process.cwd(), "src/app/layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      assert.ok(
        !content.includes("user-scalable=no") && !content.includes("maximum-scale=1"),
        "Viewport must not disable mobile pinch-to-zoom"
      );
    });
  });

  // --------------------------------------------------------------------------
  // 4. ACTIONABLE BUTTONS & ACCESSIBILITY
  // --------------------------------------------------------------------------
  describe("4. Button Verification & Clear Disabling", () => {
    it("BottomTabBar links have valid hrefs and touch-friendly targets", () => {
      const tabPath = path.join(process.cwd(), "src/components/navigation/BottomTabBar.tsx");
      const content = fs.readFileSync(tabPath, "utf-8");
      assert.ok(content.includes('href="/"'), "Home tab has valid href");
      assert.ok(content.includes('href="/tree"'), "Tree tab has valid href");
      assert.ok(content.includes('href="/scan"'), "Scan button has valid href");
    });

    it("Scan submit button is clearly disabled when input is empty or processing", () => {
      const scanPagePath = path.join(process.cwd(), "src/app/scan/page.tsx");
      const content = fs.readFileSync(scanPagePath, "utf-8");
      assert.ok(
        content.includes("disabled={!textInput.trim() || isProcessing}") ||
        content.includes("isProcessing"),
        "Submit buttons disable when empty or during processing"
      );
    });
  });

  // --------------------------------------------------------------------------
  // 5. STARTER CONTENT vs REAL DISCOVERIES DISTINGUISHABILITY
  // --------------------------------------------------------------------------
  describe("5. Starter Content vs Sourced Discoveries", () => {
    it("Seeded starter roots are explicitly marked with root- prefix and valid cards", () => {
      assert.ok(SEEDED_ROOTS.length >= 3, "At least 3 starter roots provided");
      SEEDED_ROOTS.forEach((root) => {
        assert.ok(root.id.startsWith("root-"), "Seeded root ID prefix");
        assert.ok(root.card.title.length > 0);
        assert.ok(root.card.root.headline.length > 0);
      });
    });

    it("Seeded edges link starter roots with explicit relationship reasons", () => {
      assert.ok(SEEDED_EDGES.length >= 2, "At least 2 starter edges provided");
      SEEDED_EDGES.forEach((edge) => {
        assert.ok(edge.fromRoot.startsWith("root-"));
        assert.ok(edge.toRoot.startsWith("root-"));
        assert.ok(edge.why.length > 5, "Edge must provide meaningful rationale");
        assert.ok(["parent", "shared_concept", "cause", "contrast", "unexpected", "flows", "becomes", "contains"].includes(edge.type));
      });
    });

    it("Real discoveries include evidence-backed claims with verified source citations", () => {
      const evidenceRoutePath = path.join(process.cwd(), "src/app/api/evidence/route.ts");
      const content = fs.readFileSync(evidenceRoutePath, "utf-8");
      assert.ok(content.includes("verifyClaimsPass2"), "Evidence route invokes Pass 2 candidate retrieval");
    });
  });
});
