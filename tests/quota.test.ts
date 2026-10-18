import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getClientIdentifier } from "../src/lib/security/quota";
import { NextRequest } from "next/server";

describe("Quota & Identity Hardening", () => {
  it("anonymizes guest IP and hashes with salt rather than storing raw IP", async () => {
    const req = new NextRequest("http://localhost:3000/api/scan", {
      headers: {
        "x-real-ip": "198.51.100.42",
      },
    });

    const ident = await getClientIdentifier(req);
    assert.equal(ident.isAnonymous, true);
    assert.ok(ident.clientId.startsWith("gst_"));
    // Never expose raw IP in client identifier
    assert.equal(ident.clientId.includes("198.51.100.42"), false);
    assert.equal(ident.userId, undefined);
  });

  it("handles forwarded-for proxies safely by using leftmost IP", async () => {
    const req = new NextRequest("http://localhost:3000/api/scan", {
      headers: {
        "x-forwarded-for": "203.0.113.195, 10.0.0.1",
      },
    });

    const ident = await getClientIdentifier(req);
    assert.ok(ident.clientId.startsWith("gst_"));
    assert.equal(ident.clientId.includes("203.0.113.195"), false);
  });

  it("produces deterministic hash for identical guest IP and salt", async () => {
    const req1 = new NextRequest("http://localhost:3000/api/scan", {
      headers: { "x-real-ip": "203.0.113.88" },
    });
    const req2 = new NextRequest("http://localhost:3000/api/scan", {
      headers: { "x-real-ip": "203.0.113.88" },
    });

    const id1 = await getClientIdentifier(req1);
    const id2 = await getClientIdentifier(req2);
    assert.equal(id1.clientId, id2.clientId);
  });

  it("fails closed in getQuotaStatus when database is unavailable", async () => {
    const { getQuotaStatus } = await import("../src/lib/security/quota");
    const status = await getQuotaStatus("gst_test_unreachable");
    // When DB is unreachable/mocked without connection, must fail closed with remaining 0
    assert.equal(status.remaining, 0);
    assert.ok(status.error === "DATABASE_UNAVAILABLE");
    assert.equal(status.limit, 5);
  });
});

