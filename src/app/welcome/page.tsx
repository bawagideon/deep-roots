"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitFork, ArrowRight } from "lucide-react";
import { Lens } from "@/types/roots";
import { LENSES } from "@/lib/constants";
import { getUserStats, saveUserStats } from "@/lib/storage/store";

export default function WelcomePage() {
  const router = useRouter();
  const [selectedLenses, setSelectedLenses] = useState<Lens[]>([
    "language",
    "culture",
    "tech",
  ]);

  const toggleLens = (lens: Lens) => {
    if (selectedLenses.includes(lens)) {
      if (selectedLenses.length > 1) {
        setSelectedLenses(selectedLenses.filter((l) => l !== lens));
      }
    } else {
      if (selectedLenses.length < 3) {
        setSelectedLenses([...selectedLenses, lens]);
      } else {
        // Replace first
        setSelectedLenses([...selectedLenses.slice(1), lens]);
      }
    }
  };

  const handleStart = () => {
    const stats = getUserStats();
    stats.selectedLenses = selectedLenses;
    saveUserStats(stats);
    if (typeof window !== "undefined") {
      localStorage.setItem("deeproots_welcomed", "true");
    }
    router.push("/");
  };

  return (
    <div className="flex flex-col min-h-screen px-6 pt-10 pb-12 justify-between">
      {/* Top Header */}
      <div>
        <div className="flex items-center gap-2 mb-8">
          <div className="w-7 h-7 rounded-lg bg-[#FFC857]/15 border border-[#FFC857]/40 flex items-center justify-center text-[#FFC857]">
            <GitFork className="w-4 h-4 rotate-180" />
          </div>
          <span className="font-semibold text-[17px] tracking-tight text-[#EAF1EC]">
            Deep Roots
          </span>
        </div>

        {/* Hero title */}
        <h1 className="text-[44px] font-extrabold tracking-tight leading-[1.08] text-[#EAF1EC] mb-4">
          Everything has roots.
        </h1>
        <p className="text-[16px] text-[#9AAAA0] leading-snug mb-8">
          Snap, paste or type anything. See what it is made of, where it came
          from, and what it connects to.
        </p>

        {/* Example Preview Card */}
        <div className="bg-[#151D18] border border-[#2A372F] rounded-card p-5 mb-8 shadow-sm">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#2D2319] border border-[#E57A44]/30 flex items-center justify-center text-2xl flex-shrink-0">
              🍜
            </div>
            <div>
              <h3 className="font-bold text-[18px] text-[#EAF1EC] tracking-tight">
                Instant noodles
              </h3>
              <p className="text-[13px] text-[#9AAAA0] leading-tight mt-0.5">
                A fried, dried wheat block with a flavour sachet
              </p>
            </div>
          </div>

          <div className="bg-[#231A00] border border-[#FFC857]/50 rounded-[14px] p-3.5">
            <span className="text-[10px] font-bold tracking-wider text-[#FFC857] uppercase block mb-1">
              The Root
            </span>
            <p className="text-[14px] font-medium text-[#EAF1EC] leading-snug">
              Invented in 1958 to fight postwar hunger.
            </p>
          </div>
        </div>

        {/* Lens selection */}
        <div>
          <p className="text-[13px] font-semibold text-[#9AAAA0] uppercase tracking-wider mb-3">
            Pick 3 lenses to start
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            {(Object.keys(LENSES) as Lens[]).map((key) => {
              const lens = LENSES[key];
              const isSelected = selectedLenses.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleLens(key)}
                  className={`h-12 px-4 rounded-[14px] border flex items-center gap-3 transition-all text-left ${
                    isSelected
                      ? "bg-[#1D2822] border-[#FFC857] text-[#EAF1EC]"
                      : "bg-[#151D18] border-[#2A372F] text-[#9AAAA0] hover:border-[#3A4C40]"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: lens.color }}
                  />
                  <span className="text-[14px] font-medium tracking-tight">
                    {lens.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-8 flex flex-col items-center gap-4">
        <button
          onClick={handleStart}
          className="w-full h-14 bg-[#FFC857] hover:bg-[#E5B040] active:scale-[0.98] text-[#0E1411] font-bold text-[16px] rounded-btn flex items-center justify-center transition-all shadow-[0_4px_16px_rgba(255,200,87,0.25)]"
        >
          Start digging
        </button>

        <button
          onClick={() => router.push("/")}
          className="text-[14px] text-[#9AAAA0] hover:text-[#EAF1EC] font-medium transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
