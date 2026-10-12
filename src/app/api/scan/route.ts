import { NextRequest, NextResponse } from "next/server";
import { decomposeInput } from "@/lib/ai/decomposition";

export async function POST(req: NextRequest) {
  try {
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
        mimeType = file.type || "image/jpeg";
        const buffer = await file.arrayBuffer();
        imageBase64 = Buffer.from(buffer).toString("base64");
      }
    } else {
      const body = await req.json();
      inputKind = body.inputKind || "text";
      inputText = body.inputText;
      imageBase64 = body.imageBase64;
      mimeType = body.mimeType || "image/jpeg";
    }

    if (!inputText && !imageBase64) {
      return NextResponse.json(
        { error: "Please provide either an image, text, or a link to decompose." },
        { status: 400 }
      );
    }

    const card = await decomposeInput({
      inputKind,
      inputText,
      imageBase64,
      mimeType,
    });

    return NextResponse.json({ card });
  } catch (error: any) {
    console.error("Scan API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to decompose input. Please retry." },
      { status: 500 }
    );
  }
}
