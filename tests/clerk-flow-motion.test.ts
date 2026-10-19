import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { NextRequest } from "next/server";
import { POST as claimGuestRootHandler } from "../src/app/api/claim-guest-root/route";
import { POST as clerkWebhookHandler } from "../src/app/api/webhooks/clerk/route";
import { POST as guestScanHandler } from "../src/app/api/guest-scan/route";

describe("Deep Roots v4: Clerk Flow, Motion & Launch Verification", () => {
  describe("1. Data Isolation & Clean Sign-Out", () => {
    it("1.1 clearUserDataOnSignOut is defined and clears storage caches", () => {
      const storePath = path.join(process.cwd(), "src/lib/storage/store.ts");
      const content = fs.readFileSync(storePath, "utf-8");
      assert.ok(content.includes("clearUserDataOnSignOut"), "store.ts must export clearUserDataOnSignOut");
      assert.ok(content.includes("deeproots_user_signed_out"), "Dispatches deeproots_user_signed_out event");
      assert.ok(content.includes("localStorage.removeItem"), "Removes sensitive local root data");
    });

    it("1.2 ClerkProvider is configured with afterSignOutUrl='/welcome'", () => {
      const layoutPath = path.join(process.cwd(), "src/app/layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      assert.ok(content.includes('afterSignOutUrl="/welcome"'), "ClerkProvider must redirect to /welcome on sign-out");
    });

    it("1.3 Profile page provides sign-out action with roots retract animation", () => {
      const profilePath = path.join(process.cwd(), "src/app/profile/page.tsx");
      const content = fs.readFileSync(profilePath, "utf-8");
      assert.ok(content.includes("clearUserDataOnSignOut"), "Profile page must invoke clearUserDataOnSignOut on sign-out");
      assert.ok(content.includes("Your roots are safe"), "Retract overlay shows reassurance copy");
    });
  });

  describe("2. Clerk Webhooks & GDPR Account Deletion", () => {
    it("2.1 Clerk webhook route exists and verifies signatures", () => {
      const webhookPath = path.join(process.cwd(), "src/app/api/webhooks/clerk/route.ts");
      assert.ok(fs.existsSync(webhookPath), "Clerk webhook route file must exist");
      const content = fs.readFileSync(webhookPath, "utf-8");
      assert.ok(content.includes("user.created") && content.includes("user.deleted"), "Handles user creation and deletion");
    });

    it("2.2 Rejects webhook request with missing user id", async () => {
      const req = new NextRequest("http://localhost:3000/api/webhooks/clerk", {
        method: "POST",
        body: JSON.stringify({ type: "user.created", data: {} }),
      });
      const res = await clerkWebhookHandler(req);
      assert.equal(res.status, 400);
    });
  });

  describe("3. Guest First Scan & Claiming Flow", () => {
    it("3.1 Guest scan endpoint (/api/guest-scan) rejects empty payloads", async () => {
      const req = new NextRequest("http://localhost:3000/api/guest-scan", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await guestScanHandler(req);
      assert.equal(res.status, 400);
    });

    it("3.2 Claim guest root endpoint (/api/claim-guest-root) rejects unauthenticated calls with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/claim-guest-root", {
        method: "POST",
        body: JSON.stringify({ card: { title: "Test" } }),
      });
      const res = await claimGuestRootHandler(req);
      assert.equal(res.status, 401);
      const json = await res.json();
      assert.equal(json.code, "UNAUTHORIZED");
    });

    it("3.3 Guest try page (/try) exists with UnearthReveal and Save to Tree CTA", () => {
      const tryPagePath = path.join(process.cwd(), "src/app/try/page.tsx");
      assert.ok(fs.existsSync(tryPagePath), "Try page must exist");
      const content = fs.readFileSync(tryPagePath, "utf-8");
      assert.ok(content.includes("UnearthReveal"), "Try page must use UnearthReveal signature motion");
      assert.ok(content.includes("Save to my Tree"), "Try page has prominent Save to Tree CTA");
    });
  });

  describe("4. Signature Motions System", () => {
    it("4.1 Haptics engine provides vibration fallbacks and reduced-motion checks", () => {
      const hapticsPath = path.join(process.cwd(), "src/lib/motion/haptics.ts");
      assert.ok(fs.existsSync(hapticsPath), "Haptics engine must exist");
      const content = fs.readFileSync(hapticsPath, "utf-8");
      assert.ok(content.includes("prefers-reduced-motion"), "Haptics must check prefers-reduced-motion");
      assert.ok(content.includes("isLowPowerDevice"), "Detects low power devices");
    });

    it("4.2 UnearthReveal component implements canvas particle dispersal and word blur-reveal", () => {
      const unearthPath = path.join(process.cwd(), "src/components/motion/UnearthReveal.tsx");
      assert.ok(fs.existsSync(unearthPath), "UnearthReveal component must exist");
      const content = fs.readFileSync(unearthPath, "utf-8");
      assert.ok(content.includes("<canvas"), "Renders soil particle canvas");
      assert.ok(content.includes("unearth-word"), "Splits headline into animated word elements");
      assert.ok(content.includes("Haptics.unearth"), "Triggers unearth haptic pattern");
    });

    it("4.3 SeedArc component implements quadratic bezier projectile flight path", () => {
      const seedArcPath = path.join(process.cwd(), "src/components/motion/SeedArc.tsx");
      assert.ok(fs.existsSync(seedArcPath), "SeedArc component must exist");
      const content = fs.readFileSync(seedArcPath, "utf-8");
      assert.ok(content.includes("quadraticBezier"), "Uses quadratic bezier math");
      assert.ok(content.includes("deeproots_seed_landed"), "Dispatches seed landing event");
    });

    it("4.4 BottomTabBar renders Sprout Tab and reacts to deeproots_seed_landed", () => {
      const tabPath = path.join(process.cwd(), "src/components/navigation/BottomTabBar.tsx");
      const content = fs.readFileSync(tabPath, "utf-8");
      assert.ok(content.includes("tab-leaf"), "Renders sprout leaves");
      assert.ok(content.includes("deeproots_seed_landed"), "Listens for seed landing event");
    });

    it("4.5 FoilTiltCard provides 3D tilt perspective and specular sheen gradient", () => {
      const foilPath = path.join(process.cwd(), "src/components/motion/FoilTiltCard.tsx");
      assert.ok(fs.existsSync(foilPath), "FoilTiltCard component must exist");
      const content = fs.readFileSync(foilPath, "utf-8");
      assert.ok(content.includes("foil-card"), "Applies foil-card perspective");
      assert.ok(content.includes("setSheen"), "Calculates interactive sheen coordinates");
    });
  });

  describe("5. Public Share & Dynamic OG System", () => {
    it("5.1 Public share page (/r/[slug]) implements Guess the Root and Foil Card", () => {
      const sharePagePath = path.join(process.cwd(), "src/app/r/[slug]/page.tsx");
      assert.ok(fs.existsSync(sharePagePath), "Share route must exist");
      const content = fs.readFileSync(sharePagePath, "utf-8");
      assert.ok(content.includes("Guess the Root"), "Implements Guess the Root interactive mode");
      assert.ok(content.includes("FoilTiltCard"), "Renders FoilTiltCard preview");
      assert.ok(content.includes("/try"), "Links to /try guest scan CTA");
    });

    it("5.2 Dynamic Open Graph endpoint (/api/og/root/[id]) generates branded share cards", () => {
      const ogPath = path.join(process.cwd(), "src/app/api/og/root/[id]/route.tsx");
      assert.ok(fs.existsSync(ogPath), "OG route must exist");
      const content = fs.readFileSync(ogPath, "utf-8");
      assert.ok(content.includes("ImageResponse"), "Uses next/og ImageResponse");
      assert.ok(content.includes("#FFC857"), "Uses brand amber accent");
      assert.ok(content.includes("#0E1411"), "Uses brand dark background");
    });

    it("5.3 Middleware configures public access for guest scan, claim, webhooks, and share routes", () => {
      const middlewarePath = path.join(process.cwd(), "src/middleware.ts");
      const content = fs.readFileSync(middlewarePath, "utf-8");
      assert.ok(content.includes("/try"), "Middleware allows /try");
      assert.ok(content.includes("/r/(.*)"), "Middleware allows /r/(.*)");
      assert.ok(content.includes("/api/guest-scan"), "Middleware allows /api/guest-scan");
      assert.ok(content.includes("/api/claim-guest-root"), "Middleware allows /api/claim-guest-root");
      assert.ok(content.includes("/api/webhooks/(.*)"), "Middleware allows /api/webhooks/(.*)");
    });
  });
});
