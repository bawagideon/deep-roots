"use client";

import { StoredRoot, GraphEdge, UserStats, Lens, RootsCard } from "@/types/roots";
import { SEEDED_ROOTS, SEEDED_EDGES, LENSES } from "@/lib/constants";

const ROOTS_STORAGE_KEY = "deeproots_roots_v1";
const EDGES_STORAGE_KEY = "deeproots_edges_v1";
const STATS_STORAGE_KEY = "deeproots_stats_v1";

const DEFAULT_STATS: UserStats = {
  streak: 4,
  bestStreak: 6,
  lastActive: new Date().toISOString(),
  activeDays: [
    new Date(Date.now() - 86400000 * 3).toISOString().split("T")[0],
    new Date(Date.now() - 86400000 * 2).toISOString().split("T")[0],
    new Date(Date.now() - 86400000 * 1).toISOString().split("T")[0],
    new Date().toISOString().split("T")[0],
  ],
  scansToday: 1,
  scansLimit: 5,
  selectedLenses: ["language", "culture", "tech"],
  lensCounts: {
    language: 6,
    culture: 4,
    mind: 2,
    money: 9,
    tech: 5,
    origins: 3,
  },
  totalRoots: 9,
  totalRabbitHoles: 7,
  totalLinks: 12,
  badges: [
    {
      id: "first_root",
      name: "First root",
      description: "Discovered your very first hidden system",
      unlocked: true,
      icon: "first_root",
    },
    {
      id: "streak_3",
      name: "3-day streak",
      description: "Explored 3 days in a row",
      unlocked: true,
      icon: "streak",
    },
    {
      id: "all_six",
      name: "All six lenses",
      description: "Touch every lens across your discoveries",
      unlocked: false,
      progress: "4/6",
      icon: "all_lenses",
    },
    {
      id: "rabbit_depth",
      name: "Deep diver",
      description: "Reached depth 3 in a rabbit hole journey",
      unlocked: true,
      icon: "rabbit_depth",
    },
  ],
};

export function getStoredRoots(): StoredRoot[] {
  if (typeof window === "undefined") return SEEDED_ROOTS;
  try {
    const raw = localStorage.getItem(ROOTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ROOTS_STORAGE_KEY, JSON.stringify(SEEDED_ROOTS));
      return SEEDED_ROOTS;
    }
    return JSON.parse(raw);
  } catch {
    return SEEDED_ROOTS;
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

  window.dispatchEvent(new Event("deeproots_storage_updated"));
}

export function clearAllData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ROOTS_STORAGE_KEY);
  localStorage.removeItem(EDGES_STORAGE_KEY);
  localStorage.removeItem(STATS_STORAGE_KEY);
  window.dispatchEvent(new Event("deeproots_storage_updated"));
}

export function getStoredEdges(): GraphEdge[] {
  if (typeof window === "undefined") return SEEDED_EDGES;
  try {
    const raw = localStorage.getItem(EDGES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(EDGES_STORAGE_KEY, JSON.stringify(SEEDED_EDGES));
      return SEEDED_EDGES;
    }
    return JSON.parse(raw);
  } catch {
    return SEEDED_EDGES;
  }
}

export function saveEdge(edge: GraphEdge): void {
  if (typeof window === "undefined") return;
  const edges = getStoredEdges();
  if (!edges.some((e) => e.id === edge.id)) {
    const updated = [...edges, edge];
    localStorage.setItem(EDGES_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("deeproots_storage_updated"));
  }
}

export function getUserStats(): UserStats {
  if (typeof window === "undefined") return DEFAULT_STATS;
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(DEFAULT_STATS));
      return DEFAULT_STATS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_STATS;
  }
}

export function saveUserStats(stats: UserStats): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  window.dispatchEvent(new Event("deeproots_storage_updated"));
}

function updateStatsOnSave(newRoot: StoredRoot): void {
  const stats = getUserStats();
  const today = new Date().toISOString().split("T")[0];

  // Increment scan count
  stats.scansToday = (stats.scansToday || 0) + 1;
  stats.totalRoots = (stats.totalRoots || 0) + 1;
  if (newRoot.depth > 0) {
    stats.totalRabbitHoles = (stats.totalRabbitHoles || 0) + 1;
  }

  // Update lens counts
  if (newRoot.card.lenses) {
    newRoot.card.lenses.forEach((lens) => {
      stats.lensCounts[lens] = Math.min(10, (stats.lensCounts[lens] || 0) + 1);
    });
  }

  // Streak update
  if (!stats.activeDays.includes(today)) {
    stats.activeDays.push(today);
    stats.streak = (stats.streak || 0) + 1;
    if (stats.streak > stats.bestStreak) {
      stats.bestStreak = stats.streak;
    }
  }

  saveUserStats(stats);
}
