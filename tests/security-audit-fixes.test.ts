import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { isPrivateOrReservedIp } from "../src/lib/security/safe-fetch";
import {
  getEntitlements,
  setCachedPlan,
  invalidateSubscriptionCache,
  clearSubscriptionCache,
} from "../src/lib/security/entitlements";
import { validateRootsCardIntegrity } from "../src/lib/schema";

describe("Security Audit Hardening & P0/P1 Verifications", () => {
  describe("SSRF & IP Normalization Evasion Defenses", () => {
    it("blocks IPv4 in hex representations", () => {
      assert.equal(isPrivateOrReservedIp("0x7f.0.0.1"), true);
      assert.equal(isPrivateOrReservedIp("0x0a.0.0.1"), true);
      assert.equal(isPrivateOrReservedIp("0xc0.0xa8.0.1"), true);
    });

    it("blocks IPv4 in octal representations", () => {
      assert.equal(isPrivateOrReservedIp("0177.0.0.1"), true);
      assert.equal(isPrivateOrReservedIp("012.0.0.1"), true);
    });

    it("blocks single-integer decimal IPv4 representations (e.g. 2130706433 = 127.0.0.1)", () => {
      assert.equal(isPrivateOrReservedIp("2130706433"), true); // 127.0.0.1
      assert.equal(isPrivateOrReservedIp("167772161"), true);  // 10.0.0.1
      assert.equal(isPrivateOrReservedIp("2852039166"), true); // 169.254.169.254
    });

    it("blocks IPv4-mapped IPv6 in dotted quad and bracketed notation", () => {
      assert.equal(isPrivateOrReservedIp("::ffff:127.0.0.1"), true);
      assert.equal(isPrivateOrReservedIp("[::ffff:127.0.0.1]"), true);
      assert.equal(isPrivateOrReservedIp("::ffff:10.0.0.1"), true);
      assert.equal(isPrivateOrReservedIp("::ffff:169.254.169.254"), true);
      assert.equal(isPrivateOrReservedIp("::ffff:192.168.1.1"), true);
    });

    it("blocks IPv4-mapped IPv6 in hex-word notation", () => {
      assert.equal(isPrivateOrReservedIp("::ffff:7f00:1"), true); // 127.0.0.1
      assert.equal(isPrivateOrReservedIp("[::ffff:7f00:0001]"), true);
      assert.equal(isPrivateOrReservedIp("::ffff:0a00:1"), true); // 10.0.0.1
    });

    it("blocks 6to4 embedded IPv4 private addresses (2002::/16)", () => {
      assert.equal(isPrivateOrReservedIp("2002:7f00:0001::"), true); // 127.0.0.1
      assert.equal(isPrivateOrReservedIp("2002:a00:1::"), true);     // 10.0.0.1
      assert.equal(isPrivateOrReservedIp("2002:a9fe:a9fe::"), true); // 169.254.169.254
    });

    it("blocks IPv6 loopback, link-local, and unique local addresses", () => {
      assert.equal(isPrivateOrReservedIp("::1"), true);
      assert.equal(isPrivateOrReservedIp("[::1]"), true);
      assert.equal(isPrivateOrReservedIp("fe80::1"), true);
      assert.equal(isPrivateOrReservedIp("fc00::1"), true);
      assert.equal(isPrivateOrReservedIp("fd12:3456:789a::1"), true);
    });

    it("allows standard public internet IPs", () => {
      assert.equal(isPrivateOrReservedIp("8.8.8.8"), false);
      assert.equal(isPrivateOrReservedIp("1.1.1.1"), false);
      assert.equal(isPrivateOrReservedIp("93.184.216.34"), false);
      assert.equal(isPrivateOrReservedIp("2606:4700:4700::1111"), false);
    });
  });

  describe("Entitlements & Cache Invalidation", () => {
    it("returns correct default free entitlements", async () => {
      clearSubscriptionCache();
      const freeEntitlements = await getEntitlements("test_user_free_default");
      assert.equal(freeEntitlements.plan, "free");
      assert.equal(freeEntitlements.dailyScanLimit, 5);
      assert.equal(freeEntitlements.maxRabbitDepth, 3);
      assert.equal(freeEntitlements.allClaimsEvidence, false);
      assert.equal(freeEntitlements.canExportTree, false);
    });

    it("allows setting and invalidating subscription cache", async () => {
      clearSubscriptionCache();
      const testUserId = "user_cache_test_999";
      
      // Set to Pro in-memory cache
      setCachedPlan(testUserId, "pro");
      const cachedPro = await getEntitlements(testUserId);
      assert.equal(cachedPro.plan, "pro");
      assert.equal(cachedPro.dailyScanLimit, 50);
      assert.equal(cachedPro.maxRabbitDepth, 5);
      assert.equal(cachedPro.allClaimsEvidence, true);

      // Invalidate cache
      invalidateSubscriptionCache(testUserId);
      clearSubscriptionCache();
    });
  });

  describe("Database Schema Security Hardening", () => {
    const schemaPath = path.join(__dirname, "../supabase/schema.sql");
    const schemaContent = fs.readFileSync(schemaPath, "utf-8");

    it("atomic_reserve_quota includes atomic initialization before row lock", () => {
      assert.ok(
        schemaContent.includes("insert into public.usage (user_id, day, kind, count)") &&
        schemaContent.includes("on conflict (user_id, day, kind) do nothing;"),
        "atomic_reserve_quota must run INSERT ... ON CONFLICT DO NOTHING before locking"
      );
    });

    it("claims and claim_sources RLS policies are scoped to root ownership", () => {
      assert.ok(
        schemaContent.includes('create policy "Users can view claims of readable roots" on public.claims'),
        "claims SELECT policy must exist"
      );
      assert.ok(
        schemaContent.includes('create policy "Users can delete claims of own roots" on public.claims'),
        "claims DELETE policy must exist"
      );
      assert.ok(
        schemaContent.includes('create policy "Users can view claim sources of readable roots" on public.claim_sources'),
        "claim_sources SELECT policy must exist"
      );
      // Ensure broad `using (true)` was removed from claims
      assert.ok(
        !schemaContent.includes('create policy "Claims readable with root" on public.claims\n    for select using (true);'),
        "broad using (true) on claims must be removed"
      );
    });
  });

  describe("Card Integrity & Validation", () => {
    it("validates valid root card structures", () => {
      const validCard = {
        title: "Roman Concrete",
        oneLiner: "Volcanic ash allowing underwater hydraulic set",
        inputKind: "text" as const,
        inputSummary: "Roman concrete",
        root: {
          headline: "Pozzolana created interlocking crystalline matrices",
          body: "Volcanic ash and slaked lime formed strätlingite crystals.",
          claimIds: ["c1"],
          lens: "tech" as const,
        },
        layers: [
          {
            name: "Materials",
            summary: "Volcanic pozzolan ash",
            claimIds: ["c1"],
            lens: "origins" as const,
          },
        ],
        components: [
          {
            name: "Pozzolana",
            role: "Reactive binder",
            hiddenFact: "Hot-mixed with quicklime.",
            claimIds: ["c1"],
          },
        ],
        claims: [
          {
            id: "c1",
            text: "Pozzolana enabled hydraulic reaction in seawater.",
            status: "established" as const,
          },
        ],
        lenses: ["tech", "origins"] as const,
        rabbitHoles: [],
      };

      const result = validateRootsCardIntegrity(validCard as any);
      assert.equal(result.isValid, true);
      assert.equal(result.errors.length, 0);
    });

    it("detects corrupted card structures with invalid claim citations or clarification need", () => {
      const invalidCard = {
        title: "Unknown",
        oneLiner: "Unknown",
        root: {
          headline: "Unknown",
          body: "Unknown",
          claimIds: ["non_existent_claim_id"],
        },
        layers: [],
        components: [],
        claims: [],
        needsClarification: "Image is too blurry to identify",
      };

      const result = validateRootsCardIntegrity(invalidCard as any);
      assert.equal(result.isValid, false);
      assert.ok(result.errors.length > 0);
    });
  });
});
