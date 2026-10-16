import { NextRequest, NextResponse } from "next/server";
import { getServerUser, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);

  if (!user || user.isAnonymous) {
    return NextResponse.json(
      { error: "Authentication required to restore purchases." },
      { status: 401 }
    );
  }

  try {
    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (subscription && subscription.status === "active") {
      // Ensure profile matches active subscription
      await supabaseAdmin
        .from("profiles")
        .update({ plan: "pro" })
        .eq("id", user.id);

      return NextResponse.json({
        restored: true,
        plan: "pro",
        status: "active",
      });
    }

    return NextResponse.json({
      restored: false,
      plan: "free",
      message: "No active subscription found on file for this account.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to check subscription status", details: err.message },
      { status: 500 }
    );
  }
}
