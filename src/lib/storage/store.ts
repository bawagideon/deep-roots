"use client";

import {
  StoredRoot,
  GraphEdge,
  UserStats,
  Lens,
  UserPreferences,
  UserProfile,
} from "@/types/roots";
import { SEEDED_ROOTS, SEEDED_EDGES } from "@/lib/constants";

const ACTIVE_USER_KEY = "deeproots_active_user_id";

let currentActiveUserId: string | null = null;

export function setActiveUser(userId: string | null | undefined): void {
  currentActiveUserId = userId || null;
  if (typeof window === "undefined") return;
  try {
    if (userId) {
      localStorage.setItem(ACTIVE_USER_KEY, userId);
    } else {
      localStorage.removeItem(ACTIVE_USER_KEY);
    }
  } catch {}
}

export function getActiveUser(): string | null {
  if (typeof window === "undefined") return null;
  if (currentActiveUserId) return currentActiveUserId;
  try {
    return localStorage.getItem(ACTIVE_USER_KEY);
  } catch {
    return null;
  }
}

function getRootsKey(userId?: string | null): string {
  const uid = userId !== undefined ? userId : getActiveUser();
  return uid ? `deeproots_${uid}_roots` : "deeproots_guest_roots";
}

function getEdgesKey(userId?: string | null): string {
  const uid = userId !== undefined ? userId : getActiveUser();
  return uid ? `deeproots_${uid}_edges` : "deeproots_guest_edges";
}

function getStatsKey(userId?: string | null): string {
  const uid = userId !== undefined ? userId : getActiveUser();
  return uid ? `deeproots_${uid}_stats` : "deeproots_guest_stats";
}

function migrateLegacyStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const legacyRoots = localStorage.getItem("deeproots_roots_v2");
    if (legacyRoots && !localStorage.getItem("deeproots_guest_roots")) {
      localStorage.setItem("deeproots_guest_roots", legacyRoots);
      localStorage.removeItem("deeproots_roots_v2");
    }

    const legacyEdges = localStorage.getItem("deeproots_edges_v2");
    if (legacyEdges && !localStorage.getItem("deeproots_guest_edges")) {
      localStorage.setItem("deeproots_guest_edges", legacyEdges);
      localStorage.removeItem("deeproots_edges_v2");
    }

    const legacyStats = localStorage.getItem("deeproots_stats_v2");
    if (legacyStats && !localStorage.getItem("deeproots_guest_stats")) {
      localStorage.setItem("deeproots_guest_stats", legacyStats);
      localStorage.removeItem("deeproots_stats_v2");
    }
  } catch {}
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  lenses: ["language", "culture", "tech"],
  depth: "standard",
  language: "English",
  tone: "playful",
  openTo: "home",
  timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" : "UTC",
  notifications: {
    dailyRoot: { enabled: true, time: "08:00" },
    streakReminder: true,
    weeklyRecap: true,
    quietHours: { from: "22:00", to: "07:00" },
  },
  privacy: {
    imageRetentionDays: 30,
    shareDefault: "ask",
    analytics: true,
  },
};

export const DEFAULT_PROFILE: UserProfile = {
  id: "guest_" + Math.random().toString(36).slice(2, 9),
  displayName: "Explorer",
  isAnonymous: true,
  plan: "free",
  memberSince: "October 2026",
};

const INITIAL_STATS: UserStats = {
  streak: 0,
  bestStreak: 0,
  lastActive: new Date().toISOString(),
  activeDays: [],
  scansToday: 0,
  scansLimit: 5,
  selectedLenses: ["language", "culture", "tech"],
  lensCounts: {
    language: 0,
    culture: 0,
    mind: 0,
    money: 0,
    tech: 0,
    origins: 0,
  },
  totalRoots: 0,
  totalRabbitHoles: 0,
  totalLinks: 0,
  badges: [
    {
      id: "first_root",
      name: "First root",
      description: "Discover your very first hidden system",
      unlocked: false,
      icon: "first_root",
    },
    {
      id: "streak_3",
      name: "3-day streak",
      description: "Explore 3 days in a row",
      unlocked: false,
      icon: "streak",
    },
    {
      id: "all_six",
      name: "All six lenses",
      description: "Touch every lens across your discoveries",
      unlocked: false,
      progress: "0/6",
      icon: "all_lenses",
    },
    {
      id: "rabbit_depth",
      name: "Deep diver",
      description: "Reach depth 3 in a rabbit hole journey",
      unlocked: false,
      icon: "rabbit_depth",
    },
  ],
  preferences: DEFAULT_PREFERENCES,
  profile: DEFAULT_PROFILE,
};

export function getStoredRoots(userId?: string | null): StoredRoot[] {
  if (typeof window === "undefined") return [];
  migrateLegacyStorage();
  try {
    const key = getRootsKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) {
      const initial = SEEDED_ROOTS.map((r) => ({ ...r, isSeeded: true }));
      localStorage.setItem(key, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveRoot(root: StoredRoot, userId?: string | null): void {
  if (typeof window === "undefined") return;
  const uid = userId !== undefined ? userId : getActiveUser();
  const key = getRootsKey(uid);
  const roots = getStoredRoots(uid);
  const existingIdx = roots.findIndex((r) => r.id === root.id);
  let updated: StoredRoot[];
  if (existingIdx >= 0) {
    updated = [...roots];
    updated[existingIdx] = root;
  } else {
    updated = [root, ...roots];
  }
  localStorage.setItem(key, JSON.stringify(updated));
  updateStatsOnSave(root, uid);
  window.dispatchEvent(new Event("deeproots_storage_updated"));

  // Asynchronously persist to Supabase cloud if online
  if (navigator.onLine) {
    fetch("/api/roots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root }),
    }).catch(() => {});
  }
}

export function deleteRoot(id: string, userId?: string | null): void {
  if (typeof window === "undefined") return;
  const uid = userId !== undefined ? userId : getActiveUser();
  const rootsKey = getRootsKey(uid);
  const edgesKey = getEdgesKey(uid);

  const roots = getStoredRoots(uid).filter((r) => r.id !== id);
  localStorage.setItem(rootsKey, JSON.stringify(roots));

  const edges = getStoredEdges(uid).filter((e) => e.fromRoot !== id && e.toRoot !== id);
  localStorage.setItem(edgesKey, JSON.stringify(edges));

  const stats = getUserStats(uid);
  stats.totalRoots = roots.filter((r) => !r.isSeeded).length;
  stats.totalLinks = edges.length;
  saveUserStats(stats, uid);

  window.dispatchEvent(new Event("deeproots_storage_updated"));

  // Asynchronously delete from Supabase cloud
  if (navigator.onLine) {
    fetch(`/api/roots/${id}`, { method: "DELETE" }).catch((err) => {
      console.warn("Failed to delete root from server:", err);
    });
  }
}

export function clearAllData(): void {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("deeproots_")) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
  currentActiveUserId = null;
  window.dispatchEvent(new Event("deeproots_storage_updated"));
}

/**
 * Clean sign-out data wipe:
 * Per Deep Roots spec section 1.5, shared devices must never show the previous user's roots.
 * Clears localStorage, sessionStorage, IndexedDB, and in-memory caches.
 */
export async function clearUserDataOnSignOut(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("deeproots_")) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();

    // Clear IndexedDB databases if supported by browser
    if (typeof window !== "undefined" && window.indexedDB && window.indexedDB.databases) {
      try {
        const dbs = await window.indexedDB.databases();
        for (const db of dbs) {
          if (db.name && (db.name.includes("deeproots") || db.name.includes("clerk"))) {
            window.indexedDB.deleteDatabase(db.name);
          }
        }
      } catch {}
    }

    // Clear user-specific cache storage
    if (typeof window !== "undefined" && "caches" in window) {
      try {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          if (name.includes("data") || name.includes("roots") || name.includes("user")) {
            await caches.delete(name);
          }
        }
      } catch {}
    }
  } catch {}

  currentActiveUserId = null;
  window.dispatchEvent(new Event("deeproots_user_signed_out"));
  window.dispatchEvent(new Event("deeproots_storage_updated"));
}

export function getStoredEdges(userId?: string | null): GraphEdge[] {
  if (typeof window === "undefined") return [];
  migrateLegacyStorage();
  try {
    const key = getEdgesKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(SEEDED_EDGES));
      return SEEDED_EDGES;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveEdge(edge: GraphEdge, userId?: string | null): void {
  if (typeof window === "undefined") return;
  const uid = userId !== undefined ? userId : getActiveUser();
  const key = getEdgesKey(uid);
  const edges = getStoredEdges(uid);
  if (!edges.some((e) => e.id === edge.id || (e.fromRoot === edge.fromRoot && e.toRoot === edge.toRoot))) {
    const updated = [...edges, edge];
    localStorage.setItem(key, JSON.stringify(updated));

    const stats = getUserStats(uid);
    stats.totalLinks = updated.length;
    saveUserStats(stats, uid);

    window.dispatchEvent(new Event("deeproots_storage_updated"));
  }
}

/**
 * Bidirectional cloud synchronization:
 * Fetches user discoveries from Supabase, merges into local storage, and pushes
 * any offline or guest discoveries up to the authenticated cloud account.
 * Awaits all server writes and returns honest status without reporting false syncs.
 */
export async function syncRootsFromCloud(userId?: string | null): Promise<{
  synced: boolean;
  count: number;
  error?: string;
}> {
  if (typeof window === "undefined") {
    return { synced: false, count: 0, error: "Window undefined" };
  }
  if (!navigator.onLine) {
    return { synced: false, count: 0, error: "offline" };
  }

  if (userId) {
    setActiveUser(userId);
  }

  const activeUid = userId !== undefined ? userId : getActiveUser();

  try {
    const res = await fetch("/api/roots");
    if (!res.ok) {
      return { synced: false, count: 0, error: `Server returned ${res.status}` };
    }

    const data = await res.json();
    if (!data.authenticated) {
      return { synced: false, count: 0, error: "Not authenticated" };
    }

    const cloudRoots: StoredRoot[] = data.roots || [];
    const cloudMap = new Map(cloudRoots.map((r) => [r.id, r]));

    // 1. Process Guest Discoveries (Migrate guest items created prior to sign in)
    const guestRoots = getStoredRoots(null).filter((r) => !r.isSeeded);
    const uploadedGuestIds: string[] = [];

    if (guestRoots.length > 0) {
      for (const gr of guestRoots) {
        if (!cloudMap.has(gr.id)) {
          const upRes = await fetch("/api/roots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ root: gr }),
          });
          if (!upRes.ok) {
            return {
              synced: false,
              count: cloudRoots.length,
              error: `Failed to migrate guest discovery: ${gr.title}`,
            };
          }
          cloudMap.set(gr.id, gr);
        }
        uploadedGuestIds.push(gr.id);
      }

      // Clean up migrated guest discoveries from guest storage
      const remainingGuest = getStoredRoots(null).filter(
        (r) => !uploadedGuestIds.includes(r.id)
      );
      localStorage.setItem(getRootsKey(null), JSON.stringify(remainingGuest));
    }

    // 2. Identify and upload any pending local roots for THIS user created offline
    const localUserRoots = getStoredRoots(activeUid).filter((r) => !r.isSeeded);
    const pendingUpload = localUserRoots.filter((r) => !cloudMap.has(r.id));

    for (const r of pendingUpload) {
      const upRes = await fetch("/api/roots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root: r }),
      });
      if (!upRes.ok) {
        return {
          synced: false,
          count: cloudRoots.length,
          error: `Failed to upload discovery: ${r.title}`,
        };
      }
      cloudMap.set(r.id, r);
    }

    // 3. Update local user storage with full authoritative cloud set + seeded
    const seeded = SEEDED_ROOTS.map((r) => ({ ...r, isSeeded: true }));
    const mergedMap = new Map<string, StoredRoot>();

    cloudRoots.forEach((r) => mergedMap.set(r.id, r));
    pendingUpload.forEach((r) => mergedMap.set(r.id, r));
    guestRoots.forEach((r) => mergedMap.set(r.id, r));
    seeded.forEach((r) => {
      if (!mergedMap.has(r.id)) mergedMap.set(r.id, r);
    });

    const finalRoots = Array.from(mergedMap.values());
    localStorage.setItem(getRootsKey(activeUid), JSON.stringify(finalRoots));

    // 4. Merge Edges
    if (data.edges && Array.isArray(data.edges) && data.edges.length > 0) {
      const localEdges = getStoredEdges(activeUid);
      const edgeMap = new Map<string, GraphEdge>();
      localEdges.forEach((e) => edgeMap.set(e.id, e));
      data.edges.forEach((e: GraphEdge) => edgeMap.set(e.id, e));
      localStorage.setItem(getEdgesKey(activeUid), JSON.stringify(Array.from(edgeMap.values())));
    }

    // 5. Update stats count
    const stats = getUserStats(activeUid);
    stats.totalRoots = finalRoots.filter((r) => !r.isSeeded).length;
    stats.totalLinks = getStoredEdges(activeUid).length;
    saveUserStats(stats, activeUid);

    window.dispatchEvent(new Event("deeproots_storage_updated"));
    return {
      synced: true,
      count: finalRoots.filter((r) => !r.isSeeded).length,
    };
  } catch (err: any) {
    return { synced: false, count: 0, error: err?.message || "Sync network error" };
  }
}

export function getUserStats(userId?: string | null): UserStats {
  if (typeof window === "undefined") return INITIAL_STATS;
  migrateLegacyStorage();
  try {
    const key = getStatsKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(INITIAL_STATS));
      return INITIAL_STATS;
    }
    const parsed = JSON.parse(raw);
    return {
      ...INITIAL_STATS,
      ...parsed,
      preferences: { ...DEFAULT_PREFERENCES, ...(parsed.preferences || {}) },
      profile: { ...DEFAULT_PROFILE, ...(parsed.profile || {}) },
    };
  } catch {
    return INITIAL_STATS;
  }
}

export function saveUserStats(stats: UserStats, userId?: string | null): void {
  if (typeof window === "undefined") return;
  const key = getStatsKey(userId);
  localStorage.setItem(key, JSON.stringify(stats));
  window.dispatchEvent(new Event("deeproots_storage_updated"));
}

export function getUserPreferences(userId?: string | null): UserPreferences {
  return getUserStats(userId).preferences || DEFAULT_PREFERENCES;
}

export function saveUserPreferences(prefs: UserPreferences, userId?: string | null): void {
  const stats = getUserStats(userId);
  stats.preferences = prefs;
  stats.selectedLenses = prefs.lenses;
  saveUserStats(stats, userId);
}

export function getUserProfile(userId?: string | null): UserProfile {
  return getUserStats(userId).profile || DEFAULT_PROFILE;
}

export function saveUserProfile(prof: UserProfile, userId?: string | null): void {
  const stats = getUserStats(userId);
  stats.profile = prof;
  saveUserStats(stats, userId);
}

export function upgradePlan(plan: "free" | "pro", userId?: string | null): void {
  const stats = getUserStats(userId);
  if (stats.profile) stats.profile.plan = plan;
  stats.scansLimit = plan === "pro" ? 50 : 5;
  saveUserStats(stats, userId);
}

function updateStatsOnSave(newRoot: StoredRoot, userId?: string | null): void {
  const stats = getUserStats(userId);
  const today = new Date().toISOString().split("T")[0];

  stats.scansToday = (stats.scansToday || 0) + 1;
  const userRoots = getStoredRoots(userId).filter((r) => !r.isSeeded);
  stats.totalRoots = userRoots.length;

  if (newRoot.depth > 0) {
    stats.totalRabbitHoles = (stats.totalRabbitHoles || 0) + 1;
  }

  if (newRoot.card?.lenses) {
    newRoot.card.lenses.forEach((lens) => {
      stats.lensCounts[lens] = Math.min(10, (stats.lensCounts[lens] || 0) + 1);
    });
  }

  if (!stats.activeDays.includes(today)) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (stats.activeDays.includes(yesterday)) {
      stats.streak = (stats.streak || 0) + 1;
    } else {
      stats.streak = 1;
    }
    stats.activeDays.push(today);
    if (stats.streak > stats.bestStreak) {
      stats.bestStreak = stats.streak;
    }
  }

  // Update badges
  if (stats.totalRoots >= 1) {
    const b = stats.badges.find((x) => x.id === "first_root");
    if (b) b.unlocked = true;
  }
  if (stats.streak >= 3) {
    const b = stats.badges.find((x) => x.id === "streak_3");
    if (b) b.unlocked = true;
  }
  if (newRoot.depth >= 3) {
    const b = stats.badges.find((x) => x.id === "rabbit_depth");
    if (b) b.unlocked = true;
  }
  const exploredLensesCount = Object.values(stats.lensCounts).filter((c) => c > 0).length;
  const allSixBadge = stats.badges.find((b) => b.id === "all_six");
  if (allSixBadge) {
    allSixBadge.progress = `${exploredLensesCount}/6`;
    if (exploredLensesCount >= 6) allSixBadge.unlocked = true;
  }

  saveUserStats(stats, userId);
}
