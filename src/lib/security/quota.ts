import { NextRequest } from "next/server";
import { getEntitlements } from "./entitlements";
import { getServerUser, supabaseAdmin } from "@/lib/supabase/server";

interface QuotaRecord {
  date: string; // YYYY-MM-DD
  count: number;
}

// Memory fallback store for local development or database fallback
const fallbackQuotaStore = new Map<string, QuotaRecord>();

/**
 * Authoritatively identifies the caller.
 * Uses verified Supabase auth session. If anonymous/unauthenticated, derives IP-based ID.
 * NEVER trusts unverified x-user-id headers!
 */
export async function getClientIdentifier(req: NextRequest): Promise<{
  clientId: string;
  userId?: string;
  isAnonymous: boolean;
}> {
  const verifiedUser = await getServerUser(req);

  if (verifiedUser?.id) {
    return {
      clientId: `user:${verifiedUser.id}`,
      userId: verifiedUser.id,
      isAnonymous: verifiedUser.isAnonymous || false,
    };
  }

  // Fallback to client IP for unauthenticated requests
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
  const sanitizedIp = ip.replace(/[^a-fA-F0-9:.]/g, "");

  return {
    clientId: `ip:${sanitizedIp}`,
    userId: undefined,
    isAnonymous: true,
  };
}

/**
 * Atomically checks and reserves quota for the caller.
 * Checks Supabase `usage` table or database RPC, falling back to local store.
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
    };
  }

  const dailyLimit = entitlements.dailyScanLimit;
  const today = new Date().toISOString().split("T")[0];

  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  const resetSeconds = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));

  // Try Database Atomic RPC first
  try {
    const { data, error } = await supabaseAdmin.rpc("atomic_reserve_quota", {
      p_user_id: clientId,
      p_day: today,
      p_kind: kind,
      p_limit: dailyLimit,
    });

    if (!error && data && data.length > 0) {
      const res = data[0];
      return {
        allowed: res.allowed,
        remaining: res.remaining,
        limit: dailyLimit,
        resetSeconds,
      };
    }
  } catch (err) {
    // If RPC is not created yet, fall back to memory store
  }

  // In-memory fallback
  const record = fallbackQuotaStore.get(clientId);

  if (!record || record.date !== today) {
    fallbackQuotaStore.set(clientId, { date: today, count: 1 });
    return {
      allowed: true,
      remaining: Math.max(0, dailyLimit - 1),
      limit: dailyLimit,
      resetSeconds,
    };
  }

  if (record.count >= dailyLimit) {
    return {
      allowed: false,
      remaining: 0,
      limit: dailyLimit,
      resetSeconds,
    };
  }

  record.count += 1;
  fallbackQuotaStore.set(clientId, record);

  return {
    allowed: true,
    remaining: Math.max(0, dailyLimit - record.count),
    limit: dailyLimit,
    resetSeconds,
  };
}

/**
 * Releases/refunds quota reservation if model call fails.
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
  } catch {}

  const record = fallbackQuotaStore.get(clientId);
  if (record && record.date === today && record.count > 0) {
    record.count -= 1;
    fallbackQuotaStore.set(clientId, record);
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
  const record = fallbackQuotaStore.get(clientId);

  if (!record || record.date !== today) {
    return { remaining: dailyLimit, limit: dailyLimit };
  }

  return {
    remaining: Math.max(0, dailyLimit - record.count),
    limit: dailyLimit,
  };
}
