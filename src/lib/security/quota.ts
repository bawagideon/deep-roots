import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { getEntitlements } from "./entitlements";
import { getServerUser, supabaseAdmin } from "@/lib/supabase/server";

/**
 * Derives a privacy-preserving, trusted client identifier for guests.
 * Uses trusted headers (x-real-ip or leftmost x-forwarded-for) hashed with a server salt.
 * Authenticated users are identified by their verified session ID.
 */
export async function getClientIdentifier(req: NextRequest): Promise<{
  clientId: string;
  userId?: string;
  isAnonymous: boolean;
}> {
  const verifiedUser = await getServerUser(req);

  if (verifiedUser?.id) {
    return {
      clientId: `usr_${verifiedUser.id}`,
      userId: verifiedUser.id,
      isAnonymous: false,
    };
  }

  // Trusted proxy IP extraction
  const realIp = req.headers.get("x-real-ip");
  const forwarded = req.headers.get("x-forwarded-for");
  let rawIp = "127.0.0.1";

  if (realIp) {
    rawIp = realIp.trim();
  } else if (forwarded) {
    rawIp = forwarded.split(",")[0].trim();
  }

  const sanitizedIp = rawIp.replace(/[^a-fA-F0-9:.]/g, "");
  const serverSalt = process.env.IP_HASH_SALT || "deep-roots-hardened-salt-v3";
  const ipHash = createHash("sha256")
    .update(`${sanitizedIp}:${serverSalt}`)
    .digest("hex")
    .slice(0, 16);

  return {
    clientId: `gst_${ipHash}`,
    userId: undefined,
    isAnonymous: true,
  };
}

/**
 * Atomically checks and reserves quota for the caller using PostgreSQL transaction locking.
 * FAILS CLOSED: Never silently falls back to an in-memory map in production.
 */
export async function checkAndIncrementQuota(
  clientId: string,
  userId?: string,
  kind: string = "scan"
): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
  resetSeconds: number;
  isKillSwitch?: boolean;
  error?: string;
}> {
  const entitlements = await getEntitlements(userId);

  // Check Kill Switch
  if (entitlements.dailyScanLimit === 0) {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      resetSeconds: 3600,
      isKillSwitch: true,
      error: "SCAN_KILL_SWITCH_ACTIVE",
    };
  }

  const dailyLimit = entitlements.dailyScanLimit;
  const today = new Date().toISOString().split("T")[0];

  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  const resetSeconds = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));

  // Atomic Database RPC call
  try {
    const { data, error } = await supabaseAdmin.rpc("atomic_reserve_quota", {
      p_user_id: clientId,
      p_day: today,
      p_kind: kind,
      p_limit: dailyLimit,
    });

    if (error) {
      console.error("Quota reservation RPC error:", error.message);
      // Fail closed when quota service is unavailable
      return {
        allowed: false,
        remaining: 0,
        limit: dailyLimit,
        resetSeconds,
        error: "QUOTA_SERVICE_UNAVAILABLE",
      };
    }

    if (data && data.length > 0) {
      const res = data[0];
      return {
        allowed: Boolean(res.allowed),
        remaining: Number(res.remaining),
        limit: dailyLimit,
        resetSeconds,
      };
    }

    return {
      allowed: false,
      remaining: 0,
      limit: dailyLimit,
      resetSeconds,
      error: "UNEXPECTED_QUOTA_RESPONSE",
    };
  } catch (err: any) {
    console.error("Database connection failure in quota check:", err);
    // Fail closed
    return {
      allowed: false,
      remaining: 0,
      limit: dailyLimit,
      resetSeconds,
      error: "DATABASE_CONNECTION_ERROR",
    };
  }
}

/**
 * Releases/refunds quota reservation if downstream model call fails.
 */
export async function refundQuota(
  clientId: string,
  kind: string = "scan"
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  try {
    await supabaseAdmin.rpc("refund_quota", {
      p_user_id: clientId,
      p_day: today,
      p_kind: kind,
    });
  } catch (err) {
    console.error("Failed to execute quota refund:", err);
  }
}

/**
 * Checks remaining quota without incrementing.
 */
export async function getQuotaStatus(
  clientId: string,
  userId?: string
): Promise<{
  remaining: number;
  limit: number;
}> {
  const entitlements = await getEntitlements(userId);
  const dailyLimit = entitlements.dailyScanLimit;
  const today = new Date().toISOString().split("T")[0];

  try {
    const { data } = await supabaseAdmin
      .from("usage")
      .select("count")
      .eq("user_id", clientId)
      .eq("day", today)
      .eq("kind", "scan")
      .single();

    const used = data?.count || 0;
    return {
      remaining: Math.max(0, dailyLimit - used),
      limit: dailyLimit,
    };
  } catch {
    return {
      remaining: dailyLimit,
      limit: dailyLimit,
    };
  }
}
