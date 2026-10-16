import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { verifyClaimsPass2 } from "../src/lib/ai/evidence";
import { Claim } from "../src/types/roots";

describe("Evidence Grounding & Verification", () => {
  it("marks a claim as unverified if no reference candidates can be located", async () => {
    const claims: Claim[] = [
      {
        id: "c1",
        text: "Xylophonic zzz999 unrecorded fictitious gadget was assembled on Mars.",
        status: "established",
        sources: [],
      },
    ];

    const verified = await verifyClaimsPass2(claims);
    assert.equal(verified.length, 1);
    assert.equal(verified[0].evidenceStatus, "unverified");
    // Downgrades unverified established claim to interpretation
    assert.equal(verified[0].status, "interpretation");
  });

  it("handles empty claim list gracefully", async () => {
    const verified = await verifyClaimsPass2([]);
    assert.deepEqual(verified, []);
  });
});
