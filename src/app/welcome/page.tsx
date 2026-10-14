"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitFork, ArrowRight, ArrowLeft, Check, Sparkles } from "lucide-react";
import { Lens, ReadingDepth, ReadingTone } from "@/types/roots";
import { LENSES } from "@/lib/constants";
import { getUserStats, saveUserStats, getUserPreferences, saveUserPreferences } from "@/lib/storage/store";

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedLenses, setSelectedLenses] = useState<Lens[]>([
    "language",
    "culture",
    "tech",
  ]);
  const [readingDepth, setReadingDepth] = useState<ReadingDepth>("standard");
  const [tone, setTone] = useState<ReadingTone>("playful");
  const [language, setLanguage] = useState("English");

  const toggleLens = (lens: Lens) => {
    if (selectedLenses.includes(lens)) {
      if (selectedLenses.length > 1) {
        setSelectedLenses(selectedLenses.filter((l) => l !== lens));
      }
    } else {
      if (selectedLenses.length < 3) {
        setSelectedLenses([...selectedLenses, lens]);
      } else {
        setSelectedLenses([...selectedLenses.slice(1), lens]);
      }
    }
  };

  const handleNextStep = () => {
    setStep(2);
  };

  const handleFinish = () => {
    const stats = getUserStats();
    stats.selectedLenses = selectedLenses;
    saveUserStats(stats);

    const prefs = getUserPreferences();
    prefs.lenses = selectedLenses;
    prefs.depth = readingDepth;
    prefs.tone = tone;
    prefs.language = language;
    saveUserPreferences(prefs);

    if (typeof window !== "undefined") {
      localStorage.setItem("deeproots_welcomed", "true");
    }
    router.push("/");
  };

  return (
    <div className="flex flex-col min-h-screen px-6 pt-10 pb-12 justify-between bg-[#0E1411]">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#FFC857]/15 border border-[#FFC857]/40 flex items-center justify-center text-[#FFC857]">
              <GitFork className="w-4 h-4 rotate-180" />
            </div>
            <span className="font-semibold text-[17px] tracking-tight text-[#EAF1EC]">
              Deep Roots
            </span>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                step === 1 ? "w-6 bg-[#FFC857]" : "bg-[#2A372F]"
              }`}
            />
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                step === 2 ? "w-6 bg-[#FFC857]" : "bg-[#2A372F]"
              }`}
            />
          </div>
        </div>

        {step === 1 && (
          <div>
            {/* Hero title */}
            <h1 className="text-[42px] font-extrabold tracking-tight leading-[1.08] text-[#EAF1EC] mb-3">
              Everything has roots.
            </h1>
            <p className="text-[15px] text-[#9AAAA0] leading-snug mb-7">
              Snap, paste or type anything. See what it is made of, where it came
              from, and what it connects to.
            </p>

            {/* Example Preview Card */}
            <div className="bg-[#151D18] border border-[#2A372F] rounded-card p-5 mb-7 shadow-sm">
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
        )}

        {step === 2 && (
          <div>
            <h1 className="text-[36px] font-extrabold tracking-tight leading-[1.12] text-[#EAF1EC] mb-3">
              Set your reading style.
            </h1>
            <p className="text-[15px] text-[#9AAAA0] leading-snug mb-7">
              Tailor how deep the AI deconstructs each card. You can change this
              any time in Settings.
            </p>

            {/* Reading Depth */}
            <div className="mb-6">
              <label className="text-[12px] font-bold text-[#FFC857] uppercase tracking-wider block mb-2.5">
                Reading Depth
              </label>
              <div className="grid grid-cols-3 p-1 bg-[#151D18] border border-[#2A372F] rounded-[16px]">
                {(["simple", "standard", "deep"] as ReadingDepth[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setReadingDepth(d)}
                    className={`h-11 rounded-[12px] text-[14px] font-bold capitalize transition-all ${
                      readingDepth === d
                        ? "bg-[#FFC857] text-[#0E1411] shadow-sm"
                        : "text-[#9AAAA0] hover:text-[#EAF1EC]"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="text-[12px] text-[#9AAAA0] mt-2 px-1">
                {readingDepth === "simple" && "Quick, bite-sized summaries with clear everyday language."}
                {readingDepth === "standard" && "Balanced depth with key scientific and historical context."}
                {readingDepth === "deep" && "Detailed breakdown of underlying systems and deep mechanisms."}
              </p>
            </div>

            {/* Tone */}
            <div className="mb-6">
              <label className="text-[12px] font-bold text-[#FFC857] uppercase tracking-wider block mb-2.5">
                Explanation Tone
              </label>
              <div className="grid grid-cols-2 p-1 bg-[#151D18] border border-[#2A372F] rounded-[16px]">
                {(["playful", "neutral"] as ReadingTone[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`h-11 rounded-[12px] text-[14px] font-bold capitalize transition-all ${
                      tone === t
                        ? "bg-[#FFC857] text-[#0E1411] shadow-sm"
                        : "text-[#9AAAA0] hover:text-[#EAF1EC]"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div className="bg-[#151D18] border border-[#2A372F] rounded-[16px] p-4 flex items-center justify-between">
              <div>
                <span className="text-[14px] font-bold text-[#EAF1EC] block">
                  Language
                </span>
                <span className="text-[12px] text-[#9AAAA0]">
                  Cards will be generated in this language
                </span>
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-[#1D2822] border border-[#2A372F] text-[#EAF1EC] text-[14px] font-semibold rounded-lg px-3 py-1.5 outline-none cursor-pointer"
              >
                <option value="English">English</option>
                <option value="Spanish">Español</option>
                <option value="French">Français</option>
                <option value="German">Deutsch</option>
                <option value="Japanese">日本語</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="pt-8 flex flex-col items-center gap-3">
        {step === 1 ? (
          <>
            <button
              onClick={handleNextStep}
              className="w-full h-14 bg-[#FFC857] hover:bg-[#E5B040] active:scale-[0.98] text-[#0E1411] font-bold text-[16px] rounded-btn flex items-center justify-center transition-all shadow-[0_4px_16px_rgba(255,200,87,0.25)]"
            >
              Continue
            </button>
            <button
              onClick={handleFinish}
              className="text-[14px] text-[#9AAAA0] hover:text-[#EAF1EC] font-medium transition-colors"
            >
              Skip for now
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleFinish}
              className="w-full h-14 bg-[#FFC857] hover:bg-[#E5B040] active:scale-[0.98] text-[#0E1411] font-bold text-[16px] rounded-btn flex items-center justify-center transition-all shadow-[0_4px_16px_rgba(255,200,87,0.25)]"
            >
              Start digging
            </button>
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 text-[14px] text-[#9AAAA0] hover:text-[#EAF1EC] font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
