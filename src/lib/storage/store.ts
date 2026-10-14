"use client";

import {
  StoredRoot,
  GraphEdge,
  UserStats,
  Lens,
  UserPreferences,
  UserProfile,
} from "@/types/roots";
import { SEEDED_ROOTS, SEEDED_EDGES, LENSES } from "@/lib/constants";

const ROOTS_STORAGE_KEY = "deeproots_roots_v2";
const EDGES_STORAGE_KEY = "deeproots_edges_v2";
const STATS_STORAGE_KEY = "deeproots_stats_v2";

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

export function getStoredRoots(): StoredRoot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ROOTS_STORAGE_KEY);
    if (!raw) {
      const initial = SEEDED_ROOTS.map((r) => ({ ...r, isSeeded: true }));
      localStorage.setItem(ROOTS_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveRoot(root: StoredRoot): void {
  if (typeof window === "undefined") return;
  const roots = getStoredRoots();
  const existingIdx = roots.findIndex((r) => r.id === root.id);
  let updated: StoredRoot[];
  if (existingIdx >= 0) {
    updated = [...roots];
    updated[existingIdx] = root;
  } else {
    updated = [root, ...roots];
  }
  localStorage.setItem(ROOTS_STORAGE_KEY, JSON.stringify(updated));
  updateStatsOnSave(root);
  window.dispatchEvent(new Event("deeproots_storage_updated"));
}

export function deleteRoot(id: string): void {
  if (typeof window === "undefined") return;
  const roots = getStoredRoots().filter((r) => r.id !== id);
  localStorage.setItem(ROOTS_STORAGE_KEY, JSON.stringify(roots));

  const edges = getStoredEdges().filter((e) => e.fromRoot !== id && e.toRoot !== id);
  localStorage.setItem(EDGES_STORAGE_KEY, JSON.stringify(edges));

  const stats = getUserStats();
  stats.totalRoots = roots.filter((r) => !r.isSeeded).length;
  stats.totalLinks = edges.length;
  saveUserStats(stats);

  window.dispatchEvent(new Event("deeproots_storage_updated"));
}

export function clearAllData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ROOTS_STORAGE_KEY);
  localStorage.removeItem(EDGES_STORAGE_KEY);
  localStorage.removeItem(STATS_STORAGE_KEY);
  localStorage.removeItem("deeproots_welcomed");
  window.dispatchEvent(new Event("deeproots_storage_updated"));
}

export function getStoredEdges(): GraphEdge[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EDGES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(EDGES_STORAGE_KEY, JSON.stringify(SEEDED_EDGES));
      return SEEDED_EDGES;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveEdge(edge: GraphEdge): void {
  if (typeof window === "undefined") return;
  const edges = getStoredEdges();
  if (!edges.some((e) => e.id === edge.id || (e.fromRoot === edge.fromRoot && e.toRoot === edge.toRoot))) {
    const updated = [...edges, edge];
    localStorage.setItem(EDGES_STORAGE_KEY, JSON.stringify(updated));

    const stats = getUserStats();
    stats.totalLinks = updated.length;
    saveUserStats(stats);

    window.dispatchEvent(new Event("deeproots_storage_updated"));
  }
}

export function getUserStats(): UserStats {
  if (typeof window === "undefined") return INITIAL_STATS;
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(INITIAL_STATS));
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

export function saveUserStats(stats: UserStats): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  window.dispatchEvent(new Event("deeproots_storage_updated"));
}

export function getUserPreferences(): UserPreferences {
  return getUserStats().preferences || DEFAULT_PREFERENCES;
}

export function saveUserPreferences(prefs: UserPreferences): void {
  const stats = getUserStats();
  stats.preferences = prefs;
  stats.selectedLenses = prefs.lenses;
  saveUserStats(stats);
}

export function getUserProfile(): UserProfile {
  return getUserStats().profile || DEFAULT_PROFILE;
}

export function saveUserProfile(prof: UserProfile): void {
  const stats = getUserStats();
  stats.profile = prof;
  saveUserStats(stats);
}

export function upgradePlan(plan: "free" | "pro"): void {
  const stats = getUserStats();
  if (stats.profile) stats.profile.plan = plan;
  stats.scansLimit = plan === "pro" ? 50 : 5;
  saveUserStats(stats);
}

function updateStatsOnSave(newRoot: StoredRoot): void {
  const stats = getUserStats();
  const today = new Date().toISOString().split("T")[0];

  stats.scansToday = (stats.scansToday || 0) + 1;
  const userRoots = getStoredRoots().filter((r) => !r.isSeeded);
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

  saveUserStats(stats);
}
