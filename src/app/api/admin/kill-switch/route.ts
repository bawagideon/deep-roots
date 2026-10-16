import { NextRequest, NextResponse } from "next/server";
import { getServerUser, isServerAdmin, getServerSetting, setServerSetting } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  const isAdmin = await isServerAdmin(user);

  if (!isAdmin) {
    return NextResponse.json(
      { error: "Unauthorized: Admin privileges required" },
      { status: 403 }
    );
  }

  const active = await getServerSetting("scan_kill_switch", false);
  return NextResponse.json({ active });
}

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  const isAdmin = await isServerAdmin(user);

  if (!isAdmin) {
    return NextResponse.json(
      { error: "Unauthorized: Admin privileges required" },
      { status: 403 }
    );
  }

  const { active } = await req.json();
  const success = await setServerSetting("scan_kill_switch", !!active);

  return NextResponse.json({ success, active: !!active });
}
