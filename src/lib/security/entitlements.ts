import { Entitlements } from "@/types/roots";

// In-memory subscription store for server-side evaluation (mirrors DB)
const subscriptionStore = new Map<string, { plan: "free" | "pro"; expiresAt?: string }>();

export function getEntitlements(userId?: string): Entitlements {
  const isKillSwitchActive = process.env.NEXT_PUBLIC_SCAN_KILL_SWITCH === "true";

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

  const sub = userId ? subscriptionStore.get(userId) : null;
  const isPro = sub?.plan === "pro";

  if (isPro) {
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

  // Free Tier defaults
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

export function setSubscription(userId: string, plan: "free" | "pro"): void {
  subscriptionStore.set(userId, { plan });
}
