import { NextRequest, NextResponse } from "next/server";
import { getServerUser, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);

  if (!user || user.isAnonymous) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in to upgrade.", redirectTo: "/sign-in" },
      { status: 401 }
    );
  }

  const { cycle = "yearly" } = await req.json().catch(() => ({}));
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  const stripeSecret = process.env.STRIPE_SECRET_KEY;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // 1. Paystack Integration (Default recommended provider)
  if (paystackSecret) {
    try {
      const amount = cycle === "yearly" ? 399900 : 49900; // in kobo / lowest denomination
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email || `${user.id}@deeproots.app`,
          amount,
          metadata: {
            userId: user.id,
            cycle,
          },
          callback_url: `${appUrl}/profile?payment=success`,
        }),
      });

      const data = await response.json();
      if (data.status && data.data?.authorization_url) {
        return NextResponse.json({
          status: "redirect",
          checkoutUrl: data.data.authorization_url,
          reference: data.data.reference,
        });
      }
    } catch (err: any) {
      console.error("Paystack transaction initialization failed:", err);
    }
  }

  // 2. Stripe Integration (Optional secondary provider)
  if (stripeSecret) {
    try {
      const priceId =
        cycle === "yearly"
          ? process.env.STRIPE_YEARLY_PRICE_ID
          : process.env.STRIPE_MONTHLY_PRICE_ID;

      if (priceId) {
        // Stripe checkout session creation
        const params = new URLSearchParams();
        params.append("mode", "subscription");
        params.append("line_items[0][price]", priceId);
        params.append("line_items[0][quantity]", "1");
        params.append("client_reference_id", user.id);
        params.append("success_url", `${appUrl}/profile?payment=success`);
        params.append("cancel_url", `${appUrl}/upgrade`);

        const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeSecret}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        const session = await response.json();
        if (session.url) {
          return NextResponse.json({
            status: "redirect",
            checkoutUrl: session.url,
          });
        }
      }
    } catch (err: any) {
      console.error("Stripe session initialization failed:", err);
    }
  }

  // 3. Sandbox / Awaiting Live Provider Configuration
  return NextResponse.json({
    status: "sandbox",
    message: "Payment gateway credentials pending in environment. Live payments will activate upon adding PAYSTACK_SECRET_KEY or STRIPE_SECRET_KEY.",
    configured: false,
  });
}
