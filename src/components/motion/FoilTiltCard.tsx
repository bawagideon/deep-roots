"use client";

import React, { useRef, useState, useEffect } from "react";
import { prefersReducedMotion } from "@/lib/motion/haptics";
import { Lens } from "@/types/roots";
import { LENSES } from "@/lib/constants";
import { Sparkles } from "lucide-react";

interface FoilTiltCardProps {
  title: string;
  rootHeadline: string;
  lenses?: Lens[];
  className?: string;
  showSweepButton?: boolean;
}

export function FoilTiltCard({
  title,
  rootHeadline,
  lenses = ["culture", "tech"],
  className = "",
  showSweepButton = true,
}: FoilTiltCardProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const rafRef = useRef<number>(0);

  const setSheen = (x: number, y: number) => {
    if (!cardRef.current) return;
    cardRef.current.style.setProperty("--sx", x.toFixed(3));
    cardRef.current.style.setProperty("--rx", (x * 2 - 1).toFixed(3));
    cardRef.current.style.setProperty("--ry", (y * 2 - 1).toFixed(3));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion() || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setSheen(x, y);
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    setSheen(0.3, 0.5);
  };

  const triggerSweep = () => {
    if (prefersReducedMotion()) {
      setSheen(0.6, 0.5);
      return;
    }

    cancelAnimationFrame(rafRef.current);
    const t0 = performance.now();
    const dur = 1400;

    function frame(now: number) {
      const t = Math.min(1, (now - t0) / dur);
      // easeInOutQuad
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const x = -0.2 + e * 1.4;
      const y = 0.5 + Math.sin(t * 6.283) * 0.25;
      setSheen(x, y);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        setSheen(0.3, 0.5);
      }
    }

    rafRef.current = requestAnimationFrame(frame);
  };

  useEffect(() => {
    setSheen(0.3, 0.5);

    // Support device orientation if available on mobile
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (prefersReducedMotion() || e.gamma == null || e.beta == null) return;
      const x = Math.min(1, Math.max(0, 0.5 + e.gamma / 60));
      const y = Math.min(1, Math.max(0, 0.5 + (e.beta - 45) / 60));
      setSheen(x, y);
    };

    if (typeof window !== "undefined" && "DeviceOrientationEvent" in window) {
      window.addEventListener("deviceorientation", handleOrientation);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (typeof window !== "undefined" && "DeviceOrientationEvent" in window) {
        window.removeEventListener("deviceorientation", handleOrientation);
      }
    };
  }, []);

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* 3D Perspective Stage */}
      <div
        ref={stageRef}
        onPointerMove={handlePointerMove}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={handlePointerLeave}
        className="foil-stage cursor-pointer select-none py-2"
      >
        <div
          ref={cardRef}
          aria-label={`Foil card for ${title}`}
          className="foil-card foil-sheen w-[260px] h-[330px] rounded-[22px] bg-[#151D18] border border-[#2A372F] p-6 flex flex-col justify-between shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-[0.14em] text-[#FFC857]">
              ROOT CARD
            </span>
            <Sparkles className="w-4 h-4 text-[#FFC857]/70" />
          </div>

          {/* Core Content */}
          <div className="my-auto">
            <h3 className="text-[24px] font-extrabold text-[#EAF1EC] leading-tight tracking-tight mb-2">
              {title}
            </h3>
            <p className="text-[13px] text-[#C9D6CE] line-clamp-3 leading-relaxed">
              {rootHeadline}
            </p>
          </div>

          {/* Footer: Lens Dots */}
          <div className="flex items-center justify-between pt-3 border-t border-[#2A372F]/60">
            <div className="flex items-center gap-1.5">
              {lenses.map((lensKey) => (
                <span
                  key={lensKey}
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: LENSES[lensKey]?.color || "#FFC857" }}
                  title={LENSES[lensKey]?.label}
                />
              ))}
            </div>

            <span className="text-[11px] font-semibold text-[#9AAAA0] tracking-wider uppercase">
              Deep Roots
            </span>
          </div>
        </div>
      </div>

      {showSweepButton && (
        <button
          onClick={triggerSweep}
          className="px-4 py-1.5 rounded-full bg-[#151D18] border border-[#2A372F] text-[12px] font-semibold text-[#9AAAA0] hover:text-[#EAF1EC] hover:border-[#FFC857]/50 transition-colors flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#FFC857]" />
          <span>Foil Sheen Sweep</span>
        </button>
      )}
    </div>
  );
}
