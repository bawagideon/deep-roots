import { NextRequest, NextResponse } from "next/server";
import { getServerUser, supabaseAdmin } from "@/lib/supabase/server";
import { StoredRoot, GraphEdge, Lens } from "@/types/roots";

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
        { error: "Failed to fetch user discoveries", details: rootsError.message },
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
      { error: "Internal server error fetching roots", details: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/roots
 * Persists a new or updated root, its claims, claim sources, and graph edges to Supabase.
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
    const body = await req.json();
    const root: StoredRoot = body.root;
    const edges: GraphEdge[] = body.edges || [];

    if (!root || !root.id || !root.title || !root.card) {
      return NextResponse.json(
        { error: "Invalid root payload. Missing required fields.", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    // 1. Ensure user profile exists in Supabase
    await supabaseAdmin.from("profiles").upsert(
      {
        id: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    // 2. Upsert Root
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
      console.error("Failed to persist root in Supabase:", rootError);
      return NextResponse.json(
        { error: "Failed to save root discovery to cloud", details: rootError.message },
        { status: 500 }
      );
    }

    // 3. Upsert Claims & Claim Sources
    if (Array.isArray(root.card.claims)) {
      for (const claim of root.card.claims) {
        const claimDbId = `${root.id}_${claim.id}`;
        const claimType =
          claim.status === "established"
            ? "fact"
            : claim.status === "open_question"
            ? "open_question"
            : "interpretation";

        await supabaseAdmin.from("claims").upsert(
          {
            id: claimDbId,
            root_id: root.id,
            local_id: claim.id,
            text: claim.text,
            claim_type: claimType,
            evidence_status: claim.evidenceStatus || "unverified",
            created_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

        // Sources
        if (Array.isArray(claim.sources)) {
          for (const src of claim.sources) {
            await supabaseAdmin.from("claim_sources").insert({
              claim_id: claimDbId,
              title: src.title,
              url: src.url,
              retrieved_at: src.retrievedAt || new Date().toISOString(),
              excerpt: src.excerpt || null,
            });
          }
        }
      }
    }

    // 4. Upsert Edges
    if (edges.length > 0) {
      for (const edge of edges) {
        await supabaseAdmin.from("edges").upsert(
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
      }
    }

    return NextResponse.json({
      success: true,
      rootId: root.id,
      persistedInCloud: true,
    });
  } catch (err: any) {
    console.error("Error in POST /api/roots:", err);
    return NextResponse.json(
      { error: "Internal server error saving root", details: err.message },
      { status: 500 }
    );
  }
}
