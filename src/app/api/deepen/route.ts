import { NextRequest, NextResponse } from "next/server";
import { deepenRabbitHole } from "@/lib/ai/decomposition";
import { getClientIdentifier, checkAndIncrementQuota, refundQuota } from "@/lib/security/quota";
import { getEntitlements } from "@/lib/security/entitlements";
import { supabaseAdmin } from "@/lib/supabase/server";

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

    const { parentCard, kind = "question", targetComponent, questionText, currentDepth = 0 } = json;

    // 1. Authoritative Server Identity & Entitlements
    const { clientId, userId } = await getClientIdentifier(req);
    const entitlements = await getEntitlements(userId);

    // 2. Validate Depth Limits against Entitlements
    if (currentDepth >= entitlements.maxRabbitDepth) {
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

    // 3. Atomic Quota Reservation
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

    // 4. Generate Child Card
    const childCard = await deepenRabbitHole({
      parentCard,
      kind,
      targetComponent,
      questionText,
      currentDepth,
    });

    const childRootId = `root-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // 5. If user is authenticated, persist child root and parent-child edge in Supabase
    if (userId) {
      try {
        await supabaseAdmin.from("roots").upsert({
          id: childRootId,
          user_id: userId,
          depth: currentDepth + 1,
          input_kind: "question",
          title: childCard.title,
          input_text: questionText,
          card: childCard,
          prompt_version: childCard.promptVersion || "v3.0",
          model: childCard.modelUsed || "gemini-3.8-flash",
          status: "ready",
          created_at: new Date().toISOString(),
        });

        // Insert edge linking parent to child
        const edgeId = `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await supabaseAdmin.from("edges").upsert({
          id: edgeId,
          user_id: userId,
          from_root: (parentCard as any).id || "parent",
          to_root: childRootId,
          type: kind === "cause" ? "cause" : kind === "compare" ? "contrast" : "parent",
          why: questionText,
          created_by: "ai",
          created_at: new Date().toISOString(),
        });
      } catch (saveErr: any) {
        console.warn("Direct deepen root persistence notice:", saveErr.message);
      }
    }

    // 6. Log run asynchronously
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
      depth: currentDepth + 1,
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
