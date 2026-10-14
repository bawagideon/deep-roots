import { NextRequest, NextResponse } from "next/server";
import { decomposeInput } from "@/lib/ai/decomposition";
import { getClientIdentifier, checkAndIncrementQuota } from "@/lib/security/quota";

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce Server-Side Quotas (5 scans per day for Free, 50 for Pro)
    const { clientId, userId } = getClientIdentifier(req);
    const quota = checkAndIncrementQuota(clientId, userId);

    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: "Daily scan limit reached (5 scans per day). Please return tomorrow.",
          quota,
        },
        {
          status: 429,
          headers: {
            "Retry-After": quota.resetSeconds.toString(),
            "X-RateLimit-Limit": quota.limit.toString(),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // 2. Enforce Upload Size Limit (Max 4MB)
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Upload payload exceeds maximum allowable size (4 MB)." },
        { status: 413 }
      );
    }

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
        // Enforce MIME check
        const validMimes = ["image/jpeg", "image/png", "image/webp"];
        if (!validMimes.includes(file.type)) {
          return NextResponse.json(
            { error: "Unsupported image format. Please upload JPEG, PNG, or WebP." },
            { status: 415 }
          );
        }

        if (file.size > 4 * 1024 * 1024) {
          return NextResponse.json(
            { error: "Image file exceeds 4 MB." },
            { status: 413 }
          );
        }

        mimeType = file.type;
        const buffer = await file.arrayBuffer();
        imageBase64 = Buffer.from(buffer).toString("base64");
      }
    } else {
      const body = await req.json();
      inputKind = body.inputKind || "text";
      inputText = body.inputText;
      imageBase64 = body.imageBase64;
      mimeType = body.mimeType || "image/jpeg";

      if (imageBase64) {
        // Validate MIME type from base64 header or mimeType field
        const validMimes = ["image/jpeg", "image/png", "image/webp"];
        if (!validMimes.includes(mimeType)) {
          return NextResponse.json(
            { error: "Invalid image format. Supported formats: JPEG, PNG, WebP." },
            { status: 415 }
          );
        }
      }
    }

    if (!inputText && !imageBase64) {
      return NextResponse.json(
        { error: "Please provide either an image, text, or a link to decompose." },
        { status: 400 }
      );
    }

    // 3. Run Decomposition Engine
    const card = await decomposeInput({
      inputKind,
      inputText,
      imageBase64,
      mimeType,
    });

    return NextResponse.json(
      { card, quota: { remaining: quota.remaining, limit: quota.limit } },
      {
        headers: {
          "X-RateLimit-Limit": quota.limit.toString(),
          "X-RateLimit-Remaining": quota.remaining.toString(),
        },
      }
    );
  } catch (error: any) {
    console.error("Scan route error:", error);
    // Sanitize error message to avoid internal info leaks
    const safeMessage = error.message?.includes("Decomposition service")
      ? error.message
      : error.message?.includes("safely fetch")
      ? error.message
      : "Failed to decompose input. Please retry.";

    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
