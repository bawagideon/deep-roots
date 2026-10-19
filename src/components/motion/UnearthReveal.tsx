"use client";

import React, { useEffect, useRef, useState } from "react";
import { Haptics, isLowPowerDevice, prefersReducedMotion } from "@/lib/motion/haptics";

interface UnearthRevealProps {
  headline: string;
  body: string;
  tag?: string;
  autoPlay?: boolean;
  onRevealed?: () => void;
  className?: string;
}

export function UnearthReveal({
  headline,
  body,
  tag = "THE ROOT",
  autoPlay = true,
  onRevealed,
  className = "",
}: UnearthRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLit, setIsLit] = useState(false);
  const [activeWords, setActiveWords] = useState<number[]>([]);
  const [showBody, setShowBody] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const words = React.useMemo(() => headline.split(/\s+/), [headline]);

  useEffect(() => {
    if (!autoPlay) return;

    const timer = setTimeout(() => {
      triggerReveal();
    }, 150);

    return () => clearTimeout(timer);
  }, [autoPlay, headline]);

  const triggerReveal = () => {
    const isReduced = prefersReducedMotion();
    const isLow = isLowPowerDevice();

    if (isReduced) {
      setIsLit(true);
      setActiveWords(words.map((_, i) => i));
      setShowBody(true);
      setRevealed(true);
      onRevealed?.();
      return;
    }

    const cv = canvasRef.current;
    const container = containerRef.current;
    if (!cv || !container) return;

    const rect = container.getBoundingClientRect();
    const W = rect.width || 300;
    const H = rect.height || 200;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;

    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Soil particle distribution
    const cols = ["#2A1F12", "#3A2A18", "#1A130B", "#4A3622"];
    const count = isLow ? 45 : 100;
    const particles = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 6 + Math.random() * 10,
      c: cols[i % 4],
    }));

    // Draw initial cover
    ctx.clearRect(0, 0, W, H);
    particles.forEach((p) => {
      ctx.globalAlpha = 1;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.283);
      ctx.fill();
    });

    const t0 = performance.now();
    let rafId = 0;

    // Timeline triggers
    const timerLit = setTimeout(() => setIsLit(true), 260);
    const wordTimers = words.map((_, i) =>
      setTimeout(() => {
        setActiveWords((prev) => [...prev, i]);
      }, 380 + i * 80)
    );
    const timerHaptic = setTimeout(() => Haptics.unearth(), 520);
    const timerBody = setTimeout(() => {
      setShowBody(true);
      setRevealed(true);
      onRevealed?.();
    }, 1000);

    // Particle dispersal animation loop
    function frame(now: number) {
      const t = now - t0;
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);

      const k = t > 250 ? Math.min(1, (t - 250) / 850) : 0;
      const e = 1 - Math.pow(1 - k, 3);

      particles.forEach((p) => {
        const dx = p.x - W / 2;
        const dy = p.y - H / 2;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const x = p.x + (dx / d) * e * (130 + d);
        const y = p.y + (dy / d) * e * (90 + d * 0.6) + e * e * 50;
        ctx.globalAlpha = Math.max(0, 1 - e);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(x, y, p.r * (1 - e * 0.4), 0, 6.283);
        ctx.fill();
      });

      if (t < 1150) {
        rafId = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, W, H);
      }
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerLit);
      clearTimeout(timerHaptic);
      clearTimeout(timerBody);
      wordTimers.forEach(clearTimeout);
    };
  };

  return (
    <div ref={containerRef} className={`relative w-full overflow-hidden ${className}`}>
      {/* Root Glow Panel */}
      <div
        className={`w-full bg-[#231A00] border-2 border-[#FFC857] rounded-[22px] p-6 transition-all duration-700 relative z-10 ${
          isLit ? "panel-lit" : ""
        }`}
      >
        <div
          className={`text-[11px] font-bold tracking-[0.14em] text-[#FFC857] uppercase mb-2 transition-opacity duration-500 ${
            isLit ? "opacity-100" : "opacity-0"
          }`}
        >
          {tag}
        </div>

        <h2 className="text-[22px] font-extrabold text-[#EAF1EC] leading-[1.18] tracking-tight mb-3">
          {words.map((w, idx) => (
            <span
              key={idx}
              className={`unearth-word ${activeWords.includes(idx) ? "on" : ""}`}
            >
              {w}
            </span>
          ))}
        </h2>

        <p
          className={`text-[14px] leading-relaxed text-[#F3E7C4] transition-opacity duration-600 ${
            showBody ? "opacity-100" : "opacity-0"
          }`}
        >
          {body}
        </p>
      </div>

      {/* Dispersing Soil Canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`absolute inset-0 pointer-events-none z-20 ${revealed ? "hidden" : "block"}`}
      />
    </div>
  );
}
