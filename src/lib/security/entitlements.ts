import { Entitlements } from "@/types/roots";
import { supabaseAdmin, getServerSetting } from "@/lib/supabase/server";

// Fallback in-memory cache for offline/test instances
const localSubscriptionCache = new Map<string, { plan: "free" | "pro"; cachedAt: number }>();

/**
 * Authoritatively calculates entitlements for a user on the server.
 * Reads from Supabase `profiles` table and server-controlled operations settings.
 */
export async function getEntitlements(userId?: string): Promise<Entitlements> {
  // 1. Check server-controlled kill switch
  const isKillSwitchActive = await getServerSetting("scan_kill_switch", false);

  if (isKillSwitchActive) {
    return {
      plan: "free",
      dailyScanLimit: 0, // Disabled
      maxRabbitDepth: 0,
      allClaimsEvidence: false,
      fullUnexpectedConnections: false,
      canExportTree: false,
      unwatermarkedShares: false,
      personalizedDailyRoot: false,
    };
  }

  // 2. Determine Plan
  let plan: "free" | "pro" = "free";

  if (userId) {
    // Check in-memory cache first (TTL 60 seconds)
    const cached = localSubscriptionCache.get(userId);
    if (cached && Date.now() - cached.cachedAt < 60000) {
      plan = cached.plan;
    } else {
      try {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("plan")
          .eq("id", userId)
          .single();

        if (profile?.plan === "pro") {
          plan = "pro";
        }
        localSubscriptionCache.set(userId, { plan, cachedAt: Date.now() });
      } catch (err) {
        // Fallback to cached or free plan if database is unreachable
      }
    }
  }

  // 3. Pro Entitlements
  if (plan === "pro") {
    return {
      plan: "pro",
      dailyScanLimit: 50, // Generous fair-use cap
      maxRabbitDepth: 5,
      allClaimsEvidence: true,
      fullUnexpectedConnections: true,
      canExportTree: true,
      unwatermarkedShares: true,
      personalizedDailyRoot: true,
    };
  }

  // 4. Free Tier Defaults
  return {
    plan: "free",
    dailyScanLimit: 5,
    maxRabbitDepth: 3,
    allClaimsEvidence: false,
    fullUnexpectedConnections: false,
    canExportTree: false,
    unwatermarkedShares: false,
    personalizedDailyRoot: false,
  };
}

export async function setSubscription(userId: string, plan: "free" | "pro"): Promise<boolean> {
  localSubscriptionCache.set(userId, { plan, cachedAt: Date.now() });
  try {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ plan, updated_at: new Date().toISOString() })
      .eq("id", userId);
    return !error;
  } catch {
    return false;
  }
}
