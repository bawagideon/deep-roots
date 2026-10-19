/**
 * Deep Roots Motion & Haptics Engine
 * Provides cross-device tactile feedback with graceful fallbacks.
 * Respects navigator.vibrate, hardware concurrency, and user motion settings.
 */

export function buzz(pattern: number | number[]): void {
  if (typeof window === "undefined" || !("vibrate" in navigator)) return;
  try {
    // Check prefers-reduced-motion
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    navigator.vibrate(pattern);
  } catch {
    // Graceful fallback on browsers where vibrate throws or is blocked
  }
}

export const Haptics = {
  /** Light 10ms click for tap feedback, toggles, and step detents */
  tick: () => buzz(10),
  /** Deep double-pulse [14, 50, 28] landed at the peak of the Unearth Reveal */
  unearth: () => buzz([14, 50, 28]),
  /** 12ms thud when the Seed Arc projectile hits the Tree tab */
  seedLanding: () => buzz(12),
  /** Tri-pulse celebration [20, 60, 30] for streak unlock and lens level up */
  levelUp: () => buzz([20, 60, 30]),
};

/**
 * Detects if the current device is in the low-power or low-hardware tier
 */
export function isLowPowerDevice(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as any;
  const lowCores = nav.hardwareConcurrency && nav.hardwareConcurrency <= 4;
  const lowMemory = nav.deviceMemory && nav.deviceMemory <= 2;
  return Boolean(lowCores || lowMemory);
}

/**
 * Checks if user has system reduced motion enabled
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
