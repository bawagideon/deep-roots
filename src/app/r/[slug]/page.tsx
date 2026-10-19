"use client";

import React, { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Compass,
  ArrowRight,
  ScanLine,
  CheckCircle2,
  XCircle,
  Sparkles,
  Share2,
} from "lucide-react";
import { SEEDED_ROOTS, LENSES } from "@/lib/constants";
import { StoredRoot } from "@/types/roots";
import { UnearthReveal } from "@/components/motion/UnearthReveal";
import { FoilTiltCard } from "@/components/motion/FoilTiltCard";
import { Haptics } from "@/lib/motion/haptics";

export default function PublicRootSharePage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params.slug as string) || "root-noodles";

  // Find root by ID or title slug
  const root: StoredRoot = useMemo(() => {
    const found = SEEDED_ROOTS.find(
      (r) =>
        r.id === slug ||
        r.title.toLowerCase().replace(/\s+/g, "-") === slug.toLowerCase()
    );
    return found || SEEDED_ROOTS[0];
  }, [slug]);

  // Quiz Options for "Guess the Root"
  const quizOptions = useMemo(() => {
    const correctHeadline = root.card.root.headline;
    const distractors: Record<string, string[]> = {
      "root-noodles": [
        "Invented by space engineers for zero-gravity preservation.",
        "Originally a luxury Imperial banquet dish in 18th-century Kyoto.",
      ],
      "root-quarantine": [
        "Derived from the Latin word for four-sided military fortresses.",
        "Created by Parisian doctors during the 17th-century cholera outbreak.",
      ],
      default: [
        "Designed by patent lawyers to bypass royal taxation duties.",
        "Accidentally discovered during wartime synthetic rubber research.",
      ],
    };

    const extras = distractors[root.id] || distractors.default;
    const options = [
      { text: correctHeadline, isCorrect: true },
      { text: extras[0], isCorrect: false },
      { text: extras[1], isCorrect: false },
    ];
    // Deterministic shuffle based on slug length
    return options.sort((a, b) => (a.text.length % 2 === 0 ? 1 : -1));
  }, [root]);

  const [selectedGuess, setSelectedGuess] = useState<number | null>(null);
  const [hasGuessed, setHasGuessed] = useState(false);
  const [showReveal, setShowReveal] = useState(false);

  const handleSelectGuess = (index: number) => {
    if (hasGuessed) return;
    setSelectedGuess(index);
    setHasGuessed(true);
    Haptics.tick();

    // Small delay before unearth reveal
    setTimeout(() => {
      setShowReveal(true);
    }, 400);
  };

  const isUserCorrect = selectedGuess !== null && quizOptions[selectedGuess]?.isCorrect;

  return (
    <div className="flex flex-col min-h-screen px-6 pt-6 pb-28 bg-[#0E1411] text-[#EAF1EC]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/welcome" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#FFC857] flex items-center justify-center text-[#0E1411]">
            <Compass className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="font-extrabold text-[18px] tracking-tight text-[#EAF1EC]">
            Deep Roots
          </span>
        </Link>

        <Link
          href="/try"
          className="px-3.5 py-1.5 rounded-full bg-[#151D18] border border-[#2A372F] hover:border-[#FFC857]/40 text-[#FFC857] text-[12px] font-bold transition-all"
        >
          Try Free Scan
        </Link>
      </div>

      {/* Snapshot Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#231A00] border border-[#FFC857]/40 text-[#FFC857] text-[11px] font-bold tracking-wider uppercase mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          Discovery Snapshot
        </div>
        <h1 className="text-[32px] font-black leading-tight tracking-tight">
          {root.title}
        </h1>
        <p className="text-[15px] text-[#9AAAA0] leading-snug mt-1">
          {root.card.oneLiner}
        </p>
      </div>

      {/* Interactive "Guess the Root" Mode */}
      <div className="mb-8 p-5 rounded-[22px] bg-[#151D18] border border-[#2A372F]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] font-extrabold text-[#FFC857] uppercase tracking-wider">
            Guess the Root
          </span>
          <span className="text-[12px] text-[#9AAAA0]">Can you unearth the truth?</span>
        </div>

        <p className="text-[14px] text-[#EAF1EC] font-semibold mb-4">
          What is the true hidden story behind <span className="text-[#FFC857]">{root.title}</span>?
        </p>

        {/* 3 Quiz Options */}
        <div className="space-y-3">
          {quizOptions.map((opt, idx) => {
            const isSelected = selectedGuess === idx;
            return (
              <button
                key={idx}
                onClick={() => handleSelectGuess(idx)}
                disabled={hasGuessed}
                className={`w-full text-left p-4 rounded-[16px] border text-[14px] font-medium transition-all ${
                  isSelected
                    ? opt.isCorrect
                      ? "bg-[#1B291B] border-[#9BE564] text-[#EAF1EC]"
                      : "bg-[#291B1B] border-[#FF86B8] text-[#EAF1EC]"
                    : hasGuessed && opt.isCorrect
                    ? "bg-[#1B291B] border-[#9BE564]/60 text-[#EAF1EC]"
                    : "bg-[#0E1411] border-[#2A372F] text-[#9AAAA0] hover:text-[#EAF1EC] hover:border-[#FFC857]/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="leading-snug">{opt.text}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Guess Result Banner */}
        {hasGuessed && (
          <div
            className={`mt-4 p-3.5 rounded-[14px] flex items-center gap-2.5 animate-fade-in ${
              isUserCorrect
                ? "bg-[#1B291B] text-[#9BE564] border border-[#9BE564]/40"
                : "bg-[#231A00] text-[#FFC857] border border-[#FFC857]/40"
            }`}
          >
            {isUserCorrect ? (
              <>
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span className="text-[13px] font-bold">
                  You got it! Unearthing the full evidence below...
                </span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-[13px] font-bold">
                  Not quite — unearthing the real root below:
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Unearth Reveal Section */}
      {showReveal && (
        <div className="mb-8 animate-fade-in">
          <UnearthReveal
            headline={root.card.root.headline}
            body={root.card.root.body}
            tag="The Verified Root"
            autoPlay={true}
          />
        </div>
      )}

      {/* 3D Foil Tilt Card Showcase */}
      <div className="my-4 flex flex-col items-center">
        <span className="text-[12px] font-bold text-[#9AAAA0] uppercase tracking-wider mb-2">
          Collectable Discovery Card
        </span>
        <FoilTiltCard
          title={root.title}
          rootHeadline={root.card.root.headline}
          lenses={root.card.lenses}
          showSweepButton={true}
        />
      </div>

      {/* Fixed Sticky CTA: Scan Yours */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] p-4 bg-[#0E1411]/95 backdrop-blur-md border-t border-[#2A372F] z-40">
        <Link
          href="/try"
          className="w-full h-14 bg-[#FFC857] hover:bg-[#E5B040] text-[#0E1411] font-bold text-[16px] rounded-btn flex items-center justify-center gap-2.5 shadow-[0_8px_24px_rgba(255,200,87,0.35)] transition-all"
        >
          <ScanLine className="w-5 h-5 stroke-[2.4] animate-pulse" />
          <span>Scan yours & unearth hidden roots</span>
        </Link>
      </div>
    </div>
  );
}
