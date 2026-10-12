"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, GitFork, ScanLine } from "lucide-react";

export function BottomTabBar() {
  const pathname = usePathname();

  // Hide tab bar on scan viewfinder screen or welcome screen
  if (pathname === "/scan" || pathname === "/welcome" || pathname.startsWith("/scan/")) {
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

      {/* Tree tab */}
      <Link
        href="/tree"
        className={`flex flex-col items-center gap-1 transition-colors ${
          isTree ? "text-[#FFC857]" : "text-[#9AAAA0] hover:text-[#EAF1EC]"
        }`}
      >
        <GitFork className="w-6 h-6 stroke-[2.2] rotate-180" />
        <span className="text-[12px] font-medium tracking-tight">Tree</span>
      </Link>
    </nav>
  );
}
