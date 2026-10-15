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
      return NextResponse.json(
        {
          error: {
            code: "QUOTA_EXCEEDED",
            message: "Daily rabbit hole limit reached. Please return tomorrow.",
            retryable: false,
            requestId,
          },
          quota,
        },
        { status: 429 }
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

    // 5. Log run asynchronously
    try {
      await supabaseAdmin.from("analysis_runs").insert({
        user_id: userId || null,
        root_id: null,
        job: "deepen",
        provider: "gemini",
        model: childCard.modelUsed || "gemini-3.8-flash",
        latency_ms: Date.now() - startTime,
        status: "success",
        est_cost_usd: 0.0002,
      });
    } catch {}

    return NextResponse.json({
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
