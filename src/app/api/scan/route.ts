import { NextRequest, NextResponse } from "next/server";
import { decomposeInput } from "@/lib/ai/decomposition";
import { getClientIdentifier, checkAndIncrementQuota, refundQuota } from "@/lib/security/quota";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  let reservedClientId: string | null = null;

  try {
    // 1. Enforce Upload Size Limit (Max 4MB)
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 4 * 1024 * 1024) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Upload payload exceeds maximum allowable size (4 MB).",
            retryable: false,
            requestId,
          },
        },
        { status: 413 }
      );
    }

    // 2. Parse & Validate Input Body Before Quota Reservation
    const contentType = req.headers.get("content-type") || "";
    let inputKind: "photo" | "screenshot" | "text" | "question" | "link" = "text";
    let inputText: string | undefined;
    let imageBase64: string | undefined;
    let mimeType: string = "image/jpeg";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      inputKind = (formData.get("inputKind") as any) || "photo";
      inputText = (formData.get("inputText") as string) || undefined;
      const file = formData.get("image") as File | null;

      if (file) {
        const validMimes = ["image/jpeg", "image/png", "image/webp"];
        if (!validMimes.includes(file.type)) {
          return NextResponse.json(
            {
              error: {
                code: "BAD_REQUEST",
                message: "Unsupported image format. Please upload JPEG, PNG, or WebP.",
                retryable: false,
                requestId,
              },
            },
            { status: 415 }
          );
        }

        if (file.size > 4 * 1024 * 1024) {
          return NextResponse.json(
            {
              error: {
                code: "BAD_REQUEST",
                message: "Image file exceeds 4 MB.",
                retryable: false,
                requestId,
              },
            },
            { status: 413 }
          );
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        imageBase64 = buffer.toString("base64");
        mimeType = file.type;
      }
    } else {
      const json = await req.json().catch(() => null);
      if (!json) {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: "Invalid or empty JSON body.",
              retryable: false,
              requestId,
            },
          },
          { status: 400 }
        );
      }
      inputKind = json.inputKind || "text";
      inputText = json.inputText;
      imageBase64 = json.imageBase64;
      mimeType = json.mimeType || "image/jpeg";
    }

    if (!inputText && !imageBase64) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Missing text or image payload.",
            retryable: false,
            requestId,
          },
        },
        { status: 400 }
      );
    }

    if (imageBase64 && imageBase64.length > 5.5 * 1024 * 1024) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Base64 image payload exceeds maximum allowable size (4 MB).",
            retryable: false,
            requestId,
          },
        },
        { status: 413 }
      );
    }

    if (inputText && inputText.length > 50000) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Input text exceeds maximum allowable length (50,000 characters).",
            retryable: false,
            requestId,
          },
        },
        { status: 413 }
      );
    }

    // 3. Authoritative Server Identity
    const { clientId, userId } = await getClientIdentifier(req);

    // 4. Atomic Quota Reservation
    const quota = await checkAndIncrementQuota(clientId, userId, "scan");
    reservedClientId = clientId;

    if (quota.isKillSwitch) {
      return NextResponse.json(
        {
          error: {
            code: "PROVIDER_UNAVAILABLE",
            message: "Scan service is temporarily paused for system maintenance.",
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
              : "Daily scan limit reached. Please upgrade to Pro or return tomorrow.",
            retryable: isUnavailable,
            requestId,
          },
          quota,
        },
        {
          status: isUnavailable ? 503 : 429,
          headers: {
            "Retry-After": quota.resetSeconds.toString(),
            "X-RateLimit-Limit": quota.limit.toString(),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // 5. Execute Lane 1 AI Decomposition (Multi-model provider adapter)
    const card = await decomposeInput({
      inputKind,
      inputText,
      imageBase64,
      mimeType,
    });

    const rootId = `root-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // 6. If user is authenticated, persist root and claims directly in Supabase
    if (userId) {
      try {
        await supabaseAdmin.from("roots").upsert({
          id: rootId,
          user_id: userId,
          depth: 0,
          input_kind: inputKind,
          title: card.title,
          input_text: inputText || null,
          card,
          prompt_version: card.promptVersion || "v3.0",
          model: card.modelUsed || "gemini-3.8-flash",
          status: "ready",
          created_at: new Date().toISOString(),
        });

        if (Array.isArray(card.claims)) {
          for (const claim of card.claims) {
            await supabaseAdmin.from("claims").upsert({
              id: `${rootId}_${claim.id}`,
              root_id: rootId,
              local_id: claim.id,
              text: claim.text,
              claim_type: claim.status === "established" ? "fact" : "interpretation",
              evidence_status: claim.evidenceStatus || "unverified",
              created_at: new Date().toISOString(),
            });
          }
        }
      } catch (saveErr: any) {
        console.warn("Direct scan root persistence notice:", saveErr.message);
      }
    }

    // 7. Record run log asynchronously
    try {
      await supabaseAdmin.from("analysis_runs").insert({
        user_id: userId || null,
        root_id: rootId,
        job: "scan",
        provider: "gemini",
        model: card.modelUsed || "gemini-3.8-flash",
        latency_ms: Date.now() - startTime,
        status: "success",
        est_cost_usd: 0.0003,
      });
    } catch {}

    return NextResponse.json({
      rootId,
      card,
      quota,
    });
  } catch (error: any) {
    console.error(`[Scan API Request ${requestId} Failed]:`, error);

    // Refund quota reservation on failure!
    if (reservedClientId) {
      try {
        await refundQuota(reservedClientId, "scan");
      } catch {}
    }

    return NextResponse.json(
      {
        error: {
          code: error.name === "ZodError" ? "MODEL_OUTPUT_INVALID" : "INTERNAL",
          message: error.message || "Failed to process scan.",
          retryable: true,
          requestId,
        },
      },
      { status: 500 }
    );
  }
}
