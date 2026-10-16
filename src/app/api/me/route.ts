import { NextRequest, NextResponse } from "next/server";
import { getServerUser, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);

  if (!user) {
    return NextResponse.json({
      authenticated: false,
      isAnonymous: true,
      plan: "free",
      role: "user",
    });
  }

  let plan = "free";
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan, role, display_name")
      .eq("id", user.id)
      .single();

    if (profile?.plan) plan = profile.plan;
  } catch {}

  return NextResponse.json({
    authenticated: true,
    userId: user.id,
    email: user.email,
    plan,
    role: user.role || "user",
    isAnonymous: false,
  });
}
