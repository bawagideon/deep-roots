"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  User,
  ShieldCheck,
  ExternalLink,
  LogOut,
  Loader2,
  AlertTriangle,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useUser, useClerk } from "@clerk/nextjs";
import { UserStats, Lens } from "@/types/roots";
import {
  getUserStats,
  getStoredRoots,
  getStoredEdges,
  syncRootsFromCloud,
  clearUserDataOnSignOut,
  setActiveUser,
} from "@/lib/storage/store";
import { LENSES } from "@/lib/constants";

type SyncState = "idle" | "syncing" | "synced" | "failed" | "offline";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [userRootsCount, setUserRootsCount] = useState(0);
  const [edgesCount, setEdgesCount] = useState(0);
  const [serverPlan, setServerPlan] = useState<"free" | "pro">("free");
  const [syncStatus, setSyncStatus] = useState<SyncState>("idle");
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  const handleSync = async (targetUserId?: string | null) => {
    const uid = targetUserId !== undefined ? targetUserId : user?.id;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncStatus("offline");
      return;
    }
    setSyncStatus("syncing");
    setSyncErrorMessage(null);
    try {
      const res = await syncRootsFromCloud(uid);
      if (res.synced) {
        setSyncStatus("synced");
        const updatedRoots = getStoredRoots(uid).filter((r) => !r.isSeeded);
        setUserRootsCount(updatedRoots.length);
        setEdgesCount(getStoredEdges(uid).length);
      } else {
        if (res.error === "offline") {
          setSyncStatus("offline");
        } else {
          setSyncStatus("failed");
          setSyncErrorMessage(res.error || "Sync incomplete");
        }
      }
    } catch (err: any) {
      setSyncStatus("failed");
      setSyncErrorMessage(err?.message || "Sync connection error");
    }
  };

  useEffect(() => {
    setActiveUser(user?.id);
    const s = getUserStats(user?.id);
    setStats(s);

    const roots = getStoredRoots(user?.id).filter((r) => !r.isSeeded);
    setUserRootsCount(roots.length);

    const edges = getStoredEdges(user?.id);
    setEdgesCount(edges.length);

    // Sync user with backend profile and fetch live entitlement status
    if (user?.id) {
      handleSync(user.id);

      fetch("/api/me")
        .then((res) => res.json())
        .then((data) => {
          if (data?.plan) setServerPlan(data.plan);
        })
        .catch(() => {});
    }
  }, [user?.id]);

  if (!stats) return null;

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

          <div className="w-10 h-10 flex items-center justify-center">
            <SignedIn>
              <UserButton afterSignOutUrl="/welcome" />
            </SignedIn>
          </div>
        </div>

        {/* Signed In View */}
        <SignedIn>
          <div className="flex items-center gap-4 mb-7">
            <div
              className="w-20 h-20 rounded-full bg-[#151D18] border-2 flex items-center justify-center text-[28px] font-black text-[#EAF1EC] flex-shrink-0 shadow-sm relative overflow-hidden"
              style={{ borderColor: topLensColor }}
            >
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.fullName || "User"}
                  className="w-full h-full object-cover"
                />
              ) : (
                (user?.firstName?.charAt(0) || user?.username?.charAt(0) || "E").toUpperCase()
              )}
            </div>

            <div className="min-w-0">
              <h2 className="text-[22px] font-extrabold text-[#EAF1EC] tracking-tight truncate leading-tight">
                {user?.fullName || user?.username || "Explorer"}
              </h2>

              <p className="text-[13px] text-[#9AAAA0] mt-0.5 truncate">
                {user?.primaryEmailAddress?.emailAddress || "Signed in"}
              </p>

              <div className="flex items-center gap-2 mt-2">
                <span className="px-3 py-1 rounded-full bg-[#151D18] border border-[#2A372F] text-[12px] font-semibold text-[#9BE564] capitalize flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {serverPlan === "pro" ? "Pro Plan" : "Free Plan"}
                </span>
                {serverPlan === "free" && (
                  <Link
                    href="/upgrade"
                    className="text-[12px] font-bold text-[#FFC857] hover:underline"
                  >
                    Upgrade →
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Dynamic Sync Status Card */}
          <div className="bg-[#151D18] border border-[#2A372F] rounded-[22px] p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {syncStatus === "syncing" && (
                <div className="w-10 h-10 rounded-full bg-[#1D2822] flex items-center justify-center text-[#FFC857]">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              )}
              {syncStatus === "synced" && (
                <div className="w-10 h-10 rounded-full bg-[#1D2822] flex items-center justify-center text-[#9BE564]">
                  <Check className="w-5 h-5 stroke-[2.5]" />
                </div>
              )}
              {syncStatus === "failed" && (
                <div className="w-10 h-10 rounded-full bg-[#2A1512] flex items-center justify-center text-[#FF6B6B]">
                  <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                </div>
              )}
              {syncStatus === "offline" && (
                <div className="w-10 h-10 rounded-full bg-[#1D2822] flex items-center justify-center text-[#9AAAA0]">
                  <WifiOff className="w-5 h-5" />
                </div>
              )}
              {syncStatus === "idle" && (
                <div className="w-10 h-10 rounded-full bg-[#1D2822] flex items-center justify-center text-[#9AAAA0]">
                  <Check className="w-5 h-5" />
                </div>
              )}

              <div>
                <span className="text-[14px] font-bold text-[#EAF1EC] block">
                  {syncStatus === "syncing" && "Syncing your Tree..."}
                  {syncStatus === "synced" && "Tree Synced & Backed Up"}
                  {syncStatus === "failed" && "Sync Incomplete"}
                  {syncStatus === "offline" && "Offline - Local Only"}
                  {syncStatus === "idle" && "Cloud Backup Ready"}
                </span>
                <span className="text-[12px] text-[#9AAAA0]">
                  {syncStatus === "syncing" && "Connecting to verified cloud storage..."}
                  {syncStatus === "synced" && "Connected to verified Clerk account"}
                  {syncStatus === "failed" && (syncErrorMessage || "Failed to sync some discoveries")}
                  {syncStatus === "offline" && "Discoveries safely stored on this device"}
                  {syncStatus === "idle" && "Ready to sync with verified account"}
                </span>
              </div>
            </div>

            {(syncStatus === "failed" || syncStatus === "offline") && (
              <button
                onClick={() => handleSync()}
                className="px-3 py-1.5 rounded-full bg-[#1D2822] hover:bg-[#2A372F] border border-[#2A372F] text-[12px] font-bold text-[#FFC857] flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            )}
          </div>
        </SignedIn>

        {/* Signed Out View */}
        <SignedOut>
          <div className="flex items-center gap-4 mb-7">
            <div
              className="w-20 h-20 rounded-full bg-[#151D18] border-2 border-[#2A372F] flex items-center justify-center text-[#9AAAA0] flex-shrink-0 shadow-sm"
            >
              <User className="w-8 h-8" />
            </div>

            <div className="min-w-0">
              <h2 className="text-[22px] font-extrabold text-[#EAF1EC] tracking-tight leading-tight">
                Guest Explorer
              </h2>
              <p className="text-[13px] text-[#9AAAA0] mt-0.5">
                Saved in local browser memory
              </p>
              <span className="inline-block mt-2 px-3 py-1 rounded-full bg-[#151D18] border border-[#2A372F] text-[12px] font-semibold text-[#9AAAA0]">
                Free Guest
              </span>
            </div>
          </div>

          <div className="bg-[#151D18] border border-[#FFC857] rounded-[22px] p-5 mb-6 shadow-sm">
            <h3 className="text-[18px] font-bold text-[#EAF1EC] tracking-tight mb-1">
              Save your Tree
            </h3>
            <p className="text-[13px] text-[#9AAAA0] leading-snug mb-4">
              You are currently using local storage. Sign in with Clerk so your discoveries and Tree follow you everywhere.
            </p>

            <div className="flex items-center gap-3">
              <SignInButton mode="modal">
                <button className="flex-1 h-12 bg-[#FFC857] hover:bg-[#E5B040] text-[#0E1411] font-bold text-[14px] rounded-btn flex items-center justify-center transition-all shadow-sm">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="flex-1 h-12 bg-[#1D2822] hover:bg-[#23312A] border border-[#2A372F] text-[#EAF1EC] font-bold text-[14px] rounded-btn flex items-center justify-center transition-all">
                  Create Account
                </button>
              </SignUpButton>
            </div>
          </div>
        </SignedOut>

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

      {/* Bottom Area: Settings Button & Sign Out */}
      <div className="flex flex-col gap-3">
        <Link
          href="/settings"
          className="w-full h-14 bg-[#151D18] hover:bg-[#1D2822] border border-[#2A372F] text-[#EAF1EC] font-bold text-[15px] rounded-btn flex items-center justify-center transition-colors"
        >
          Settings
        </Link>

        <SignedIn>
          <button
            onClick={async () => {
              setIsSigningOut(true);
              try {
                await clearUserDataOnSignOut();
                await new Promise((r) => setTimeout(r, 900)); // Retract animation pause
                await signOut({ redirectUrl: "/welcome" });
              } catch {
                router.push("/welcome");
              }
            }}
            disabled={isSigningOut}
            className="w-full h-12 bg-[#1A130B] hover:bg-[#2A1F12] border border-[#7A4E00]/40 text-[#FFC857] font-semibold text-[14px] rounded-btn flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            <span>{isSigningOut ? "Securing and signing out..." : "Sign Out"}</span>
          </button>
        </SignedIn>

        <p className="text-[12px] text-[#9AAAA0] text-center leading-relaxed px-2">
          Your Tree is private. Only cards you choose to share are public.
        </p>
      </div>

      {/* Roots Retract Sign-Out Animation Overlay */}
      {isSigningOut && (
        <div className="fixed inset-0 z-50 bg-[#0E1411]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-[#231A00] border-2 border-[#FFC857] flex items-center justify-center shadow-[0_0_30px_rgba(255,200,87,0.3)] mb-4 animate-pulse">
            <div className="w-4 h-4 rounded-full bg-[#FFC857] shadow-[0_0_12px_#FFC857]" />
          </div>
          <h2 className="text-[20px] font-bold text-[#EAF1EC] tracking-tight mb-2">
            Your roots are safe.
          </h2>
          <p className="text-[14px] text-[#9AAAA0] max-w-[260px]">
            Device storage cleared. Encrypted in cloud.
          </p>
        </div>
      )}
    </div>
  );
}
