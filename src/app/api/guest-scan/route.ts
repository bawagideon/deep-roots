import { NextRequest, NextResponse } from "next/server";
import { decomposeInput } from "@/lib/ai/decomposition";
import { getClientIdentifier } from "@/lib/security/quota";
import { buildConstellationSpec } from "@/lib/visual/generator";

export const dynamic = "force-dynamic";

/**
 * In-memory sliding rate-limit tracker for guest scans per IP
 * Allows 1 free guest scan per IP per 12 hours
 */
const guestScanAttempts = new Map<string, number>();

/**
 * POST /api/guest-scan
 * Per Deep Roots spec section 1.4:
 * 1. /try is public. One guest scan, processed by /api/guest-scan.
 * 2. The card is returned to the browser and kept in local storage. Nothing is saved server-side for guests.
 * 3. "Save your Tree" opens Clerk sign-up. After sign-in, the app claims it via /api/claim-guest-root.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    // 1. Max payload limit: 4MB
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

    // 2. Parse Body
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
        const arrayBuffer = await file.arrayBuffer();
        imageBase64 = Buffer.from(arrayBuffer).toString("base64");
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
            message: "Missing text or image payload for guest scan.",
            retryable: false,
            requestId,
          },
        },
        { status: 400 }
      );
    }

    // 3. Guest Rate Limiting: 1 free guest scan per IP window
    const { clientId } = await getClientIdentifier(req);
    const lastAttempt = guestScanAttempts.get(clientId);
    const now = Date.now();
    const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown for guests

    if (lastAttempt && now - lastAttempt < COOLDOWN_MS) {
      return NextResponse.json(
        {
          error: {
            code: "GUEST_LIMIT_REACHED",
            message: "You've used your free guest scan! Sign up free to save this to your Tree and unlock more scans.",
            retryable: false,
            requestId,
          },
          needsSignUp: true,
        },
        { status: 429 }
      );
    }

    guestScanAttempts.set(clientId, now);

    // 4. Run Lane 1 AI Decomposition
    const card = await decomposeInput({
      inputKind,
      inputText,
      imageBase64,
      mimeType,
    });

    // 5. Generate Procedural Visual Scene
    const visual = buildConstellationSpec(card);

    // 6. Return card without saving to database (as required for guest flow)
    return NextResponse.json({
      success: true,
      requestId,
      latencyMs: Date.now() - startTime,
      card,
      visual,
      inputKind,
      inputText: inputText || card.title,
    });
  } catch (err: any) {
    console.error("Guest scan failed:", err);
    return NextResponse.json(
      {
        error: {
          code: "PROVIDER_ERROR",
          message: err.message || "Failed to decompose input.",
          retryable: true,
          requestId,
        },
      },
      { status: 500 }
    );
  }
}
