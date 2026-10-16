import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getServerUser, isServerAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { rootId, claimId, claimText, reason } = await req.json();

    if (!claimId) {
      return NextResponse.json({ error: "Missing required field: claimId" }, { status: 400 });
    }

    const user = await getServerUser(req);
    const reportId = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();

    // Durable persistence to Supabase mistake_reports table
    const { error: dbError } = await supabaseAdmin.from("mistake_reports").insert({
      id: reportId,
      user_id: user?.id || null,
      root_id: rootId || null,
      claim_id: claimId,
      claim_text: claimText || null,
      reason: reason || "User flagged inaccuracy",
      status: "pending",
      created_at: nowIso,
    });

    if (dbError) {
      console.error("Durable report persistence error:", dbError);
      return NextResponse.json(
        {
          error: "Failed to persist mistake report to database",
          code: "REPORT_PERSISTENCE_FAILED",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, reportId });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to record report", details: err.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Authorize: Strictly enforce server admin check in all environments
  const user = await getServerUser(req);
  const isAdmin = await isServerAdmin(user);

  if (!isAdmin) {
    return NextResponse.json(
      { error: "Unauthorized access: Admin privileges required" },
      { status: 403 }
    );
  }

  const { data: dbReports, error } = await supabaseAdmin
    .from("mistake_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: "Failed to retrieve mistake reports from database" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    reports: (dbReports || []).map((r: any) => ({
      id: r.id,
      rootId: r.root_id,
      claimId: r.claim_id,
      claimText: r.claim_text,
      reason: r.reason,
      createdAt: r.created_at,
    })),
  });
}
