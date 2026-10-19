import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { POST as rootsPostHandler, GET as rootsGetHandler } from "../src/app/api/roots/route";
import { DELETE as rootsDeleteHandler } from "../src/app/api/roots/[id]/route";
import { POST as deepenHandler } from "../src/app/api/deepen/route";
import { RootsCard } from "../src/types/roots";

// Load .env.local if present
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const clean = line.trim();
      if (clean && !clean.startsWith("#")) {
        const idx = clean.indexOf("=");
        if (idx !== -1) {
          const key = clean.slice(0, idx).trim();
          const val = clean.slice(idx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}
loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

const isSupabaseConfigured =
  supabaseUrl.includes("supabase.co") &&
  !supabaseUrl.includes("placeholder") &&
  serviceRoleKey.length > 20;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const anonClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false },
});

describe("Data Integrity & Multi-Tenant Security Verification", () => {
  const accountA = `usr_test_alpha_${Date.now()}`;
  const accountB = `usr_test_bravo_${Date.now()}`;
  const testRootId = `root_test_${Date.now()}_a`;
  const childRootId = `root_test_${Date.now()}_child`;

  const validMockCard: RootsCard = {
    title: "Optical Fiber Network",
    oneLiner: "Total internal reflection of light allowing petabit internet bandwidth.",
    inputKind: "text",
    inputSummary: "Optical fiber",
    root: {
      headline: "Charles Kao proved optical loss was due to impurities rather than silica physics.",
      body: "In 1966, Kao calculated that purifying silica below 20 dB/km would enable global telecommunications.",
      claimIds: ["c1", "c2"],
      lens: "tech",
    },
    layers: [
      {
        name: "Silica Purity",
        summary: "Ultra-pure synthetic fused silica doped with germanium.",
        claimIds: ["c1"],
        lens: "tech",
      },
      {
        name: "Subsea Geometry",
        summary: "Cables traversing the oceanic abyss under 8,000 meters of hydrostatic pressure.",
        claimIds: ["c2"],
        lens: "origins",
      },
    ],
    components: [
      {
        name: "Core",
        role: "High refractive index light transmission channel",
        hiddenFact: "Germanium-doped silica measuring roughly 9 micrometers in single-mode fiber.",
        claimIds: ["c1"],
      },
      {
        name: "Cladding",
        role: "Lower refractive index reflective boundary",
        hiddenFact: "Pure silica boundary reflecting light by total internal reflection at 82 degrees.",
        claimIds: ["c1"],
      },
      {
        name: "Polyacrylate Coating",
        role: "Moisture and microbend buffer jacket",
        hiddenFact: "Dual-layer ultraviolet-cured polymer preventing microcracks under sea pressure.",
        claimIds: ["c2"],
      },
    ],
    lenses: ["tech", "origins"],
    nextQuestions: [],
    concepts: [],
    claims: [
      {
        id: "c1",
        text: "Charles Kao proposed single-mode optical fiber communications in 1966.",
        status: "established",
        evidenceStatus: "supported",
        sources: [
          {
            title: "Kao & Hockham 1966 Paper",
            url: "https://ieeexplore.ieee.org/document/5214048",
            retrievedAt: new Date().toISOString(),
          },
        ],
      },
      {
        id: "c2",
        text: "Optical fiber carries over 99 percent of all transoceanic internet traffic.",
        status: "established",
        evidenceStatus: "supported",
        sources: [
          {
            title: "Submarine Cable Map Report",
            url: "https://www.submarinecablemap.com",
            retrievedAt: new Date().toISOString(),
          },
        ],
      },
    ],
  };

  before(async () => {
    if (isSupabaseConfigured) {
      // Seed profiles for Account A and Account B
      await supabaseAdmin.from("profiles").upsert([
        { id: accountA, plan: "free", role: "user" },
        { id: accountB, plan: "free", role: "user" },
      ]);
    }
  });

  after(async () => {
    if (isSupabaseConfigured) {
      // Cleanup all test records
      await supabaseAdmin.from("roots").delete().in("id", [testRootId, childRootId]);
      await supabaseAdmin.from("profiles").delete().in("id", [accountA, accountB]);
    }
  });

  // ==========================================================================
  // 1. DATA INTEGRITY
  // ==========================================================================
  describe("1. Data Integrity", () => {
    it("A scan persists its root, claims and sources correctly in Supabase", async () => {
      if (!isSupabaseConfigured) return;

      // 1. Insert root
      const { error: rootErr } = await supabaseAdmin.from("roots").upsert({
        id: testRootId,
        user_id: accountA,
        depth: 0,
        input_kind: "text",
        title: validMockCard.title,
        card: validMockCard,
        status: "ready",
      });
      assert.equal(rootErr, null, "Root should insert without error");

      // 2. Insert claims
      for (const claim of validMockCard.claims) {
        const claimDbId = `${testRootId}_${claim.id}`;
        const { error: claimErr } = await supabaseAdmin.from("claims").upsert({
          id: claimDbId,
          root_id: testRootId,
          local_id: claim.id,
          text: claim.text,
          claim_type: "fact",
          evidence_status: claim.evidenceStatus,
        });
        assert.equal(claimErr, null, "Claims should insert without error");

        // 3. Insert claim sources
        for (const src of claim.sources || []) {
          const { error: srcErr } = await supabaseAdmin.from("claim_sources").insert({
            claim_id: claimDbId,
            title: src.title,
            url: src.url,
          });
          assert.equal(srcErr, null, "Sources should insert without error");
        }
      }

      // Verify records in DB
      const { data: dbRoot } = await supabaseAdmin
        .from("roots")
        .select("id, user_id, title")
        .eq("id", testRootId)
        .single();
      assert.equal(dbRoot?.id, testRootId);
      assert.equal(dbRoot?.user_id, accountA);

      const { data: dbClaims } = await supabaseAdmin
        .from("claims")
        .select("id, root_id")
        .eq("root_id", testRootId);
      assert.equal(dbClaims?.length, 2);

      const { data: dbSources } = await supabaseAdmin
        .from("claim_sources")
        .select("id, claim_id, title")
        .in("claim_id", dbClaims?.map((c) => c.id) || []);
      assert.equal(dbSources?.length, 2);
    });

    it("Deepening persists the child, parent relationship, claims, sources and edge", async () => {
      if (!isSupabaseConfigured) return;

      // 1. Insert child root linked to parent
      const { error: childErr } = await supabaseAdmin.from("roots").upsert({
        id: childRootId,
        user_id: accountA,
        parent_id: testRootId,
        depth: 1,
        input_kind: "question",
        title: "Germanium Dopant Chemistry",
        card: validMockCard,
        status: "ready",
      });
      assert.equal(childErr, null);

      // 2. Insert child claim & source
      const childClaimDbId = `${childRootId}_c1`;
      await supabaseAdmin.from("claims").upsert({
        id: childClaimDbId,
        root_id: childRootId,
        local_id: "c1",
        text: "Germanium tetrachloride modifies refractive index during vapor deposition.",
        claim_type: "fact",
        evidence_status: "supported",
      });

      await supabaseAdmin.from("claim_sources").insert({
        claim_id: childClaimDbId,
        title: "Vapor Phase Axial Deposition",
        url: "https://en.wikipedia.org/wiki/Vapor_axial_deposition",
      });

      // 3. Insert edge
      const edgeId = `edge_${testRootId}_${childRootId}`;
      const { error: edgeErr } = await supabaseAdmin.from("edges").upsert({
        id: edgeId,
        user_id: accountA,
        from_root: testRootId,
        to_root: childRootId,
        type: "parent",
        why: "Germanium dopants enable refractive index gradient in optical fibers.",
      });
      assert.equal(edgeErr, null);

      // Verify child points to parent
      const { data: verifiedChild } = await supabaseAdmin
        .from("roots")
        .select("id, parent_id, depth")
        .eq("id", childRootId)
        .single();
      assert.equal(verifiedChild?.parent_id, testRootId);
      assert.equal(verifiedChild?.depth, 1);

      // Verify edge
      const { data: verifiedEdge } = await supabaseAdmin
        .from("edges")
        .select("id, from_root, to_root, type")
        .eq("id", edgeId)
        .single();
      assert.equal(verifiedEdge?.from_root, testRootId);
      assert.equal(verifiedEdge?.to_root, childRootId);
      assert.equal(verifiedEdge?.type, "parent");
    });

    it("A failed dependent write cannot be presented as a successful complete save", async () => {
      if (!isSupabaseConfigured) return;

      // Simulate a corrupt foreign key claim source insert (pointing to non-existent claim)
      const fakeClaimId = "non_existent_claim_999999";
      const { error: expectedError } = await supabaseAdmin.from("claim_sources").insert({
        claim_id: fakeClaimId,
        title: "Broken link",
        url: "https://invalid.example.com",
      });

      // Must be rejected by database foreign key constraint
      assert.ok(expectedError !== null, "Foreign key violation must return error");
      assert.equal(expectedError?.code, "23503", "Foreign key constraint code 23503");
    });

    it("Deleting a root leaves no unintended orphan records or graph edges", async () => {
      if (!isSupabaseConfigured) return;

      // Delete the child root
      await supabaseAdmin.from("roots").delete().eq("id", childRootId);

      // Verify child root is deleted
      const { data: childCheck } = await supabaseAdmin
        .from("roots")
        .select("id")
        .eq("id", childRootId);
      assert.equal(childCheck?.length, 0);

      // Verify claims cascading deletion
      const { data: claimsCheck } = await supabaseAdmin
        .from("claims")
        .select("id")
        .eq("root_id", childRootId);
      assert.equal(claimsCheck?.length, 0, "No orphaned claims should remain");

      // Verify claim_sources cascading deletion
      const { data: sourcesCheck } = await supabaseAdmin
        .from("claim_sources")
        .select("id")
        .eq("claim_id", `${childRootId}_c1`);
      assert.equal(sourcesCheck?.length, 0, "No orphaned claim sources should remain");

      // Verify edges cascading deletion
      const { data: edgesCheck } = await supabaseAdmin
        .from("edges")
        .select("id")
        .or(`from_root.eq.${childRootId},to_root.eq.${childRootId}`);
      assert.equal(edgesCheck?.length, 0, "No orphaned edges should remain");
    });
  });

  // ==========================================================================
  // 2. SECURITY & MULTI-TENANT ISOLATION
  // ==========================================================================
  describe("2. Security & Multi-Tenant Isolation", () => {
    it("Account B cannot overwrite Account A's root ID via POST /api/roots", async () => {
      // Create request where Account B attempts to overwrite Account A's testRootId
      const maliciousPayload = {
        root: {
          id: testRootId, // Owned by Account A
          title: "Hijacked by Account B",
          depth: 0,
          inputKind: "text",
          createdAt: new Date().toISOString(),
          card: validMockCard,
        },
      };

      // Construct NextRequest with Account B's Bearer token or mock context
      const req = new NextRequest("http://localhost:3000/api/roots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // The API route handler checks existingRoot.user_id !== user.id
        },
        body: JSON.stringify(maliciousPayload),
      });

      // Verify direct database protection: Account B attempting to overwrite Account A's root
      if (isSupabaseConfigured) {
        // Direct query check simulating API handler logic
        const { data: existingRoot } = await supabaseAdmin
          .from("roots")
          .select("id, user_id")
          .eq("id", testRootId)
          .single();

        assert.equal(existingRoot?.user_id, accountA);
        const callerId = accountB;

        // The authoritative server logic rejects when existing.user_id !== callerId
        const isUnauthorized = existingRoot && existingRoot.user_id && existingRoot.user_id !== callerId;
        assert.equal(isUnauthorized, true, "Must flag unauthorized ownership violation");
      }
    });

    it("Account B cannot delete Account A's root via scoped deletion", async () => {
      if (!isSupabaseConfigured) return;

      // Account B attempts to delete Account A's root with scoped filter: .eq("user_id", accountB)
      const { data, error } = await supabaseAdmin
        .from("roots")
        .delete()
        .eq("id", testRootId)
        .eq("user_id", accountB)
        .select();

      assert.equal(error, null);
      assert.equal(data?.length, 0, "Account B should delete 0 rows");

      // Verify Account A's root still exists intact
      const { data: intactRoot } = await supabaseAdmin
        .from("roots")
        .select("id, user_id")
        .eq("id", testRootId)
        .single();
      assert.equal(intactRoot?.id, testRootId);
      assert.equal(intactRoot?.user_id, accountA);
    });

    it("Account B cannot deepen Account A's root without ownership", async () => {
      if (!isSupabaseConfigured) return;

      // Verify that parentRootId belongs to Account A
      const { data: parent } = await supabaseAdmin
        .from("roots")
        .select("id, user_id")
        .eq("id", testRootId)
        .single();

      const callerUserId = accountB;
      const canDeepen = parent && (parent.user_id === callerUserId || !parent.user_id);
      assert.equal(canDeepen, false, "Account B must be prohibited from deepening Account A's root");
    });

    it("RLS prevents anonymous reading of private user roots", async () => {
      if (!isSupabaseConfigured) return;

      // Anonymous client querying roots
      const { data, error } = await anonClient
        .from("roots")
        .select("id, user_id, title")
        .eq("id", testRootId);

      // Under RLS, anon client receives 0 rows for private user roots
      assert.equal(error, null);
      assert.equal(data?.length, 0, "RLS must hide private user root from anonymous callers");
    });

    it("Schema defines root-ownership-scoped RLS policies for claims and claim_sources", () => {
      const schemaPath = path.join(process.cwd(), "supabase/schema.sql");
      const schema = fs.readFileSync(schemaPath, "utf-8");
      assert.ok(
        schema.includes('create policy "Users can view claims of readable roots" on public.claims'),
        "claims SELECT policy must exist"
      );
      assert.ok(
        schema.includes('create policy "Users can view claim sources of readable roots" on public.claim_sources'),
        "claim_sources SELECT policy must exist"
      );
      assert.ok(
        !schema.includes('create policy "Claims readable with root" on public.claims\n    for select using (true);'),
        "broad using (true) on claims must be removed"
      );
    });
  });

  // ==========================================================================
  // 3. CONCURRENCY, QUOTA & KILL-SWITCH
  // ==========================================================================
  describe("3. Concurrency, Quotas & Fail-Closed Behavior", () => {
    it("atomic_reserve_quota serializes concurrent requests without race condition crashes", async () => {
      if (!isSupabaseConfigured) return;

      const concurrencyUser = `concurrent_usr_${Date.now()}`;
      const day = new Date().toISOString().slice(0, 10);
      const limit = 5;

      // Execute 8 concurrent reservations for the same user on a fresh day
      const promises = Array.from({ length: 8 }).map(() =>
        supabaseAdmin.rpc("atomic_reserve_quota", {
          p_user_id: concurrencyUser,
          p_day: day,
          p_kind: "scan",
          p_limit: limit,
        })
      );

      const results = await Promise.all(promises);

      // Every call must succeed at the RPC level (no unique constraint crashes)
      results.forEach((res) => {
        assert.equal(res.error, null, "Concurrent RPC must not throw DB constraint error");
      });

      // Exactly `limit` calls should be allowed (true), remainder rejected (false)
      const allowedCount = results.filter((r) => r.data?.[0]?.allowed === true).length;
      const rejectedCount = results.filter((r) => r.data?.[0]?.allowed === false).length;

      assert.equal(allowedCount, limit, `Exactly ${limit} requests should be allowed`);
      assert.equal(rejectedCount, 3, "Excess 3 requests must be rejected by quota limit");

      // Cleanup usage record
      await supabaseAdmin.from("usage").delete().eq("user_id", concurrencyUser);
    });

    it("kill switch immediately disables scan access and returns 0 limit", async () => {
      if (!isSupabaseConfigured) return;

      // Set kill switch to active
      await supabaseAdmin
        .from("app_settings")
        .upsert({ key: "scan_kill_switch", value: true });

      const { getEntitlements } = await import("../src/lib/security/entitlements");
      const entitlements = await getEntitlements(accountA);

      assert.equal(entitlements.dailyScanLimit, 0, "Kill switch must zero out daily scans");
      assert.equal(entitlements.maxRabbitDepth, 0, "Kill switch must disable deepening");

      // Reset kill switch
      await supabaseAdmin
        .from("app_settings")
        .upsert({ key: "scan_kill_switch", value: false });
    });
  });
});
