"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { Lens, ReadingDepth, ReadingTone, UserPreferences } from "@/types/roots";
import { LENSES } from "@/lib/constants";
import { getUserPreferences, saveUserPreferences } from "@/lib/storage/store";

export default function PreferencesPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setPrefs(getUserPreferences());
  }, []);

  if (!prefs) return null;

  const updatePreferences = (newPrefs: UserPreferences) => {
    setPrefs(newPrefs);
    saveUserPreferences(newPrefs);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 1500);
  };

  const toggleLens = (lens: Lens) => {
    let updatedLenses: Lens[];
    if (prefs.lenses.includes(lens)) {
      if (prefs.lenses.length <= 1) return; // Keep at least 1
      updatedLenses = prefs.lenses.filter((l) => l !== lens);
    } else {
      updatedLenses = [...prefs.lenses, lens];
    }
    updatePreferences({ ...prefs, lenses: updatedLenses });
  };

  return (
    <div className="flex flex-col min-h-screen px-6 pt-6 pb-20 bg-[#0E1411]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-[#151D18] border border-[#2A372F] flex items-center justify-center text-[#EAF1EC] hover:bg-[#1D2822] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h1 className="text-[18px] font-bold text-[#EAF1EC] tracking-tight">
          Preferences
        </h1>

        <div className="w-10 flex justify-end">
          {saveSuccess && (
            <span className="text-[12px] font-semibold text-[#9BE564] flex items-center gap-1 animate-fade-in">
              <Check className="w-4 h-4" />
            </span>
          )}
        </div>
      </div>

      {/* YOUR LENSES */}
      <div className="mb-7">
        <span className="text-[12px] font-bold text-[#9AAAA0] uppercase tracking-wider block mb-3">
          YOUR LENSES
        </span>
        <div className="grid grid-cols-3 gap-2.5">
          {(Object.keys(LENSES) as Lens[]).map((key) => {
            const lens = LENSES[key];
            const isSelected = prefs.lenses.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleLens(key)}
                className={`h-11 px-3 rounded-full border flex items-center gap-2 justify-center transition-all ${
                  isSelected
                    ? "bg-[#181F1A] border-[#FFC857] text-[#EAF1EC] shadow-sm"
                    : "bg-[#151D18] border-[#2A372F] text-[#9AAAA0] hover:border-[#3A4C40]"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: lens.color }}
                />
                <span className="text-[13px] font-semibold tracking-tight truncate">
                  {lens.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* READING DEPTH */}
      <div className="mb-7">
        <span className="text-[12px] font-bold text-[#9AAAA0] uppercase tracking-wider block mb-3">
          READING DEPTH
        </span>
        <div className="grid grid-cols-3 p-1 bg-[#151D18] border border-[#2A372F] rounded-[16px]">
          {(["simple", "standard", "deep"] as ReadingDepth[]).map((depth) => (
            <button
              key={depth}
              type="button"
              onClick={() => updatePreferences({ ...prefs, depth })}
              className={`h-11 rounded-[12px] text-[14px] font-bold capitalize transition-all ${
                prefs.depth === depth
                  ? "bg-[#FFC857] text-[#0E1411] shadow-sm"
                  : "text-[#9AAAA0] hover:text-[#EAF1EC]"
              }`}
            >
              {depth}
            </button>
          ))}
        </div>
      </div>

      {/* TONE */}
      <div className="mb-7">
        <span className="text-[12px] font-bold text-[#9AAAA0] uppercase tracking-wider block mb-3">
          TONE
        </span>
        <div className="grid grid-cols-2 p-1 bg-[#151D18] border border-[#2A372F] rounded-[16px]">
          {(["playful", "neutral"] as ReadingTone[]).map((tone) => (
            <button
              key={tone}
              type="button"
              onClick={() => updatePreferences({ ...prefs, tone })}
              className={`h-11 rounded-[12px] text-[14px] font-bold capitalize transition-all ${
                prefs.tone === tone
                  ? "bg-[#FFC857] text-[#0E1411] shadow-sm"
                  : "text-[#9AAAA0] hover:text-[#EAF1EC]"
              }`}
            >
              {tone}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-[#2A372F] my-2" />

      {/* Language row */}
      <div className="flex items-center justify-between py-4 border-b border-[#2A372F]/60">
        <span className="text-[15px] font-medium text-[#EAF1EC]">Language</span>
        <select
          value={prefs.language}
          onChange={(e) =>
            updatePreferences({ ...prefs, language: e.target.value })
          }
          className="bg-transparent text-[#9AAAA0] hover:text-[#EAF1EC] font-semibold text-[15px] outline-none cursor-pointer text-right"
        >
          <option value="English" className="bg-[#151D18] text-[#EAF1EC]">
            English
          </option>
          <option value="Spanish" className="bg-[#151D18] text-[#EAF1EC]">
            Español
          </option>
          <option value="French" className="bg-[#151D18] text-[#EAF1EC]">
            Français
          </option>
          <option value="German" className="bg-[#151D18] text-[#EAF1EC]">
            Deutsch
          </option>
          <option value="Japanese" className="bg-[#151D18] text-[#EAF1EC]">
            日本語
          </option>
        </select>
      </div>

      {/* Open to camera row */}
      <div className="flex items-center justify-between py-4 border-b border-[#2A372F]/60">
        <span className="text-[15px] font-medium text-[#EAF1EC]">
          Open the app to the camera
        </span>
        <button
          type="button"
          onClick={() =>
            updatePreferences({
              ...prefs,
              openTo: prefs.openTo === "camera" ? "home" : "camera",
            })
          }
          className={`w-12 h-7 rounded-full p-1 transition-colors ${
            prefs.openTo === "camera" ? "bg-[#FFC857]" : "bg-[#2A372F]"
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-[#0E1411] shadow-sm transition-transform ${
              prefs.openTo === "camera" ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* NOTIFICATIONS SECTION */}
      <div className="pt-5 mb-6">
        <span className="text-[12px] font-bold text-[#9AAAA0] uppercase tracking-wider block mb-3">
          NOTIFICATIONS
        </span>

        {/* Daily Root */}
        <div className="flex items-center justify-between py-3.5 border-b border-[#2A372F]/60">
          <span className="text-[15px] font-medium text-[#EAF1EC]">
            Daily Root
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold text-[#9AAAA0]">
              {prefs.notifications.dailyRoot.time}
            </span>
            <button
              type="button"
              onClick={() =>
                updatePreferences({
                  ...prefs,
                  notifications: {
                    ...prefs.notifications,
                    dailyRoot: {
                      ...prefs.notifications.dailyRoot,
                      enabled: !prefs.notifications.dailyRoot.enabled,
                    },
                  },
                })
              }
              className={`w-12 h-7 rounded-full p-1 transition-colors ${
                prefs.notifications.dailyRoot.enabled
                  ? "bg-[#FFC857]"
                  : "bg-[#2A372F]"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-[#0E1411] shadow-sm transition-transform ${
                  prefs.notifications.dailyRoot.enabled
                    ? "translate-x-5"
                    : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Streak reminder */}
        <div className="flex items-center justify-between py-3.5 border-b border-[#2A372F]/60">
          <span className="text-[15px] font-medium text-[#EAF1EC]">
            Streak reminder
          </span>
          <button
            type="button"
            onClick={() =>
              updatePreferences({
                ...prefs,
                notifications: {
                  ...prefs.notifications,
                  streakReminder: !prefs.notifications.streakReminder,
                },
              })
            }
            className={`w-12 h-7 rounded-full p-1 transition-colors ${
              prefs.notifications.streakReminder
                ? "bg-[#FFC857]"
                : "bg-[#2A372F]"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-[#0E1411] shadow-sm transition-transform ${
                prefs.notifications.streakReminder
                  ? "translate-x-5"
                  : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Weekly recap */}
        <div className="flex items-center justify-between py-3.5 border-b border-[#2A372F]/60">
          <span className="text-[15px] font-medium text-[#EAF1EC]">
            Weekly recap
          </span>
          <button
            type="button"
            onClick={() =>
              updatePreferences({
                ...prefs,
                notifications: {
                  ...prefs.notifications,
                  weeklyRecap: !prefs.notifications.weeklyRecap,
                },
              })
            }
            className={`w-12 h-7 rounded-full p-1 transition-colors ${
              prefs.notifications.weeklyRecap
                ? "bg-[#FFC857]"
                : "bg-[#2A372F]"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-[#0E1411] shadow-sm transition-transform ${
                prefs.notifications.weeklyRecap
                  ? "translate-x-5"
                  : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Quiet hours */}
        <div className="flex items-center justify-between py-3.5 border-b border-[#2A372F]/60">
          <span className="text-[15px] font-medium text-[#EAF1EC]">
            Quiet hours
          </span>
          <span className="text-[13px] font-semibold text-[#9AAAA0]">
            {prefs.notifications.quietHours.from} to{" "}
            {prefs.notifications.quietHours.to}
          </span>
        </div>
      </div>

      {/* Footer text */}
      <p className="text-[12px] text-[#9AAAA0]/80 leading-relaxed pt-2">
        At most one notification a day. Preferences change wording and reading
        level, never the facts or the sources.
      </p>
    </div>
  );
}
