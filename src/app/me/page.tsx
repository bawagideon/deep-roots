"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Flame,
  Check,
  Lock,
  GitFork,
  Trash2,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { UserStats, Lens } from "@/types/roots";
import { getUserStats, clearAllData, getStoredRoots, getStoredEdges } from "@/lib/storage/store";
import { LENSES } from "@/lib/constants";

export default function ProgressPage() {
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [rootsCount, setRootsCount] = useState(0);
  const [edgesCount, setEdgesCount] = useState(0);

  useEffect(() => {
    setStats(getUserStats());
    setRootsCount(getStoredRoots().length);
    setEdgesCount(getStoredEdges().length);
  }, []);

  if (!stats) return null;

  const daysOfWeek = ["Mon", "Tue", "Wed", "Today", "Fri", "Sat", "Sun"];
  const checkedDays = [0, 1, 2, 3]; // Mon, Tue, Wed, Today

  const scansRemaining = Math.max(0, stats.scansLimit - stats.scansToday);

  return (
    <div className="flex flex-col min-h-screen px-6 pt-6 pb-28 bg-[#0E1411]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-[#151D18] border border-[#2A372F] flex items-center justify-center text-[#EAF1EC] hover:bg-[#1D2822] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-[18px] font-bold text-[#EAF1EC]">Progress</h1>
        <div className="w-10" />
      </div>

      {/* Streak Card */}
      <div className="bg-[#151D18] border border-[#2A372F] rounded-card p-5 mb-5 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <Flame className="w-7 h-7 text-[#FFC857] fill-[#FFC857]" />
          <div>
            <h2 className="text-[26px] font-extrabold text-[#EAF1EC] tracking-tight leading-none">
              {stats.streak} day streak
            </h2>
            <p className="text-[12px] text-[#9AAAA0] font-medium mt-1">
              Best: {stats.bestStreak} days
            </p>
          </div>
        </div>

        {/* 7-day strip */}
        <div className="grid grid-cols-7 gap-2 mt-5">
          {daysOfWeek.map((day, idx) => {
            const isChecked = checkedDays.includes(idx);
            const isToday = day === "Today";

            return (
              <div key={day} className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isChecked
                      ? isToday
                        ? "bg-[#FFC857] text-[#0E1411] ring-4 ring-[#FFC857]/20 font-bold"
                        : "bg-[#FFC857] text-[#0E1411] font-bold"
                      : "bg-[#1D2822] text-[#9AAAA0]/40 border border-[#2A372F]"
                  }`}
                >
                  {isChecked ? <Check className="w-5 h-5 stroke-[3]" /> : null}
                </div>
                <span
                  className={`text-[11px] font-semibold ${
                    isToday ? "text-[#FFC857]" : "text-[#9AAAA0]"
                  }`}
                >
                  {day}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Counts Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="p-4 bg-[#151D18] border border-[#2A372F] rounded-card">
          <span className="text-[26px] font-extrabold text-[#EAF1EC] tracking-tight block">
            {rootsCount}
          </span>
          <span className="text-[12px] font-semibold text-[#9AAAA0]">Roots</span>
        </div>

        <div className="p-4 bg-[#151D18] border border-[#2A372F] rounded-card">
          <span className="text-[26px] font-extrabold text-[#EAF1EC] tracking-tight block">
            {stats.totalRabbitHoles || 7}
          </span>
          <span className="text-[12px] font-semibold text-[#9AAAA0]">Rabbit holes</span>
        </div>

        <div className="p-4 bg-[#151D18] border border-[#2A372F] rounded-card">
          <span className="text-[26px] font-extrabold text-[#EAF1EC] tracking-tight block">
            {edgesCount || 9}
          </span>
          <span className="text-[12px] font-semibold text-[#9AAAA0]">Links</span>
        </div>
      </div>

      {/* Lens Levels (Exploration progress) */}
      <div className="mb-6">
        <h2 className="text-[18px] font-bold text-[#EAF1EC] tracking-tight mb-3">
          Lens levels
        </h2>

        <div className="p-4 bg-[#151D18] border border-[#2A372F] rounded-card flex flex-col gap-3.5">
          {(Object.keys(LENSES) as Lens[]).map((key) => {
            const lens = LENSES[key];
            const count = stats.lensCounts[key] || 0;
            const level = Math.max(1, Math.floor(count / 3));
            const progress = Math.min(100, (count / 10) * 100);

            return (
              <div key={key} className="flex items-center gap-3">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: lens.color }}
                />
                <span className="text-[13px] font-bold text-[#EAF1EC] w-24 truncate">
                  {lens.label}
                </span>

                <div className="flex-1 h-2 bg-[#1D2822] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progress}%`,
                      backgroundColor: lens.color,
                    }}
                  />
                </div>

                <span className="text-[12px] font-bold text-[#9AAAA0] w-9 text-right">
                  Lv {level}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Badges Section */}
      <div className="mb-6">
        <h2 className="text-[18px] font-bold text-[#EAF1EC] tracking-tight mb-3">
          Badges
        </h2>

        <div className="grid grid-cols-3 gap-3">
          {stats.badges.slice(0, 3).map((badge) => (
            <div
              key={badge.id}
              className={`p-3.5 rounded-card border flex flex-col items-center text-center justify-between min-h-[110px] ${
                badge.unlocked
                  ? "bg-[#151D18] border-[#2A372F]"
                  : "bg-[#151D18]/50 border-[#2A372F]/50 opacity-60"
              }`}
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center mb-2 ${
                  badge.unlocked
                    ? "bg-[#231A00] border border-[#FFC857]/50 text-[#FFC857]"
                    : "bg-[#1D2822] text-[#9AAAA0]"
                }`}
              >
                {badge.icon === "first_root" ? (
                  <GitFork className="w-5 h-5 rotate-180" />
                ) : badge.icon === "streak" ? (
                  <Flame className="w-5 h-5 fill-current" />
                ) : (
                  <Lock className="w-5 h-5" />
                )}
              </div>

              <span className="text-[11px] font-bold text-[#EAF1EC] leading-tight">
                {badge.name}
              </span>
              {badge.progress && (
                <span className="text-[10px] text-[#9AAAA0] mt-0.5 font-medium">
                  {badge.progress}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Scans Left Today Meter */}
      <div className="p-4 bg-[#151D18] border border-[#2A372F] rounded-card flex items-center justify-between mb-6">
        <span className="text-[13px] font-semibold text-[#9AAAA0]">
          Scans left today
        </span>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: stats.scansLimit }).map((_, i) => (
            <div
              key={i}
              className={`w-5 h-2 rounded-full transition-colors ${
                i < scansRemaining ? "bg-[#FFC857]" : "bg-[#1D2822]"
              }`}
            />
          ))}
          <span className="text-[12px] font-bold text-[#EAF1EC] ml-2">
            {scansRemaining} of {stats.scansLimit}
          </span>
        </div>
      </div>

      {/* Privacy & Account Controls */}
      <div className="pt-2 border-t border-[#2A372F] flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[12px] text-[#9AAAA0]">
          <ShieldCheck className="w-4 h-4 text-[#9BE564]" />
          <span>Local anonymous session. No private trackers.</span>
        </div>

        <button
          onClick={() => {
            if (confirm("Reset all saved roots and progress to fresh state?")) {
              clearAllData();
              window.location.reload();
            }
          }}
          className="text-left text-[12px] font-semibold text-red-400 hover:text-red-300 flex items-center gap-2 py-1 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete my saved data</span>
        </button>
      </div>
    </div>
  );
}
