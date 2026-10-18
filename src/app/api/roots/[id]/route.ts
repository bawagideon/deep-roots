import { NextRequest, NextResponse } from "next/server";
import { getServerUser, isServerAdmin, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/roots/[id]
 * Retrieves a single root from Supabase by ID.
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
      .single();

    if (error || !root) {
      return NextResponse.json({ error: "Root not found" }, { status: 404 });
    }

    // Access control: if root belongs to a specific user, ensure requester is owner or admin
    if (root.user_id && (!user || (user.id !== root.user_id && !(await isServerAdmin(user))))) {
      return NextResponse.json({ error: "Access denied to private root" }, { status: 403 });
    }

    return NextResponse.json({ root });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/roots/[id]
 * Deletes a root and its associated edges from Supabase.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const rootId = params.id;
  const user = await getServerUser(req);

  if (!user || user.isAnonymous) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const isAdmin = await isServerAdmin(user);

  try {
    // 1. Fetch root to verify ownership
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("roots")
      .select("user_id")
      .eq("id", rootId)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Root not found" }, { status: 404 });
    }

    if (existing.user_id !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Cannot delete discoveries belonging to another account" },
        { status: 403 }
      );
    }

    // 2. Delete root (cascades to claims and edges in PostgreSQL)
    const { error: delErr } = await supabaseAdmin
      .from("roots")
      .delete()
      .eq("id", rootId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    // Also delete any edges where this root was from or to
    await supabaseAdmin
      .from("edges")
      .delete()
      .or(`from_root.eq.${rootId},to_root.eq.${rootId}`);

    return NextResponse.json({ success: true, deletedId: rootId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
