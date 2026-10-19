import { Entitlements } from "@/types/roots";
import { supabaseAdmin, getServerSetting } from "@/lib/supabase/server";

// Fallback in-memory cache for offline/test instances
const localSubscriptionCache = new Map<string, { plan: "free" | "pro"; cachedAt: number }>();

/**
 * Sets the in-memory cached subscription plan for a user ID.
 */
export function setCachedPlan(userId: string, plan: "free" | "pro"): void {
  localSubscriptionCache.set(userId, { plan, cachedAt: Date.now() });
}

/**
 * Invalidates the cached subscription plan for a specific user ID.
 * Call this immediately after processing billing webhooks or admin updates.
 */
export function invalidateSubscriptionCache(userId: string): void {
  localSubscriptionCache.delete(userId);
}

/**
 * Clears the entire subscription cache.
 */
export function clearSubscriptionCache(): void {
  localSubscriptionCache.clear();
}

/**
 * Authoritatively calculates entitlements for a user on the server.
 * Reads from Supabase `profiles` table and server-controlled operations settings.
 * Resilient against transient database errors: will NOT cache DB failure as a free plan downgrade.
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
        const { data: profile, error } = await supabaseAdmin
          .from("profiles")
          .select("plan")
          .eq("id", userId)
          .single();

        if (!error && profile) {
          plan = profile.plan === "pro" ? "pro" : "free";
          // Only cache when authoritative DB response was successful
          localSubscriptionCache.set(userId, { plan, cachedAt: Date.now() });
        } else if (cached) {
          // If DB returned an error but we have a prior cached entry, preserve it
          plan = cached.plan;
        }
      } catch (err) {
        // Transient network/connection exception: preserve cached plan if available
        if (cached) {
          plan = cached.plan;
        }
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
  invalidateSubscriptionCache(userId);
  localSubscriptionCache.set(userId, { plan, cachedAt: Date.now() });
  try {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ plan, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) {
      invalidateSubscriptionCache(userId);
      return false;
    }
    return true;
  } catch {
    invalidateSubscriptionCache(userId);
    return false;
  }
}
