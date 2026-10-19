import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Verifies Svix webhook signatures using native crypto without external runtime dependencies.
 */
function verifySvixSignature(
  payload: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string
): boolean {
  if (!headers.id || !headers.timestamp || !headers.signature) return false;

  // Verify timestamp within 5 minutes to prevent replay attacks
  const ts = parseInt(headers.timestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return false;
  }

  try {
    const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    const secretKey = Buffer.from(rawSecret, "base64");
    const signedPayload = `${headers.id}.${headers.timestamp}.${payload}`;
    const hmac = crypto.createHmac("sha256", secretKey);
    hmac.update(signedPayload);
    const expectedSig = hmac.digest("base64");

    const passedSigs = headers.signature.split(" ");
    return passedSigs.some((sig) => {
      const parts = sig.split(",");
      const sigValue = parts.length > 1 ? parts[1] : parts[0];
      return crypto.timingSafeEqual(Buffer.from(sigValue), Buffer.from(expectedSig));
    });
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return false;
  }
}

/**
 * POST /api/webhooks/clerk
 * Handles Clerk user lifecycle events:
 * - user.created: Initializes user profile
 * - user.updated: Syncs display name and avatar
 * - user.deleted: Purges all user data across all tables (GDPR / Right to be Forgotten)
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  const rawBody = await req.text();

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (webhookSecret) {
    const isValid = verifySvixSignature(
      rawBody,
      { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      webhookSecret
    );
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 400 }
      );
    }
  }

  let event: { type: string; data: any };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { type, data } = event;
  const userId = data?.id;

  if (!userId) {
    return NextResponse.json({ error: "Missing user id in event data" }, { status: 400 });
  }

  try {
    switch (type) {
      case "user.created": {
        const displayName =
          `${data.first_name || ""} ${data.last_name || ""}`.trim() ||
          data.username ||
          data.email_addresses?.[0]?.email_address?.split("@")[0] ||
          "Explorer";

        await supabaseAdmin.from("profiles").upsert(
          {
            id: userId,
            display_name: displayName,
            avatar_url: data.image_url || null,
            role: "user",
            plan: "free",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
        break;
      }

      case "user.updated": {
        const displayName =
          `${data.first_name || ""} ${data.last_name || ""}`.trim() ||
          data.username ||
          undefined;

        const updates: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (displayName) updates.display_name = displayName;
        if (data.image_url) updates.avatar_url = data.image_url;

        await supabaseAdmin.from("profiles").update(updates).eq("id", userId);
        break;
      }

      case "user.deleted": {
        // Deep purge of all personal data across all database tables
        console.log(`Purging all data for deleted user: ${userId}`);

        await Promise.allSettled([
          supabaseAdmin.from("claims").delete().eq("user_id", userId),
          supabaseAdmin.from("claim_sources").delete().eq("user_id", userId),
          supabaseAdmin.from("edges").delete().eq("user_id", userId),
          supabaseAdmin.from("roots").delete().eq("user_id", userId),
          supabaseAdmin.from("usage").delete().eq("user_id", userId),
          supabaseAdmin.from("analysis_runs").delete().eq("user_id", userId),
          supabaseAdmin.from("mistake_reports").delete().eq("user_id", userId),
          supabaseAdmin.from("profiles").delete().eq("id", userId),
        ]);
        break;
      }

      default:
        // Ignore unhandled events
        break;
    }

    return NextResponse.json({ success: true, processed: type });
  } catch (err: any) {
    console.error(`Error processing Clerk webhook ${type}:`, err);
    return NextResponse.json(
      { error: "Webhook handler failed", details: err.message },
      { status: 500 }
    );
  }
}
