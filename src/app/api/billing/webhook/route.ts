import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const paystackSignature = req.headers.get("x-paystack-signature");
  const stripeSignature = req.headers.get("stripe-signature");

  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let verified = false;
  let eventType = "";
  let eventId = "";
  let userId = "";
  let provider = "";
  let payload: any = {};

  // 1. Verify Paystack Webhook Signature
  if (paystackSignature && paystackSecret) {
    const hash = createHmac("sha512", paystackSecret).update(rawBody).digest("hex");
    if (hash === paystackSignature) {
      verified = true;
      provider = "paystack";
      try {
        payload = JSON.parse(rawBody);
        eventType = payload.event;
        eventId = `pstk_${payload.data?.id || payload.data?.reference || Date.now()}`;
        userId = payload.data?.metadata?.userId;
      } catch {}
    }
  }

  // 2. Verify Stripe Webhook Signature
  if (!verified && stripeSignature && stripeWebhookSecret) {
    // Basic Stripe signature verification
    const sigParts = stripeSignature.split(",").reduce((acc: any, part: string) => {
      const [k, v] = part.split("=");
      acc[k] = v;
      return acc;
    }, {});

    const expectedSig = createHmac("sha256", stripeWebhookSecret)
      .update(`${sigParts.t}.${rawBody}`)
      .digest("hex");

    if (expectedSig === sigParts.v1) {
      verified = true;
      provider = "stripe";
      try {
        payload = JSON.parse(rawBody);
        eventType = payload.type;
        eventId = `strp_${payload.id}`;
        userId = payload.data?.object?.client_reference_id;
      } catch {}
    }
  }

  if (!verified) {
    return NextResponse.json(
      { error: "Invalid webhook signature or unconfigured webhook secret" },
      { status: 401 }
    );
  }

  // 3. Idempotent Event Recording
  const { data: existingEvent } = await supabaseAdmin
    .from("billing_events")
    .select("provider_event_id")
    .eq("provider_event_id", eventId)
    .single();

  if (existingEvent) {
    return NextResponse.json({ received: true, note: "Event already processed" });
  }

  await supabaseAdmin.from("billing_events").insert({
    provider_event_id: eventId,
    provider,
    event_type: eventType,
    payload,
    processed_at: new Date().toISOString(),
  });

  // 4. Handle Successful Subscription / Charge
  const isSuccessEvent =
    eventType === "charge.success" ||
    eventType === "subscription.create" ||
    eventType === "checkout.session.completed";

  if (isSuccessEvent && userId) {
    // Authoritatively upgrade user's plan in Supabase
    await supabaseAdmin
      .from("profiles")
      .update({
        plan: "pro",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    // Upsert subscription record
    await supabaseAdmin.from("subscriptions").upsert({
      user_id: userId,
      provider,
      provider_customer_id: payload.data?.customer?.customer_code || payload.data?.object?.customer || null,
      provider_subscription_id: eventId,
      plan: "pro",
      status: "active",
      current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ received: true });
}
