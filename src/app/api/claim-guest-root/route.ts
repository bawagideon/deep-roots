import { NextRequest, NextResponse } from "next/server";
import { getServerUser, supabaseAdmin } from "@/lib/supabase/server";
import { RootsCardSchema, validateRootsCardIntegrity } from "@/lib/schema";
import { StoredRoot, Lens } from "@/types/roots";

export const dynamic = "force-dynamic";

/**
 * POST /api/claim-guest-root
 * Claims a guest discovery card after user registration/sign-in.
 * Strictly verifies authentication, validates the card schema, and persists
 * the discovery into the user's private Supabase Tree under their verified user_id.
 */
export async function POST(req: NextRequest) {
  const user = await getServerUser(req);

  if (!user || user.isAnonymous) {
    return NextResponse.json(
      { error: "Authentication required to claim guest discovery.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { card, visual, title, inputKind, inputText, imagePath } = body;

    if (!card) {
      return NextResponse.json(
        { error: "Missing required discovery card in request body.", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    // 1. Validate Schema
    const parseResult = RootsCardSchema.safeParse(card);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid card schema format",
          code: "VALIDATION_FAILED",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const validatedCard = parseResult.data;

    // 2. Cross-reference integrity check
    const integrity = validateRootsCardIntegrity(validatedCard);
    if (!integrity.isValid) {
      return NextResponse.json(
        {
          error: "Card integrity check failed",
          code: "INTEGRITY_FAILED",
          details: integrity.errors,
        },
        { status: 400 }
      );
    }

    // 3. Construct Stored Root
    const rootId = body.id || `root_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const rootTitle = title || validatedCard.title;
    const createdAt = new Date().toISOString();

    const storedRoot: StoredRoot = {
      id: rootId,
      userId: user.id,
      depth: 0,
      inputKind: inputKind || validatedCard.inputKind || "text",
      inputText: inputText || undefined,
      imagePath: imagePath || undefined,
      title: rootTitle,
      card: validatedCard,
      lenses: (validatedCard.lenses as Lens[]) || [],
      visual: visual || undefined,
      createdAt,
    };

    // 4. Ensure profile exists in Supabase
    await supabaseAdmin.from("profiles").upsert(
      {
        id: user.id,
        updated_at: createdAt,
      },
      { onConflict: "id" }
    );

    // 5. Insert Root into Supabase
    const { error: rootError } = await supabaseAdmin.from("roots").upsert(
      {
        id: storedRoot.id,
        user_id: user.id,
        parent_id: null,
        depth: 0,
        input_kind: storedRoot.inputKind,
        title: storedRoot.title,
        input_text: storedRoot.inputText || null,
        image_url: storedRoot.imagePath || null,
        card: storedRoot.card,
        visual: storedRoot.visual || null,
        prompt_version: "v4.0",
        model: "gemini-3.8-flash",
        status: "ready",
        created_at: createdAt,
      },
      { onConflict: "id" }
    );

    if (rootError) {
      console.error("Failed to insert claimed root into Supabase:", rootError);
      return NextResponse.json(
        { error: "Failed to persist claimed root to cloud database.", details: rootError.message },
        { status: 500 }
      );
    }

    // 6. Insert Claims & Sources
    if (Array.isArray(validatedCard.claims)) {
      for (const claim of validatedCard.claims) {
        const claimDbId = `${storedRoot.id}_${claim.id}`;
        await supabaseAdmin.from("claims").upsert(
          {
            id: claimDbId,
            root_id: storedRoot.id,
            user_id: user.id,
            local_id: claim.id,
            text: claim.text,
            claim_type: claim.status === "established" ? "fact" : claim.status,
            evidence_status: claim.evidenceStatus || "unverified",
            created_at: createdAt,
          },
          { onConflict: "id" }
        );

        if (Array.isArray(claim.sources)) {
          for (const src of claim.sources) {
            await supabaseAdmin.from("claim_sources").insert({
              claim_id: claimDbId,
              user_id: user.id,
              title: src.title,
              url: src.url,
              retrieved_at: src.retrievedAt || createdAt,
              excerpt: src.excerpt || null,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Guest root successfully claimed and planted into your Tree.",
      root: storedRoot,
    });
  } catch (err: any) {
    console.error("Error claiming guest root:", err);
    return NextResponse.json(
      { error: "Internal server error claiming root", details: err.message },
      { status: 500 }
    );
  }
}
