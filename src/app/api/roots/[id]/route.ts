import { NextRequest, NextResponse } from "next/server";
import { getServerUser, isServerAdmin, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/roots/[id]
 * Retrieves a single root from Supabase by ID.
 * Strictly verifies privacy and authorization.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const rootId = params.id;
  const user = await getServerUser(req);

  try {
    const { data: root, error } = await supabaseAdmin
      .from("roots")
      .select("*")
      .eq("id", rootId)
      .maybeSingle();

    if (error || !root) {
      return NextResponse.json({ error: "Root discovery not found", code: "NOT_FOUND" }, { status: 404 });
    }

    // Access control: if root belongs to a specific user, ensure requester is owner or admin
    if (root.user_id) {
      const isOwner = user && user.id === root.user_id;
      const isAdmin = user ? await isServerAdmin(user) : false;

      if (!isOwner && !isAdmin) {
        return NextResponse.json(
          { error: "Access denied to private discovery", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ root });
  } catch (err: any) {
    console.error(`Error in GET /api/roots/${rootId}:`, err);
    return NextResponse.json(
      { error: "Internal server error fetching root", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/roots/[id]
 * Deletes a root and its associated edges from Supabase.
 * Strictly scoped to the authenticated owner's data.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const rootId = params.id;
  const user = await getServerUser(req);

  if (!user || user.isAnonymous) {
    return NextResponse.json(
      { error: "Authentication required to delete discoveries", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const isAdmin = await isServerAdmin(user);

  try {
    // 1. Fetch root to verify ownership
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("roots")
      .select("id, user_id")
      .eq("id", rootId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json(
        { error: "Root discovery not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (existing.user_id !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Cannot delete discoveries belonging to another account", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // 2. Delete root (scoped to user_id to ensure atomicity and safety)
    const query = supabaseAdmin.from("roots").delete().eq("id", rootId);
    if (!isAdmin) {
      query.eq("user_id", user.id);
    }
    const { error: delErr } = await query;

    if (delErr) {
      console.error(`Failed to delete root ${rootId}:`, delErr.message);
      return NextResponse.json(
        { error: "Failed to delete root discovery", code: "DATABASE_ERROR" },
        { status: 500 }
      );
    }

    // 3. Delete dependent claims and claim sources
    await supabaseAdmin.from("claims").delete().eq("root_id", rootId);

    // 4. Delete associated edges scoped to authorized user
    const edgeQuery = supabaseAdmin
      .from("edges")
      .delete()
      .or(`from_root.eq.${rootId},to_root.eq.${rootId}`);

    if (!isAdmin) {
      edgeQuery.eq("user_id", user.id);
    }
    const { error: edgeDelErr } = await edgeQuery;

    if (edgeDelErr) {
      console.warn("Notice deleting associated edges:", edgeDelErr.message);
    }

    return NextResponse.json({ success: true, deletedId: rootId });
  } catch (err: any) {
    console.error(`Error in DELETE /api/roots/${rootId}:`, err);
    return NextResponse.json(
      { error: "Internal server error deleting root", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
