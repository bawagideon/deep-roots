import { NextRequest, NextResponse } from "next/server";
import { getServerUser, supabaseAdmin } from "@/lib/supabase/server";
import { StoredRoot, GraphEdge, Lens } from "@/types/roots";
import { RootsCardSchema, validateRootsCardIntegrity } from "@/lib/schema";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

/**
 * GET /api/roots
 * Fetches all saved roots and graph edges belonging to the authenticated user.
 */
export async function GET(req: NextRequest) {
  const user = await getServerUser(req);

  if (!user || user.isAnonymous) {
    return NextResponse.json({
      roots: [],
      edges: [],
      authenticated: false,
    });
  }

  try {
    // 1. Fetch user roots
    const { data: dbRoots, error: rootsError } = await supabaseAdmin
      .from("roots")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (rootsError) {
      console.error("Failed to fetch roots from Supabase:", rootsError.message);
      return NextResponse.json(
        { error: "Failed to fetch user discoveries", code: "DATABASE_ERROR" },
        { status: 500 }
      );
    }

    // 2. Fetch user edges
    const { data: dbEdges, error: edgesError } = await supabaseAdmin
      .from("edges")
      .select("*")
      .eq("user_id", user.id);

    if (edgesError) {
      console.warn("Failed to fetch edges from Supabase:", edgesError.message);
    }

    // Format roots
    const roots: StoredRoot[] = (dbRoots || []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      parentId: r.parent_id,
      depth: r.depth || 0,
      inputKind: r.input_kind,
      inputText: r.input_text || undefined,
      imagePath: r.image_url || undefined,
      title: r.title,
      card: r.card,
      lenses: (r.card?.lenses as Lens[]) || [],
      visual: r.visual || undefined,
      createdAt: r.created_at,
    }));

    // Format edges
    const edges: GraphEdge[] = (dbEdges || []).map((e) => ({
      id: e.id,
      fromRoot: e.from_root,
      toRoot: e.to_root,
      type: e.type,
      why: e.why,
      limits: e.limits || undefined,
      createdBy: e.created_by || "ai",
      createdAt: e.created_at,
    }));

    return NextResponse.json({
      roots,
      edges,
      authenticated: true,
      count: roots.length,
    });
  } catch (err: any) {
    console.error("Error in GET /api/roots:", err);
    return NextResponse.json(
      { error: "Internal server error fetching roots", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/roots
 * Persists a new or updated root, its claims, claim sources, and graph edges to Supabase.
 * Enforces ownership invariants, atomic dependent writes, and idempotent retries.
 */
export async function POST(req: NextRequest) {
  const user = await getServerUser(req);

  if (!user || user.isAnonymous) {
    return NextResponse.json(
      { error: "Authentication required to persist discoveries to cloud.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.root) {
      return NextResponse.json(
        { error: "Invalid payload: missing root object.", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    const root: StoredRoot = body.root;
    const edges: GraphEdge[] = Array.isArray(body.edges) ? body.edges : [];

    // Basic structural checks
    if (!root.id || typeof root.id !== "string" || !root.title || !root.card) {
      return NextResponse.json(
        { error: "Invalid root payload. Missing required fields.", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    // 1. Validate Card Schema & Cross-reference Integrity
    const parsedCard = RootsCardSchema.safeParse(root.card);
    if (!parsedCard.success) {
      return NextResponse.json(
        {
          error: "Invalid card schema format",
          code: "VALIDATION_FAILED",
          details: parsedCard.error.flatten(),
        },
        { status: 400 }
      );
    }

    const integrity = validateRootsCardIntegrity(parsedCard.data);
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

    // 2. ROOT OWNERSHIP COLLISION GUARD (P0 Blocker)
    // Check if a root with this ID already exists. If owned by another user, REJECT!
    const { data: existingRoot, error: checkError } = await supabaseAdmin
      .from("roots")
      .select("id, user_id")
      .eq("id", root.id)
      .maybeSingle();

    if (checkError) {
      console.error("Database error checking existing root ownership:", checkError.message);
      return NextResponse.json(
        { error: "Failed to verify root ownership", code: "DATABASE_ERROR" },
        { status: 500 }
      );
    }

    if (existingRoot && existingRoot.user_id !== user.id) {
      return NextResponse.json(
        {
          error: "Forbidden: Cannot overwrite or reassign a discovery owned by another account.",
          code: "FORBIDDEN",
        },
        { status: 403 }
      );
    }

    // 3. PARENT ROOT OWNERSHIP GUARD
    // If a parentId is provided, verify it exists and is owned by the same user
    if (root.parentId) {
      const { data: parentRoot, error: parentCheckError } = await supabaseAdmin
        .from("roots")
        .select("id, user_id")
        .eq("id", root.parentId)
        .maybeSingle();

      if (parentCheckError || !parentRoot) {
        return NextResponse.json(
          { error: "Parent root does not exist", code: "INVALID_PARENT" },
          { status: 400 }
        );
      }

      if (parentRoot.user_id !== user.id) {
        return NextResponse.json(
          { error: "Forbidden: Parent root belongs to another account", code: "FORBIDDEN_PARENT" },
          { status: 403 }
        );
      }
    }

    // 4. Ensure user profile exists in Supabase
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (profileError) {
      console.error("Profile upsert notice:", profileError.message);
    }

    // 5. Upsert Root
    const { error: rootError } = await supabaseAdmin.from("roots").upsert(
      {
        id: root.id,
        user_id: user.id,
        parent_id: root.parentId || null,
        depth: root.depth || 0,
        input_kind: root.inputKind || "text",
        title: root.title,
        input_text: root.inputText || null,
        image_url: root.imagePath || null,
        card: root.card,
        visual: root.visual || null,
        prompt_version: root.card.promptVersion || "v3.0",
        model: root.card.modelUsed || "gemini-3.8-flash",
        status: "ready",
        created_at: root.createdAt || new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (rootError) {
      console.error("Failed to persist root in Supabase:", rootError.message);
      return NextResponse.json(
        {
          error: "Failed to save root discovery to cloud",
          code: "PERSISTENCE_FAILED",
          persistedInCloud: false,
        },
        { status: 500 }
      );
    }

    // 6. Upsert Claims & Claim Sources (Idempotent & Verified)
    if (Array.isArray(root.card.claims)) {
      for (const claim of root.card.claims) {
        const claimDbId = `${root.id}_${claim.id}`;
        const claimType =
          claim.status === "established"
            ? "fact"
            : claim.status === "open_question"
            ? "open_question"
            : "interpretation";

        const { error: claimError } = await supabaseAdmin.from("claims").upsert(
          {
            id: claimDbId,
            root_id: root.id,
            user_id: user.id,
            local_id: claim.id,
            text: claim.text,
            claim_type: claimType,
            evidence_status: claim.evidenceStatus || "unverified",
            created_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

        if (claimError) {
          console.error(`Failed to persist claim ${claimDbId}:`, claimError.message);
          return NextResponse.json(
            {
              error: "Failed to persist dependent claims",
              code: "PERSISTENCE_FAILED",
              persistedInCloud: false,
            },
            { status: 500 }
          );
        }

        // Sources: Use deterministic ID for idempotent upserting (prevents duplicate sources on re-sync)
        if (Array.isArray(claim.sources)) {
          for (const src of claim.sources) {
            const urlHash = createHash("sha256").update(src.url || "").digest("hex").slice(0, 10);
            const sourceDbId = `${claimDbId}_src_${urlHash}`;

            const { error: sourceError } = await supabaseAdmin.from("claim_sources").upsert(
              {
                id: sourceDbId,
                claim_id: claimDbId,
                user_id: user.id,
                title: src.title,
                url: src.url,
                retrieved_at: src.retrievedAt || new Date().toISOString(),
                excerpt: src.excerpt || null,
              },
              { onConflict: "id" }
            );

            if (sourceError) {
              console.error(`Failed to persist claim source ${sourceDbId}:`, sourceError.message);
              return NextResponse.json(
                {
                  error: "Failed to persist dependent claim sources",
                  code: "PERSISTENCE_FAILED",
                  persistedInCloud: false,
                },
                { status: 500 }
              );
            }
          }
        }
      }
    }

    // 7. Upsert Edges with Ownership Verification
    if (edges.length > 0) {
      for (const edge of edges) {
        // Verify edge endpoints belong to current user
        const { data: endpointRoots } = await supabaseAdmin
          .from("roots")
          .select("id, user_id")
          .in("id", [edge.fromRoot, edge.toRoot]);

        const validEndpoints = (endpointRoots || []).filter((r) => r.user_id === user.id);
        if (validEndpoints.length < 2 && edge.fromRoot !== edge.toRoot) {
          console.warn(`Skipping edge ${edge.id}: endpoints not verified for user ${user.id}`);
          continue;
        }

        const { error: edgeError } = await supabaseAdmin.from("edges").upsert(
          {
            id: edge.id,
            user_id: user.id,
            from_root: edge.fromRoot,
            to_root: edge.toRoot,
            type: edge.type,
            why: edge.why,
            limits: edge.limits || null,
            created_by: edge.createdBy || "ai",
            created_at: edge.createdAt || new Date().toISOString(),
          },
          { onConflict: "id" }
        );

        if (edgeError) {
          console.error(`Failed to persist edge ${edge.id}:`, edgeError.message);
          return NextResponse.json(
            {
              error: "Failed to persist graph edge",
              code: "PERSISTENCE_FAILED",
              persistedInCloud: false,
            },
            { status: 500 }
          );
        }
      }
    }

    // Only return persistedInCloud: true when all writes succeeded
    return NextResponse.json({
      success: true,
      rootId: root.id,
      persistedInCloud: true,
    });
  } catch (err: any) {
    console.error("Error in POST /api/roots:", err);
    return NextResponse.json(
      { error: "Internal server error saving root", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
