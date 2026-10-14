"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flame, ArrowRight, Sparkles } from "lucide-react";
import { StoredRoot, UserStats, Lens } from "@/types/roots";
import { LENSES } from "@/lib/constants";
import { getStoredRoots, getUserStats } from "@/lib/storage/store";

export default function HomePage() {
  const router = useRouter();
  const [roots, setRoots] = useState<StoredRoot[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [greeting, setGreeting] = useState("Good day");

  useEffect(() => {
    // Check if first-time user
    const welcomed = localStorage.getItem("deeproots_welcomed");
    if (!welcomed) {
      router.push("/welcome");
      return;
    }

    const currentHour = new Date().getHours();
    if (currentHour < 12) setGreeting("Good morning");
    else if (currentHour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    const refreshData = () => {
      setRoots(getStoredRoots());
      setStats(getUserStats());
    };

    refreshData();
    window.addEventListener("deeproots_storage_updated", refreshData);
    return () => window.removeEventListener("deeproots_storage_updated", refreshData);
  }, [router]);

  if (!stats) return null;

  return (
    <div className="flex flex-col min-h-screen px-6 pt-10 pb-28">
      {/* Top Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <span className="text-[14px] text-[#9AAAA0] font-medium block">
            {greeting}
          </span>
          <h1 className="text-[28px] font-extrabold text-[#EAF1EC] tracking-tight leading-tight mt-0.5">
            What will you dig into?
          </h1>
        </div>

        {/* Top Actions: Streak Pill & Profile Avatar */}
        <div className="flex items-center gap-2">
          <Link
            href="/me"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1D2822] border border-[#2A372F] hover:border-[#FFC857]/50 transition-all text-[#EAF1EC]"
          >
            <Flame className="w-4 h-4 text-[#FFC857] fill-[#FFC857]" />
            <span className="text-[14px] font-bold">{stats.streak}</span>
          </Link>

          <Link
            href="/profile"
            className="w-9 h-9 rounded-full bg-[#151D18] border border-[#2A372F] hover:border-[#FFC857] flex items-center justify-center text-[14px] font-bold text-[#EAF1EC] transition-all"
          >
            {stats.profile?.displayName?.charAt(0) || "E"}
          </Link>
        </div>
      </div>

      {/* Root of the Day Card */}
      <Link
        href="/root/root-quarantine"
        className="group relative bg-[#151D18] hover:bg-[#18221C] border border-[#2A372F] hover:border-[#FFC857]/50 rounded-card p-5 mb-8 transition-all shadow-sm"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-bold tracking-wider text-[#FFC857] uppercase">
            Root of the day
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#7FB8FF]" />
          <span className="text-[12px] text-[#9AAAA0] font-medium">Language</span>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="pr-4">
            <h2 className="text-[26px] font-extrabold text-[#EAF1EC] tracking-tight">
              Quarantine
            </h2>
            <p className="text-[14px] text-[#9AAAA0] leading-snug mt-1">
              A word you use that is a number in disguise.
            </p>
          </div>

          <div className="w-12 h-12 rounded-full bg-[#FFC857] text-[#0E1411] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-[0_2px_8px_rgba(255,200,87,0.3)]">
            <ArrowRight className="w-5 h-5 stroke-[2.4]" />
          </div>
        </div>
      </Link>

      {/* This Week - Lens Exploration Rings */}
      <div className="mb-8">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-[18px] font-bold text-[#EAF1EC] tracking-tight">
            This week
          </h2>
          <span className="text-[12px] text-[#9AAAA0]">
            Points out of 10 per lens
          </span>
        </div>

        <div className="grid grid-cols-6 gap-2">
          {(Object.keys(LENSES) as Lens[]).map((key) => {
            const lens = LENSES[key];
            const count = stats.lensCounts[key] || 0;
            const progress = (count / 10) * 100;
            const circumference = 2 * Math.PI * 16;
            const strokeDashoffset = circumference - (progress / 100) * circumference;

            return (
              <div key={key} className="flex flex-col items-center">
                {/* SVG Progress Ring */}
                <div className="relative w-12 h-12 flex items-center justify-center mb-1.5">
                  <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="transparent"
                      stroke="#1D2822"
                      strokeWidth="3.2"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="transparent"
                      stroke={lens.color}
                      strokeWidth="3.2"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  <span className="absolute text-[13px] font-bold text-[#EAF1EC]">
                    {count}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-[#9AAAA0] tracking-tight truncate max-w-full">
                  {lens.shortLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Roots Section */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[18px] font-bold text-[#EAF1EC] tracking-tight">
            Recent roots
          </h2>
          <Link
            href="/tree"
            className="text-[13px] font-semibold text-[#FFC857] hover:underline"
          >
            See all
          </Link>
        </div>

        <div className="flex flex-col gap-2.5">
          {roots.slice(0, 5).map((root) => {
            return (
              <Link
                key={root.id}
                href={`/root/${root.id}`}
                className="flex items-center justify-between p-3.5 bg-[#151D18] hover:bg-[#1D2822] border border-[#2A372F] rounded-card transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div className="w-11 h-11 rounded-[14px] bg-[#1D2822] border border-[#2A372F] flex items-center justify-center text-lg flex-shrink-0 font-bold text-[#FFC857]">
                    {root.title.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-bold text-[#EAF1EC] tracking-tight truncate">
                      {root.title}
                    </h3>
                    <p className="text-[12px] text-[#9AAAA0] truncate">
                      {root.card.components?.length || 4} parts · {root.depth > 0 ? `Depth ${root.depth}` : "Origin scan"}
                    </p>
                  </div>
                </div>

                {/* Lens Color Dots */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {root.lenses?.slice(0, 3).map((l) => (
                    <span
                      key={l}
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: LENSES[l]?.color || "#FFC857" }}
                    />
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
