"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Settings as SettingsIcon,
  Check,
  Mail,
  X,
} from "lucide-react";
import { UserStats, Lens, UserProfile } from "@/types/roots";
import {
  getUserStats,
  saveUserProfile,
  getStoredRoots,
  getStoredEdges,
} from "@/lib/storage/store";
import { LENSES } from "@/lib/constants";

export default function ProfilePage() {
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [userRootsCount, setUserRootsCount] = useState(0);
  const [edgesCount, setEdgesCount] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("Explorer");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  useEffect(() => {
    const s = getUserStats();
    setStats(s);
    setDisplayName(s.profile?.displayName || "Explorer");

    const roots = getStoredRoots().filter((r) => !r.isSeeded);
    setUserRootsCount(roots.length);

    const edges = getStoredEdges();
    setEdgesCount(edges.length);
  }, []);

  if (!stats) return null;

  const profile = stats.profile || {
    id: "anon",
    displayName: "Explorer",
    isAnonymous: true,
    plan: "free",
    memberSince: "October 2026",
  };

  const handleSaveName = () => {
    const updated: UserProfile = {
      ...profile,
      displayName: displayName.trim() || "Explorer",
    };
    saveUserProfile(updated);
    setStats(getUserStats());
    setIsEditing(false);
  };

  const handleSignInGoogle = () => {
    const updated: UserProfile = {
      ...profile,
      displayName: "Gideon",
      email: "gideon@example.com",
      isAnonymous: false,
    };
    saveUserProfile(updated);
    setStats(getUserStats());
  };

  const handleSignInEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    const namePart = emailInput.split("@")[0];
    const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    const updated: UserProfile = {
      ...profile,
      displayName: capitalized,
      email: emailInput.trim(),
      isAnonymous: false,
    };
    saveUserProfile(updated);
    setStats(getUserStats());
    setShowEmailModal(false);
  };

  // Find top lens
  const topLensKey = (Object.keys(stats.lensCounts) as Lens[]).reduce(
    (max, curr) => (stats.lensCounts[curr] > stats.lensCounts[max] ? curr : max),
    "language" as Lens
  );
  const topLensColor = LENSES[topLensKey]?.color || "#FFC857";

  return (
    <div className="flex flex-col min-h-screen px-6 pt-6 pb-12 bg-[#0E1411] justify-between">
      <div>
        {/* Top Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-[#151D18] border border-[#2A372F] flex items-center justify-center text-[#EAF1EC] hover:bg-[#1D2822] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <h1 className="text-[18px] font-bold text-[#EAF1EC] tracking-tight">
            Profile
          </h1>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-[15px] font-semibold text-[#FFC857] hover:underline"
          >
            {isEditing ? "Done" : "Edit"}
          </button>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-4 mb-7">
          {/* Avatar with top lens ring */}
          <div
            className="w-20 h-20 rounded-full bg-[#151D18] border-2 flex items-center justify-center text-[30px] font-black text-[#EAF1EC] flex-shrink-0 shadow-sm"
            style={{ borderColor: topLensColor }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-[#1D2822] border border-[#2A372F] rounded-lg px-2.5 py-1 text-[#EAF1EC] font-bold text-[18px] outline-none max-w-[160px]"
                />
                <button
                  onClick={handleSaveName}
                  className="p-1 rounded-lg bg-[#FFC857] text-[#0E1411]"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <h2 className="text-[26px] font-extrabold text-[#EAF1EC] tracking-tight truncate leading-tight">
                {displayName}
              </h2>
            )}

            <p className="text-[13px] text-[#9AAAA0] mt-0.5">
              Member since {profile.memberSince || "October 2026"}
            </p>

            <span className="inline-block mt-2 px-3 py-1 rounded-full bg-[#151D18] border border-[#2A372F] text-[12px] font-semibold text-[#9AAAA0] capitalize">
              {profile.plan === "pro" ? "Pro plan" : "Free plan"}
            </span>
          </div>
        </div>

        {/* Save your Tree Callout Card */}
        {profile.isAnonymous ? (
          <div className="bg-[#151D18] border border-[#FFC857] rounded-[22px] p-5 mb-6 shadow-sm">
            <h3 className="text-[18px] font-bold text-[#EAF1EC] tracking-tight mb-1">
              Save your Tree
            </h3>
            <p className="text-[13px] text-[#9AAAA0] leading-snug mb-4">
              You are a guest. Add a sign-in so your roots follow you to any
              device.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSignInGoogle}
                className="flex-1 h-12 bg-[#FFC857] hover:bg-[#E5B040] text-[#0E1411] font-bold text-[14px] rounded-btn flex items-center justify-center transition-all shadow-sm"
              >
                Continue with Google
              </button>
              <button
                onClick={() => setShowEmailModal(true)}
                className="flex-1 h-12 bg-[#1D2822] hover:bg-[#23312A] border border-[#2A372F] text-[#EAF1EC] font-bold text-[14px] rounded-btn flex items-center justify-center transition-all"
              >
                Use email
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#151D18] border border-[#2A372F] rounded-[22px] p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1D2822] flex items-center justify-center text-[#9BE564]">
                <Check className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-[14px] font-bold text-[#EAF1EC] block">
                  Tree Synced & Backed Up
                </span>
                <span className="text-[12px] text-[#9AAAA0]">
                  Connected as {profile.email}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-7">
          <div className="p-4 bg-[#151D18] border border-[#2A372F] rounded-[18px]">
            <span className="text-[28px] font-extrabold text-[#EAF1EC] tracking-tight block leading-none">
              {userRootsCount}
            </span>
            <span className="text-[13px] font-semibold text-[#9AAAA0] mt-1.5 block">
              Roots
            </span>
          </div>

          <div className="p-4 bg-[#151D18] border border-[#2A372F] rounded-[18px]">
            <span className="text-[28px] font-extrabold text-[#EAF1EC] tracking-tight block leading-none">
              {stats.streak}
            </span>
            <span className="text-[13px] font-semibold text-[#9AAAA0] mt-1.5 block">
              Day streak
            </span>
          </div>

          <div className="p-4 bg-[#151D18] border border-[#2A372F] rounded-[18px]">
            <span className="text-[28px] font-extrabold text-[#EAF1EC] tracking-tight block leading-none">
              {edgesCount}
            </span>
            <span className="text-[13px] font-semibold text-[#9AAAA0] mt-1.5 block">
              Links
            </span>
          </div>
        </div>

        {/* Lenses explored Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-[18px] font-bold text-[#EAF1EC] tracking-tight">
              Lenses explored
            </h3>
            <Link
              href="/me"
              className="text-[14px] font-semibold text-[#FFC857] hover:underline"
            >
              Progress
            </Link>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {(Object.keys(LENSES) as Lens[]).map((key) => {
              const lens = LENSES[key];
              const count = stats.lensCounts[key] || 0;
              if (count === 0 && !stats.selectedLenses?.includes(key)) return null;

              return (
                <div
                  key={key}
                  className="h-10 px-3.5 rounded-full bg-[#151D18] border border-[#2A372F] flex items-center gap-2"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: lens.color }}
                  />
                  <span className="text-[13px] font-semibold text-[#EAF1EC]">
                    {lens.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Area: Settings Button & Privacy Disclaimer */}
      <div className="flex flex-col gap-4">
        <Link
          href="/settings"
          className="w-full h-14 bg-[#151D18] hover:bg-[#1D2822] border border-[#2A372F] text-[#EAF1EC] font-bold text-[15px] rounded-btn flex items-center justify-center transition-colors"
        >
          Settings
        </Link>

        <p className="text-[12px] text-[#9AAAA0] text-center leading-relaxed px-2">
          Your Tree is private. Only cards you choose to share are public.
        </p>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-[360px] bg-[#0E1411] border border-[#2A372F] rounded-[24px] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[17px] font-bold text-[#EAF1EC]">
                Sign in with Email
              </h3>
              <button
                onClick={() => setShowEmailModal(false)}
                className="w-8 h-8 rounded-full bg-[#151D18] flex items-center justify-center text-[#9AAAA0]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSignInEmail} className="flex flex-col gap-4">
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full h-12 bg-[#151D18] border border-[#2A372F] rounded-[14px] px-3.5 text-[#EAF1EC] text-[14px] outline-none focus:border-[#FFC857]"
              />

              <button
                type="submit"
                className="w-full h-12 bg-[#FFC857] hover:bg-[#E5B040] text-[#0E1411] font-bold text-[14px] rounded-btn transition-all"
              >
                Send magic link
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
