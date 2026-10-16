import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isPrivateOrReservedIp, safeFetchUrl } from "../src/lib/security/safe-fetch";

describe("Security & SSRF Hardening", () => {
  it("correctly identifies IPv4 loopback and local addresses as private/reserved", () => {
    assert.equal(isPrivateOrReservedIp("127.0.0.1"), true);
    assert.equal(isPrivateOrReservedIp("127.255.255.255"), true);
    assert.equal(isPrivateOrReservedIp("0.0.0.0"), true);
  });

  it("correctly identifies AWS/GCP cloud metadata IP (169.254.169.254) as private/reserved", () => {
    assert.equal(isPrivateOrReservedIp("169.254.169.254"), true);
    assert.equal(isPrivateOrReservedIp("169.254.0.1"), true);
  });

  it("correctly identifies RFC 1918 private subnets (10.x, 172.16-31.x, 192.168.x)", () => {
    assert.equal(isPrivateOrReservedIp("10.0.0.1"), true);
    assert.equal(isPrivateOrReservedIp("10.254.1.5"), true);
    assert.equal(isPrivateOrReservedIp("172.16.0.1"), true);
    assert.equal(isPrivateOrReservedIp("172.31.255.255"), true);
    assert.equal(isPrivateOrReservedIp("192.168.1.1"), true);
  });

  it("correctly identifies Carrier-Grade NAT (100.64.0.0/10) as reserved", () => {
    assert.equal(isPrivateOrReservedIp("100.64.0.1"), true);
    assert.equal(isPrivateOrReservedIp("100.127.255.255"), true);
  });

  it("correctly identifies IPv6 loopback, link-local and unique-local addresses", () => {
    assert.equal(isPrivateOrReservedIp("::1"), true);
    assert.equal(isPrivateOrReservedIp("fe80::1"), true);
    assert.equal(isPrivateOrReservedIp("fc00::1"), true);
    assert.equal(isPrivateOrReservedIp("fd00::1"), true);
    assert.equal(isPrivateOrReservedIp("::ffff:127.0.0.1"), true);
  });

  it("allows standard public internet IPs", () => {
    assert.equal(isPrivateOrReservedIp("8.8.8.8"), false);
    assert.equal(isPrivateOrReservedIp("1.1.1.1"), false);
    assert.equal(isPrivateOrReservedIp("93.184.216.34"), false); // example.com
  });

  it("safeFetchUrl blocks non-HTTP/HTTPS protocols", async () => {
    await assert.rejects(
      async () => await safeFetchUrl("file:///etc/passwd"),
      /Only HTTP and HTTPS URLs are allowed/
    );
    await assert.rejects(
      async () => await safeFetchUrl("ftp://192.168.1.1/resource"),
      /Only HTTP and HTTPS URLs are allowed/
    );
  });

  it("safeFetchUrl blocks non-standard ports to prevent internal port scanning", async () => {
    await assert.rejects(
      async () => await safeFetchUrl("http://example.com:22"),
      /restricted to standard web ports/
    );
    await assert.rejects(
      async () => await safeFetchUrl("http://example.com:5432"),
      /restricted to standard web ports/
    );
  });

  it("safeFetchUrl blocks localhost and cloud metadata destinations", async () => {
    await assert.rejects(
      async () => await safeFetchUrl("http://localhost"),
      /Access to private or internal network destinations is blocked/
    );
    await assert.rejects(
      async () => await safeFetchUrl("http://169.254.169.254/latest/meta-data/"),
      /Access to private/
    );
  });
});
