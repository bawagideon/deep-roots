"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Sliders,
  Bell,
  Shield,
  HelpCircle,
  Eye,
  ChevronRight,
  Download,
  Trash2,
  X,
  FileText,
  FileJson,
} from "lucide-react";
import { UserStats } from "@/types/roots";
import { getUserStats, clearAllData } from "@/lib/storage/store";
import { PaywallModal } from "@/components/paywall/PaywallModal";
import { exportTreeAsJSON, exportTreeAsMarkdown } from "@/lib/export";

export default function SettingsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showPrivacySheet, setShowPrivacySheet] = useState(false);
  const [showHelpSheet, setShowHelpSheet] = useState(false);
  const [showAppearanceNotice, setShowAppearanceNotice] = useState(false);

  useEffect(() => {
    setStats(getUserStats());
  }, []);

  if (!stats) return null;

  const plan = stats.profile?.plan || "free";
  const scansRemaining = Math.max(0, stats.scansLimit - (stats.scansToday || 0));

  const handleDeleteAll = () => {
    if (
      confirm(
        "Are you sure you want to delete all saved roots, streaks, and preferences? This action cannot be undone."
      )
    ) {
      clearAllData();
      router.push("/welcome");
    }
  };

  return (
    <div className="flex flex-col min-h-screen px-6 pt-6 pb-12 bg-[#0E1411]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-[#151D18] border border-[#2A372F] flex items-center justify-center text-[#EAF1EC] hover:bg-[#1D2822] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h1 className="text-[18px] font-bold text-[#EAF1EC] tracking-tight">
          Settings
        </h1>

        <div className="w-10" />
      </div>

      {/* Plan Card */}
      <div className="bg-[#151D18] border border-[#2A372F] rounded-[22px] p-5 mb-5 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold text-[#9AAAA0] uppercase tracking-wider block mb-0.5">
            YOUR PLAN
          </span>
          <h2 className="text-[24px] font-extrabold text-[#EAF1EC] capitalize">
            {plan === "pro" ? "Pro" : "Free"}
          </h2>
          <p className="text-[13px] text-[#9AAAA0] mt-0.5">
            {plan === "pro"
              ? "High fair-use cap active"
              : `${scansRemaining} of ${stats.scansLimit} scans left today`}
          </p>
        </div>

        {plan === "free" ? (
          <button
            onClick={() => setShowPaywall(true)}
            className="px-5 py-2.5 bg-[#FFC857] hover:bg-[#E5B040] text-[#0E1411] font-bold text-[14px] rounded-full shadow-sm transition-all"
          >
            Upgrade
          </button>
        ) : (
          <span className="px-3.5 py-1.5 bg-[#231A00] border border-[#FFC857]/50 text-[#FFC857] font-bold text-[12px] rounded-full">
            Active
          </span>
        )}
      </div>

      {/* Menu Options */}
      <div className="flex flex-col gap-2.5 mb-8">
        {/* Account */}
        <Link
          href="/profile"
          className="flex items-center justify-between p-4 bg-[#151D18] hover:bg-[#18221C] border border-[#2A372F] rounded-[18px] transition-colors"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-[14px] bg-[#1D2822] border border-[#2A372F] flex items-center justify-center text-[#9AAAA0] flex-shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[15px] font-bold text-[#EAF1EC] block leading-tight">
                Account
              </span>
              <span className="text-[12px] text-[#9AAAA0] truncate block mt-0.5">
                {stats.profile?.email || "Guest. Save your Tree"}
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#9AAAA0]/60 flex-shrink-0" />
        </Link>

        {/* Preferences */}
        <Link
          href="/preferences"
          className="flex items-center justify-between p-4 bg-[#151D18] hover:bg-[#18221C] border border-[#2A372F] rounded-[18px] transition-colors"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-[14px] bg-[#1D2822] border border-[#2A372F] flex items-center justify-center text-[#9AAAA0] flex-shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[15px] font-bold text-[#EAF1EC] block leading-tight">
                Preferences
              </span>
              <span className="text-[12px] text-[#9AAAA0] truncate block mt-0.5">
                Lenses, depth, language, tone
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#9AAAA0]/60 flex-shrink-0" />
        </Link>

        {/* Notifications */}
        <Link
          href="/preferences"
          className="flex items-center justify-between p-4 bg-[#151D18] hover:bg-[#18221C] border border-[#2A372F] rounded-[18px] transition-colors"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-[14px] bg-[#1D2822] border border-[#2A372F] flex items-center justify-center text-[#9AAAA0] flex-shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[15px] font-bold text-[#EAF1EC] block leading-tight">
                Notifications
              </span>
              <span className="text-[12px] text-[#9AAAA0] truncate block mt-0.5">
                Daily Root at {stats.preferences?.notifications.dailyRoot.time || "8:00 am"}
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#9AAAA0]/60 flex-shrink-0" />
        </Link>

        {/* Privacy and data */}
        <div
          onClick={() => setShowPrivacySheet(true)}
          className="flex items-center justify-between p-4 bg-[#151D18] hover:bg-[#18221C] border border-[#2A372F] rounded-[18px] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-[14px] bg-[#1D2822] border border-[#2A372F] flex items-center justify-center text-[#9AAAA0] flex-shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[15px] font-bold text-[#EAF1EC] block leading-tight">
                Privacy and data
              </span>
              <span className="text-[12px] text-[#9AAAA0] truncate block mt-0.5">
                Image retention, export, delete
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#9AAAA0]/60 flex-shrink-0" />
        </div>

        {/* Appearance and access */}
        <div
          onClick={() => setShowAppearanceNotice(!showAppearanceNotice)}
          className="flex items-center justify-between p-4 bg-[#151D18] hover:bg-[#18221C] border border-[#2A372F] rounded-[18px] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-[14px] bg-[#1D2822] border border-[#2A372F] flex items-center justify-center text-[#9AAAA0] flex-shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[15px] font-bold text-[#EAF1EC] block leading-tight">
                Appearance and access
              </span>
              <span className="text-[12px] text-[#9AAAA0] truncate block mt-0.5">
                Text size, pinch-zoom, system theme
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#9AAAA0]/60 flex-shrink-0" />
        </div>

        {showAppearanceNotice && (
          <div className="p-3.5 bg-[#181F1A] border border-[#2A372F] rounded-[16px] text-[13px] text-[#9AAAA0] leading-relaxed animate-fade-in">
            Deep Roots uses system dark mode with high contrast WCAG-compliant
            color palettes. Pinch-to-zoom is fully enabled across all screens.
          </div>
        )}

        {/* Help and about */}
        <div
          onClick={() => setShowHelpSheet(true)}
          className="flex items-center justify-between p-4 bg-[#151D18] hover:bg-[#18221C] border border-[#2A372F] rounded-[18px] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-[14px] bg-[#1D2822] border border-[#2A372F] flex items-center justify-center text-[#9AAAA0] flex-shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[15px] font-bold text-[#EAF1EC] block leading-tight">
                Help and about
              </span>
              <span className="text-[12px] text-[#9AAAA0] truncate block mt-0.5">
                FAQ, support, Terms, Privacy, AI notice
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#9AAAA0]/60 flex-shrink-0" />
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col items-center gap-4 mt-auto">
        <button
          onClick={() => {
            alert("Signed out from local session.");
            router.push("/welcome");
          }}
          className="text-[15px] font-semibold text-[#EAF1EC] hover:text-[#FFC857] transition-colors"
        >
          Sign out
        </button>

        <button
          onClick={handleDeleteAll}
          className="text-[14px] font-semibold text-[#E06D53] hover:text-red-400 transition-colors"
        >
          Delete my account and data
        </button>

        <span className="text-[12px] font-medium text-[#9AAAA0]/60 mt-2">
          Deep Roots v0.1.0
        </span>
      </div>

      {/* Privacy and Data Sheet */}
      {showPrivacySheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-[440px] bg-[#0E1411] border-t border-[#2A372F] rounded-t-[32px] px-6 pt-4 pb-8 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[18px] font-bold text-[#EAF1EC]">
                Privacy & Data Export
              </h3>
              <button
                onClick={() => setShowPrivacySheet(false)}
                className="w-8 h-8 rounded-full bg-[#151D18] flex items-center justify-center text-[#9AAAA0]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[13px] text-[#9AAAA0] leading-snug mb-5">
              Your knowledge graph and saved discoveries belong to you. Export
              your entire Tree in open formats anytime.
            </p>

            <div className="flex flex-col gap-3 mb-6">
              <button
                onClick={() => exportTreeAsMarkdown()}
                className="h-13 px-4 rounded-[16px] bg-[#151D18] hover:bg-[#1D2822] border border-[#2A372F] flex items-center justify-between text-[#EAF1EC] font-semibold text-[14px] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-[#FFC857]" />
                  <span>Export Tree as Markdown (.md)</span>
                </div>
                <Download className="w-4 h-4 text-[#9AAAA0]" />
              </button>

              <button
                onClick={() => exportTreeAsJSON()}
                className="h-13 px-4 rounded-[16px] bg-[#151D18] hover:bg-[#1D2822] border border-[#2A372F] flex items-center justify-between text-[#EAF1EC] font-semibold text-[14px] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileJson className="w-5 h-5 text-[#7FB8FF]" />
                  <span>Export Complete Graph (.json)</span>
                </div>
                <Download className="w-4 h-4 text-[#9AAAA0]" />
              </button>
            </div>

            <div className="p-3.5 bg-[#181F1A] border border-[#2A372F] rounded-[16px] mb-4">
              <span className="text-[12px] font-bold text-[#EAF1EC] block mb-1">
                Zero-Retention Camera Mode
              </span>
              <p className="text-[12px] text-[#9AAAA0]">
                Photos processed by Deep Roots are evaluated entirely in memory
                and stripped of EXIF metadata.
              </p>
            </div>

            <button
              onClick={() => {
                setShowPrivacySheet(false);
                handleDeleteAll();
              }}
              className="text-center text-[13px] font-semibold text-[#E06D53] hover:underline"
            >
              Clear all local cache & storage
            </button>
          </div>
        </div>
      )}

      {/* Help and About Sheet */}
      {showHelpSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-[440px] bg-[#0E1411] border-t border-[#2A372F] rounded-t-[32px] px-6 pt-4 pb-8 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[18px] font-bold text-[#EAF1EC]">
                Help & About
              </h3>
              <button
                onClick={() => setShowHelpSheet(false)}
                className="w-8 h-8 rounded-full bg-[#151D18] flex items-center justify-center text-[#9AAAA0]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2 mb-6">
              <Link
                href="/ai-disclosure"
                className="p-3.5 bg-[#151D18] hover:bg-[#1D2822] rounded-[14px] border border-[#2A372F] flex items-center justify-between text-[#EAF1EC] text-[14px] font-medium"
              >
                <span>AI Transparency & Verification Notice</span>
                <ChevronRight className="w-4 h-4 text-[#9AAAA0]" />
              </Link>

              <Link
                href="/terms"
                className="p-3.5 bg-[#151D18] hover:bg-[#1D2822] rounded-[14px] border border-[#2A372F] flex items-center justify-between text-[#EAF1EC] text-[14px] font-medium"
              >
                <span>Terms of Service</span>
                <ChevronRight className="w-4 h-4 text-[#9AAAA0]" />
              </Link>

              <Link
                href="/privacy"
                className="p-3.5 bg-[#151D18] hover:bg-[#1D2822] rounded-[14px] border border-[#2A372F] flex items-center justify-between text-[#EAF1EC] text-[14px] font-medium"
              >
                <span>Privacy Policy</span>
                <ChevronRight className="w-4 h-4 text-[#9AAAA0]" />
              </Link>
            </div>

            <p className="text-[12px] text-[#9AAAA0] text-center">
              Questions or bug reports? Reach out at{" "}
              <a
                href="mailto:support@deeproots.app"
                className="text-[#FFC857] hover:underline"
              >
                support@deeproots.app
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => {
          setShowPaywall(false);
          setStats(getUserStats());
        }}
      />
    </div>
  );
}
