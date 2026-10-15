import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getServerUser, isServerAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface MistakeReport {
  id: string;
  rootId?: string;
  claimId: string;
  claimText?: string;
  reason?: string;
  createdAt: string;
}

const memoryReportsFallback: MistakeReport[] = [];

export async function POST(req: NextRequest) {
  try {
    const { rootId, claimId, claimText, reason } = await req.json();

    if (!claimId) {
      return NextResponse.json({ error: "Missing claimId" }, { status: 400 });
    }

    const user = await getServerUser(req);
    const reportId = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();

    const report: MistakeReport = {
      id: reportId,
      rootId,
      claimId,
      claimText,
      reason: reason || "User flagged inaccuracy",
      createdAt: nowIso,
    };

    // 1. Try persisting to Supabase mistake_reports table
    try {
      await supabaseAdmin.from("mistake_reports").insert({
        id: reportId,
        user_id: user?.id || null,
        root_id: rootId || null,
        claim_id: claimId,
        claim_text: claimText || null,
        reason: reason || "User flagged inaccuracy",
        status: "pending",
        created_at: nowIso,
      });
    } catch (err) {
      console.warn("Supabase report insert fallback:", err);
    }

    // 2. Keep in memory fallback
    memoryReportsFallback.unshift(report);
    if (memoryReportsFallback.length > 100) memoryReportsFallback.pop();

    return NextResponse.json({ success: true, reportId });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to record report" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Authorize: Only server admins can view mistake reports
  const user = await getServerUser(req);
  const isAdmin = await isServerAdmin(user);

  if (!isAdmin && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Unauthorized access to mistake reports" },
      { status: 403 }
    );
  }

  try {
    const { data: dbReports, error } = await supabaseAdmin
      .from("mistake_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && dbReports && dbReports.length > 0) {
      return NextResponse.json({
        reports: dbReports.map((r: any) => ({
          id: r.id,
          rootId: r.root_id,
          claimId: r.claim_id,
          claimText: r.claim_text,
          reason: r.reason,
          createdAt: r.created_at,
        })),
      });
    }
  } catch {}

  return NextResponse.json({ reports: memoryReportsFallback });
}
