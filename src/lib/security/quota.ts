import { NextRequest } from "next/server";
import { getEntitlements } from "./entitlements";

interface QuotaRecord {
  date: string; // YYYY-MM-DD
  count: number;
}

const memoryQuotaStore = new Map<string, QuotaRecord>();

export function getClientIdentifier(req: NextRequest): { clientId: string; userId?: string } {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
  const userId = req.headers.get("x-user-id") || undefined;
  const clientId = userId ? `user:${userId}` : `ip:${ip}`;
  return { clientId, userId };
}

export function checkAndIncrementQuota(clientId: string, userId?: string): {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetSeconds: number;
  isKillSwitch?: boolean;
} {
  const entitlements = getEntitlements(userId);

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
  const record = memoryQuotaStore.get(clientId);

  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  const resetSeconds = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));

  if (!record || record.date !== today) {
    memoryQuotaStore.set(clientId, { date: today, count: 1 });
    return {
      allowed: true,
      remaining: dailyLimit - 1,
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
  memoryQuotaStore.set(clientId, record);

  return {
    allowed: true,
    remaining: Math.max(0, dailyLimit - record.count),
    limit: dailyLimit,
    resetSeconds,
  };
}

export function getQuotaStatus(clientId: string, userId?: string): {
  remaining: number;
  limit: number;
} {
  const entitlements = getEntitlements(userId);
  const dailyLimit = entitlements.dailyScanLimit;
  const today = new Date().toISOString().split("T")[0];
  const record = memoryQuotaStore.get(clientId);

  if (!record || record.date !== today) {
    return { remaining: dailyLimit, limit: dailyLimit };
  }
  return {
    remaining: Math.max(0, dailyLimit - record.count),
    limit: dailyLimit,
  };
}
