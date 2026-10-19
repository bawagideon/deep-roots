"use client";

import React, { useEffect, useRef } from "react";
import { Haptics, prefersReducedMotion } from "@/lib/motion/haptics";

interface SeedArcProps {
  startRect: DOMRect | null;
  targetRect?: DOMRect | null;
  onLanded?: () => void;
  onFinish?: () => void;
}

function quadraticBezier(
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number }
) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function SeedArc({
  startRect,
  targetRect,
  onLanded,
  onFinish,
}: SeedArcProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const seedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startRect) return;

    if (prefersReducedMotion()) {
      Haptics.seedLanding();
      window.dispatchEvent(new CustomEvent("deeproots_seed_landed"));
      onLanded?.();
      onFinish?.();
      return;
    }

    // Determine target location: use passed targetRect or lookup #tabTree in DOM
    let target = targetRect;
    if (!target) {
      const treeTab = document.getElementById("tabTree") || document.querySelector('[data-tab="tree"]');
      if (treeTab) {
        target = treeTab.getBoundingClientRect();
      } else {
        // Fallback target: bottom-right tab area
        target = {
          left: window.innerWidth * 0.8,
          top: window.innerHeight - 50,
          width: 30,
          height: 30,
        } as DOMRect;
      }
    }

    const p0 = {
      x: startRect.left + startRect.width / 2,
      y: startRect.top + startRect.height / 2,
    };
    const p2 = {
      x: target.left + target.width / 2,
      y: target.top + target.height / 2,
    };
    const p1 = {
      x: (p0.x + p2.x) / 2,
      y: Math.min(p0.y, p2.y) - 120,
    };

    const seed = seedRef.current;
    const container = containerRef.current;
    if (!seed || !container) return;

    seed.style.opacity = "1";
    const t0 = performance.now();
    const dur = 750;
    let lastTrail = 0;
    let rafId = 0;

    function frame(now: number) {
      const t = Math.min(1, (now - t0) / dur);
      const e = easeInOutQuad(t);
      const pos = quadraticBezier(e, p0, p1, p2);

      if (seed) {
        seed.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${1 - 0.4 * e})`;
      }

      // Spawn glowing trail particles every 28ms
      if (container && now - lastTrail > 28 && t < 0.95) {
        lastTrail = now;
        const trail = document.createElement("div");
        trail.className = "seed-trail";
        trail.style.left = `${pos.x}px`;
        trail.style.top = `${pos.y}px`;
        container.appendChild(trail);
        setTimeout(() => {
          if (trail.parentNode) trail.parentNode.removeChild(trail);
        }, 550);
      }

      if (t < 1) {
        rafId = requestAnimationFrame(frame);
      } else {
        if (seed) seed.style.opacity = "0";
        Haptics.seedLanding();
        window.dispatchEvent(new CustomEvent("deeproots_seed_landed"));
        onLanded?.();
        setTimeout(() => {
          onFinish?.();
        }, 300);
      }
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [startRect, targetRect, onLanded, onFinish]);

  if (!startRect) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-[100] overflow-hidden"
    >
      <div
        ref={seedRef}
        className="seed-projectile opacity-0"
      />
    </div>
  );
}
