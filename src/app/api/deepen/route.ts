import { NextRequest, NextResponse } from "next/server";
import { deepenRabbitHole } from "@/lib/ai/decomposition";
import { getClientIdentifier, checkAndIncrementQuota, refundQuota } from "@/lib/security/quota";
import { getEntitlements } from "@/lib/security/entitlements";
import { supabaseAdmin } from "@/lib/supabase/server";
import { SEEDED_ROOTS } from "@/lib/constants";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = `deepen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  let reservedClientId: string | null = null;

  try {
    const json = await req.json().catch(() => null);
    if (!json || !json.parentCard) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Missing or malformed parentCard payload.",
            retryable: false,
            requestId,
          },
        },
        { status: 400 }
      );
    }

    const { parentCard, kind = "question", targetComponent, questionText } = json;
    const parentRootId: string | undefined = json.parentRootId || (parentCard as any).id;

    // 1. Authoritative Server Identity & Entitlements
    const { clientId, userId } = await getClientIdentifier(req);
    const entitlements = await getEntitlements(userId);

    // 2. Authoritative Depth Derivation & Parent Ownership Verification
    let authoritativeDepth = 1;
    let verifiedParentId = parentRootId;

    if (userId) {
      if (!parentRootId) {
        return NextResponse.json(
          {
            error: {
              code: "MISSING_PARENT_ID",
              message: "Parent root ID is required to deepen a rabbit hole for authenticated accounts.",
              retryable: false,
              requestId,
            },
          },
          { status: 400 }
        );
      }

      // Check database for parent root
      const { data: parentRoot, error: parentErr } = await supabaseAdmin
        .from("roots")
        .select("id, user_id, depth, title")
        .eq("id", parentRootId)
        .maybeSingle();

      const isSeeded = SEEDED_ROOTS.some((r) => r.id === parentRootId);

      if (parentRoot) {
        // Enforce ownership: cannot deepen another user's private root!
        if (parentRoot.user_id !== userId && !isSeeded) {
          return NextResponse.json(
            {
              error: {
                code: "FORBIDDEN_PARENT",
                message: "Cannot deepen a discovery belonging to another user.",
                retryable: false,
                requestId,
              },
            },
            { status: 403 }
          );
        }
        authoritativeDepth = (parentRoot.depth || 0) + 1;
        verifiedParentId = parentRoot.id;
      } else if (isSeeded) {
        authoritativeDepth = (json.currentDepth || 0) + 1;
        verifiedParentId = parentRootId;
      } else {
        return NextResponse.json(
          {
            error: {
              code: "PARENT_NOT_FOUND",
              message: "Parent root discovery does not exist in your Tree.",
              retryable: false,
              requestId,
            },
          },
          { status: 404 }
        );
      }
    } else {
      // Guest calculation (safe fallback capped to 1)
      authoritativeDepth = Math.max(1, (Number(json.currentDepth) || 0) + 1);
    }

    // 3. Validate Authoritative Depth Limits against Entitlements
    if (authoritativeDepth > entitlements.maxRabbitDepth) {
      return NextResponse.json(
        {
          error: {
            code: "DEPTH_LIMIT",
            message: `Maximum rabbit hole depth of ${entitlements.maxRabbitDepth} reached for your plan.`,
            retryable: false,
            requestId,
          },
        },
        { status: 403 }
      );
    }

    // 4. Atomic Quota Reservation
    const quota = await checkAndIncrementQuota(clientId, userId, "deepen");
    reservedClientId = clientId;

    if (quota.isKillSwitch) {
      return NextResponse.json(
        {
          error: {
            code: "PROVIDER_UNAVAILABLE",
            message: "Deepen service is temporarily paused for system maintenance.",
            retryable: false,
            requestId,
          },
        },
        { status: 503 }
      );
    }

    if (!quota.allowed) {
      const isUnavailable =
        quota.error === "QUOTA_SERVICE_UNAVAILABLE" ||
        quota.error === "DATABASE_CONNECTION_ERROR";

      return NextResponse.json(
        {
          error: {
            code: isUnavailable ? "QUOTA_SERVICE_UNAVAILABLE" : "QUOTA_EXCEEDED",
            message: isUnavailable
              ? "Quota check service is temporarily unavailable. Please retry in a few moments."
              : "Daily rabbit hole limit reached. Please return tomorrow.",
            retryable: isUnavailable,
            requestId,
          },
          quota,
        },
        { status: isUnavailable ? 503 : 429 }
      );
    }

    // 5. Generate Child Card via AI
    const childCard = await deepenRabbitHole({
      parentCard,
      kind,
      targetComponent,
      questionText,
      currentDepth: authoritativeDepth - 1,
    });

    const childRootId = `root-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // 6. Persist child root, claims, sources, and edge if user is authenticated
    if (userId && verifiedParentId) {
      // Upsert Child Root
      const { error: rootError } = await supabaseAdmin.from("roots").upsert({
        id: childRootId,
        user_id: userId,
        parent_id: verifiedParentId,
        depth: authoritativeDepth,
        input_kind: "question",
        title: childCard.title,
        input_text: questionText,
        card: childCard,
        prompt_version: childCard.promptVersion || "v3.0",
        model: childCard.modelUsed || "gemini-3.8-flash",
        status: "ready",
        created_at: new Date().toISOString(),
      });

      if (rootError) {
        console.error("Failed to persist deepened child root:", rootError.message);
        throw new Error("Failed to persist child root in database.");
      }

      // Upsert Child Claims & Sources
      if (Array.isArray(childCard.claims)) {
        for (const claim of childCard.claims) {
          const claimDbId = `${childRootId}_${claim.id}`;
          const { error: claimErr } = await supabaseAdmin.from("claims").upsert({
            id: claimDbId,
            root_id: childRootId,
            user_id: userId,
            local_id: claim.id,
            text: claim.text,
            claim_type: claim.status === "established" ? "fact" : "interpretation",
            evidence_status: claim.evidenceStatus || "unverified",
            created_at: new Date().toISOString(),
          });

          if (claimErr) {
            console.error(`Failed to persist child claim ${claimDbId}:`, claimErr.message);
          }

          if (Array.isArray(claim.sources)) {
            for (const src of claim.sources) {
              const urlHash = createHash("sha256").update(src.url || "").digest("hex").slice(0, 10);
              await supabaseAdmin.from("claim_sources").upsert({
                id: `${claimDbId}_src_${urlHash}`,
                claim_id: claimDbId,
                user_id: userId,
                title: src.title,
                url: src.url,
                retrieved_at: src.retrievedAt || new Date().toISOString(),
                excerpt: src.excerpt || null,
              });
            }
          }
        }
      }

      // Upsert Edge linking parent to child
      const edgeId = `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const { error: edgeErr } = await supabaseAdmin.from("edges").upsert({
        id: edgeId,
        user_id: userId,
        from_root: verifiedParentId,
        to_root: childRootId,
        type: kind === "cause" ? "cause" : kind === "compare" ? "contrast" : "parent",
        why: questionText || `Deepened into ${targetComponent || "rabbit hole"}`,
        created_by: "ai",
        created_at: new Date().toISOString(),
      });

      if (edgeErr) {
        console.error("Failed to persist deepen graph edge:", edgeErr.message);
        throw new Error("Failed to persist parent-child relationship edge.");
      }
    }

    // 7. Log run asynchronously
    try {
      await supabaseAdmin.from("analysis_runs").insert({
        user_id: userId || null,
        root_id: childRootId,
        job: "deepen",
        provider: "gemini",
        model: childCard.modelUsed || "gemini-3.8-flash",
        latency_ms: Date.now() - startTime,
        status: "success",
        est_cost_usd: 0.0002,
      });
    } catch {}

    return NextResponse.json({
      rootId: childRootId,
      card: childCard,
      depth: authoritativeDepth,
      parentId: verifiedParentId,
      persistedInCloud: Boolean(userId),
      quota,
    });
  } catch (error: any) {
    console.error(`[Deepen API Request ${requestId} Failed]:`, error);

    // Refund quota reservation on failure!
    if (reservedClientId) {
      try {
        await refundQuota(reservedClientId, "deepen");
      } catch {}
    }

    return NextResponse.json(
      {
        error: {
          code: error.name === "ZodError" ? "MODEL_OUTPUT_INVALID" : "INTERNAL",
          message: error.message || "Failed to deepen rabbit hole.",
          retryable: true,
          requestId,
        },
      },
      { status: 500 }
    );
  }
}
