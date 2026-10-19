"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ScanLine } from "lucide-react";

export function BottomTabBar() {
  const pathname = usePathname();
  const [isLanded, setIsLanded] = useState(false);

  useEffect(() => {
    const handleLanded = () => {
      setIsLanded(true);
      const timer = setTimeout(() => setIsLanded(false), 950);
      return () => clearTimeout(timer);
    };

    window.addEventListener("deeproots_seed_landed", handleLanded);
    return () => window.removeEventListener("deeproots_seed_landed", handleLanded);
  }, []);

  // Hide tab bar on scan viewfinder screen, welcome screen, settings, preferences, upgrade, try, share, or legal screens
  if (
    pathname === "/scan" ||
    pathname === "/welcome" ||
    pathname === "/try" ||
    pathname === "/upgrade" ||
    pathname === "/settings" ||
    pathname === "/preferences" ||
    pathname === "/admin" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/ai-disclosure" ||
    pathname.startsWith("/scan/") ||
    pathname.startsWith("/r/") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up")
  ) {
    return null;
  }

  const isHome = pathname === "/";
  const isTree = pathname === "/tree";

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] h-[88px] nav-backdrop border-t border-[#2A372F] z-40 px-8 flex items-center justify-between pb-4">
      {/* Home tab */}
      <Link
        href="/"
        className={`flex flex-col items-center gap-1 transition-colors ${
          isHome ? "text-[#FFC857]" : "text-[#9AAAA0] hover:text-[#EAF1EC]"
        }`}
      >
        <Home className="w-6 h-6 stroke-[2.2]" />
        <span className="text-[12px] font-medium tracking-tight">Home</span>
      </Link>

      {/* Floating Center Scan Button */}
      <Link
        href="/scan"
        aria-label="Scan or Decompose"
        className="group relative -translate-y-5"
      >
        <div className="w-[66px] h-[66px] rounded-full bg-[#FFC857] border-[5px] border-[#0E1411] flex items-center justify-center text-[#0E1411] shadow-[0_8px_24px_rgba(255,200,87,0.35)] transition-transform group-hover:scale-105 active:scale-95">
          <ScanLine className="w-7 h-7 stroke-[2.4]" />
        </div>
      </Link>

      {/* Tree Sprout tab */}
      <Link
        href="/tree"
        id="tabTree"
        data-tab="tree"
        className={`flex flex-col items-center gap-1 transition-colors relative ${
          isTree ? "text-[#FFC857]" : "text-[#9AAAA0] hover:text-[#EAF1EC]"
        } ${isLanded ? "landed" : ""}`}
      >
        {/* Expanding Green Ripple */}
        <span className="sprout-ring" />

        {/* Sprout SVG Icon with Unfurling Leaves */}
        <svg
          id="treeIcon"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="w-6 h-6"
        >
          {/* Stem */}
          <path
            d="M12 22v-9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Left Leaf */}
          <path
            className="tab-leaf l1"
            d="M12 15c-5 0-7-3-7-7 5 0 7 2 7 7z"
            fill="#9BE564"
          />
          {/* Right Leaf */}
          <path
            className="tab-leaf l2"
            d="M12 13c0-5 2-7 7-7 0 5-2 7-7 7z"
            fill="#9BE564"
          />
        </svg>

        <span className="text-[12px] font-medium tracking-tight">Tree</span>
      </Link>
    </nav>
  );
}
