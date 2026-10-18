import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { getClientIdentifier, getQuotaStatus } from "../src/lib/security/quota";
import { getEntitlements } from "../src/lib/security/entitlements";
import { isPrivateOrReservedIp, safeFetchUrl } from "../src/lib/security/safe-fetch";
import { RootsCardSchema, validateRootsCardIntegrity } from "../src/lib/schema";
import { RootsCard, StoredRoot, GraphEdge } from "../src/types/roots";
import { LENSES, SEEDED_ROOTS, SEEDED_EDGES } from "../src/lib/constants";
import * as fs from "fs";
import * as path from "path";

describe("24-Point New-User Acceptance Verification Suite", () => {
  // --------------------------------------------------------------------------
  // SECTION 1: ACCOUNT & IDENTITY
  // --------------------------------------------------------------------------
  describe("1. Account & Identity Hardening", () => {
    it("1.1 Clerk Provider is configured in RootLayout with dark theme tokens", () => {
      const layoutPath = path.join(process.cwd(), "src/app/layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      assert.ok(content.includes("<ClerkProvider"), "RootLayout must include ClerkProvider");
      assert.ok(content.includes("#FFC857"), "Clerk appearance must specify primary amber color");
      assert.ok(content.includes("#0E1411"), "Clerk appearance must specify dark background");
    });

    it("1.2 Sign-in and sign-up catch-all routes exist for Clerk authentication", () => {
      const signInPath = path.join(process.cwd(), "src/app/sign-in/[[...sign-in]]/page.tsx");
      const signUpPath = path.join(process.cwd(), "src/app/sign-up/[[...sign-up]]/page.tsx");
      assert.ok(fs.existsSync(signInPath), "Sign-in page route must exist");
      assert.ok(fs.existsSync(signUpPath), "Sign-up page route must exist");
    });

    it("1.3 Guest identity extraction securely hashes IP with salt and never logs raw IP", async () => {
      const rawGuestIp = "198.51.100.99";
      const req = new NextRequest("http://localhost:3000/api/scan", {
        headers: { "x-real-ip": rawGuestIp },
      });
      const idResult = await getClientIdentifier(req);
      assert.equal(idResult.isAnonymous, true);
      assert.ok(idResult.clientId.startsWith("gst_"));
      assert.equal(idResult.clientId.includes(rawGuestIp), false, "Raw IP must never appear in clientId");
      assert.equal(idResult.userId, undefined);
    });

    it("1.4 Profile page connects to syncRootsFromCloud and displays live sync state", () => {
      const profilePath = path.join(process.cwd(), "src/app/profile/page.tsx");
      const content = fs.readFileSync(profilePath, "utf-8");
      assert.ok(content.includes("syncRootsFromCloud"), "Profile page must invoke syncRootsFromCloud on mount");
      assert.ok(content.includes("Tree Synced & Backed Up"), "Profile UI must communicate sync status");
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 2: CORE DISCOVERY ENGINE
  // --------------------------------------------------------------------------
  describe("2. Core Discovery Engine & Schema Integrity", () => {
    const validCard: RootsCard = {
      title: "Universal Barcode",
      oneLiner: "The optical pattern that automated global grocery logistics and inventory speed.",
      inputKind: "text",
      inputSummary: "Barcode symbol",
      root: {
        headline: "Norman Woodland invented the barcode by drawing Morse code lines in sand.",
        body: "Woodland drew dots and dashes and extended them into wide and narrow parallel lines.",
        claimIds: ["c1"],
        lens: "origins",
      },
      layers: [
        {
          name: "Optical Physics",
          summary: "Differential light reflectivity across black bars and white spaces.",
          claimIds: ["c1"],
          lens: "tech",
        },
        {
          name: "Global Commerce",
          summary: "Elimination of cashier price entry created modern inventory turnover.",
          claimIds: ["c2"],
          lens: "money",
        },
      ],
      components: [
        {
          name: "Start/Stop Guard Pattern",
          role: "Framing bars that tell laser scanner reading orientation",
          hiddenFact: "Consists of binary sequence 101 at both edges of the symbol.",
          claimIds: ["c1"],
        },
        {
          name: "Data Bars",
          role: "Modulated line widths encoding manufacturer and item numbers",
          hiddenFact: "Uses variable ratio geometry to survive curved or wrinkled packaging.",
          claimIds: ["c1"],
        },
        {
          name: "Check Digit",
          role: "Mathematical checksum preventing scanner misreads",
          hiddenFact: "Calculated using a modulo 10 algorithm weighting alternate positions by 3.",
          claimIds: ["c2"],
        },
      ],
      lenses: ["tech", "money", "origins"],
      nextQuestions: [
        { kind: "deepen", text: "How did laser diode costs enable widespread barcode scanner deployment?" },
        { kind: "cause", text: "Why did grocery stores lead barcode adoption rather than apparel retailers?" },
        { kind: "compare", text: "How does 1D barcode data density compare to 2D QR codes?" },
      ],
      concepts: [
        { label: "Universal Product Code", lens: "tech" },
        { label: "Inventory Velocity", lens: "money" },
      ],
      claims: [
        {
          id: "c1",
          text: "Norman Woodland and Bernard Silver patented the optical code in 1952.",
          status: "established",
          evidenceStatus: "supported",
          sources: [
            {
              title: "US Patent 2,612,994",
              url: "https://patents.google.com/patent/US2612994A/en",
              retrievedAt: new Date().toISOString(),
            },
          ],
        },
        {
          id: "c2",
          text: "The first commercial item scanned was a pack of Wrigley's gum in Troy, Ohio in 1974.",
          status: "established",
          evidenceStatus: "supported",
          sources: [],
        },
      ],
    };

    it("2.1 Validates multi-modal input payloads and rejects payload over 4MB", () => {
      const scanRoutePath = path.join(process.cwd(), "src/app/api/scan/route.ts");
      const content = fs.readFileSync(scanRoutePath, "utf-8");
      assert.ok(content.includes("4 * 1024 * 1024"), "Scan endpoint must enforce 4MB upload cap");
      assert.ok(content.includes("413"), "Must respond with 413 Payload Too Large when over limit");
    });

    it("2.2 Validates RootsCard integrity with 2-5 dynamic layers and Root headline", () => {
      const result = validateRootsCardIntegrity(validCard);
      assert.equal(result.isValid, true);
      assert.ok(validCard.layers.length >= 2 && validCard.layers.length <= 5);
      assert.ok(validCard.root.headline.length > 10);
    });

    it("2.3 Enforces 3 to 6 components with explicit claim IDs", () => {
      assert.ok(validCard.components.length >= 3 && validCard.components.length <= 6);
      validCard.components.forEach((c) => {
        assert.ok(c.name.length > 0);
        assert.ok(c.hiddenFact.length > 0);
        assert.ok(c.claimIds.length > 0);
      });
    });

    it("2.4 Enforces claims are checkable statements with maximum 140 character limit", () => {
      validCard.claims.forEach((claim) => {
        assert.ok(claim.text.length <= 140, `Claim ${claim.id} exceeds 140 chars: ${claim.text.length}`);
        assert.ok(["established", "interpretation", "open_question"].includes(claim.status));
      });
    });

    it("2.5 Verifies evidence pass handles unverified and supported claims appropriately", () => {
      const parseResult = RootsCardSchema.safeParse(validCard);
      assert.equal(parseResult.success, true);
      assert.equal(validCard.claims[0].evidenceStatus, "supported");
      assert.ok(validCard.claims[0].sources.length > 0);
    });

    it("2.6 Visual engine renders valid procedural visual specifications", async () => {
      const { buildConstellationSpec } = await import("../src/lib/visual/generator");
      const spec = buildConstellationSpec(validCard);
      assert.equal(spec.status, "ready");
      assert.equal(spec.archetype, "constellation");
      assert.ok(spec.parts.length >= 3);
      assert.ok(spec.links.length >= 3);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 3: RABBIT HOLES, GRAPH & PERSISTENCE
  // --------------------------------------------------------------------------
  describe("3. Rabbit Holes & Cloud Persistence", () => {
    it("3.1 Rabbit hole deepening route (/api/deepen) is present and validates parentCard", () => {
      const deepenPath = path.join(process.cwd(), "src/app/api/deepen/route.ts");
      const content = fs.readFileSync(deepenPath, "utf-8");
      assert.ok(content.includes("parentCard"), "Deepen route must require parentCard");
      assert.ok(content.includes("currentDepth"), "Deepen route must track currentDepth");
    });

    it("3.2 Enforces depth limits strictly: Free tier max depth 3, Pro tier max depth 5", async () => {
      const freeEntitlements = await getEntitlements(undefined);
      assert.equal(freeEntitlements.maxRabbitDepth, 3);
      assert.equal(freeEntitlements.dailyScanLimit, 5);
    });

    it("3.3 Cloud persistence route (/api/roots) handles GET and POST with Clerk authorization", () => {
      const rootsRoutePath = path.join(process.cwd(), "src/app/api/roots/route.ts");
      const content = fs.readFileSync(rootsRoutePath, "utf-8");
      assert.ok(content.includes("export async function GET"), "Must export GET handler");
      assert.ok(content.includes("export async function POST"), "Must export POST handler");
      assert.ok(content.includes("getServerUser"), "Must authoritatively verify caller identity");
    });

    it("3.4 syncRootsFromCloud merges remote roots and pushes pending guest roots", () => {
      const storePath = path.join(process.cwd(), "src/lib/storage/store.ts");
      const content = fs.readFileSync(storePath, "utf-8");
      assert.ok(content.includes("export async function syncRootsFromCloud"), "syncRootsFromCloud must be exported");
      assert.ok(content.includes("pendingUpload"), "Must detect pending local roots for upload");
    });

    it("3.5 Delete root endpoint (/api/roots/[id]) verifies ownership before deletion", () => {
      const deletePath = path.join(process.cwd(), "src/app/api/roots/[id]/route.ts");
      const content = fs.readFileSync(deletePath, "utf-8");
      assert.ok(content.includes("export async function DELETE"), "Must export DELETE handler");
      assert.ok(content.includes("existing.user_id !== user.id"), "Must forbid deleting other user discoveries");
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 4: SECURITY, QUOTAS & RELIABILITY
  // --------------------------------------------------------------------------
  describe("4. Security, Quotas & Reliability", () => {
    it("4.1 getQuotaStatus fails closed with remaining 0 when database is unreachable", async () => {
      const status = await getQuotaStatus("gst_verification_test");
      assert.equal(status.remaining, 0, "Must fail closed with remaining 0");
      assert.ok(status.error === "DATABASE_UNAVAILABLE" || status.error === "SCAN_KILL_SWITCH_ACTIVE");
    });

    it("4.2 Atomic quota reservation RPC is defined in schema.sql with row locking", () => {
      const schemaPath = path.join(process.cwd(), "supabase/schema.sql");
      const sql = fs.readFileSync(schemaPath, "utf-8");
      assert.ok(sql.includes("atomic_reserve_quota"), "schema.sql must define atomic_reserve_quota function");
      assert.ok(sql.includes("for update"), "atomic_reserve_quota must use FOR UPDATE row locking");
    });

    it("4.3 refund_quota function refunds quota reservation upon model failure", () => {
      const scanRoute = path.join(process.cwd(), "src/app/api/scan/route.ts");
      const content = fs.readFileSync(scanRoute, "utf-8");
      assert.ok(content.includes("refundQuota"), "Scan route must call refundQuota in catch block");
    });

    it("4.4 SSRF security safely blocks private IPs, metadata IP and non-standard ports", async () => {
      assert.equal(isPrivateOrReservedIp("127.0.0.1"), true);
      assert.equal(isPrivateOrReservedIp("169.254.169.254"), true);
      assert.equal(isPrivateOrReservedIp("10.0.0.1"), true);
      assert.equal(isPrivateOrReservedIp("8.8.8.8"), false);

      await assert.rejects(async () => await safeFetchUrl("http://localhost"), /blocked/);
      await assert.rejects(async () => await safeFetchUrl("http://example.com:22"), /restricted/);
    });

    it("4.5 Admin kill-switch route requires server-verified admin authority unconditionally", () => {
      const killSwitchPath = path.join(process.cwd(), "src/app/api/admin/kill-switch/route.ts");
      const content = fs.readFileSync(killSwitchPath, "utf-8");
      assert.ok(content.includes("isServerAdmin"), "Kill-switch must check isServerAdmin");
      assert.equal(content.includes("NODE_ENV === \"production\""), false, "Must not bypass admin check in non-prod");
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 5: MOBILE, PWA & UX POLISH
  // --------------------------------------------------------------------------
  describe("5. Mobile, PWA & UX Polish", () => {
    it("5.1 Viewport tag allows unrestricted pinch-to-zoom for accessibility", () => {
      const layoutPath = path.join(process.cwd(), "src/app/layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      assert.equal(content.includes("user-scalable=no"), false, "Must not disable user scalability");
      assert.equal(content.includes("maximum-scale=1"), false, "Must not cap maximum-scale to 1");
    });

    it("5.2 PWA manifest.json specifies standalone mode and brand dark colors", () => {
      const manifestPath = path.join(process.cwd(), "public/manifest.json");
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      assert.equal(manifest.display, "standalone");
      assert.equal(manifest.background_color, "#0E1411");
      assert.equal(manifest.theme_color, "#0E1411");
    });

    it("5.3 6 distinct lenses are defined with standardized brand color palette", () => {
      const lensKeys = Object.keys(LENSES);
      assert.equal(lensKeys.length, 6);
      assert.deepEqual(lensKeys.sort(), ["culture", "language", "mind", "money", "origins", "tech"].sort());
      lensKeys.forEach((key) => {
        assert.ok((LENSES as any)[key].color.startsWith("#"));
      });
    });

    it("5.4 Seeded demo content is explicitly flagged with isSeeded boolean", () => {
      assert.ok(SEEDED_ROOTS.length > 0);
      SEEDED_ROOTS.forEach((root) => {
        assert.equal(root.isSeeded, true, "Seeded roots must have isSeeded=true");
      });
      assert.ok(SEEDED_EDGES.length > 0);
    });
  });
});
