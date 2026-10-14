import { NextRequest, NextResponse } from "next/server";

interface MistakeReport {
  id: string;
  rootId?: string;
  claimId: string;
  claimText?: string;
  reason?: string;
  createdAt: string;
}

const memoryReports: MistakeReport[] = [];

export async function POST(req: NextRequest) {
  try {
    const { rootId, claimId, claimText, reason } = await req.json();

    if (!claimId) {
      return NextResponse.json({ error: "Missing claimId" }, { status: 400 });
    }

    const report: MistakeReport = {
      id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      rootId,
      claimId,
      claimText,
      reason: reason || "User flagged inaccuracy",
      createdAt: new Date().toISOString(),
    };

    memoryReports.push(report);

    return NextResponse.json({ success: true, reportId: report.id });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to record report" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ reports: memoryReports });
}
