"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";

interface DailyLimitSheetProps {
  isOpen: boolean;
  onClose: () => void;
  limitCount?: number;
  onSeePro: () => void;
}

export function DailyLimitSheet({
  isOpen,
  onClose,
  limitCount = 5,
  onSeePro,
}: DailyLimitSheetProps) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState({ hours: 6, minutes: 20 });
  const [reminded, setReminded] = useState(false);

  useEffect(() => {
    // Calculate time until midnight
    const updateCountdown = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diffMs = midnight.getTime() - now.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft({ hours, minutes });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen) return null;

  const handleRemindTomorrow = () => {
    setReminded(true);
    setTimeout(() => {
      setReminded(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-[440px] bg-[#0E1411] border-t border-[#2A372F] rounded-t-[32px] px-6 pt-3 pb-8 flex flex-col shadow-2xl animate-slide-up">
        {/* Grab Handle */}
        <div className="w-10 h-1.5 bg-[#2A372F] rounded-full mx-auto mb-6" />

        {/* Header with Clock Icon */}
        <div className="flex items-start gap-4 mb-5">
          <div className="w-14 h-14 rounded-[18px] bg-[#231A00] border border-[#FFC857]/40 flex items-center justify-center flex-shrink-0 text-[#FFC857]">
            <Clock className="w-7 h-7 stroke-[2.2]" />
          </div>

          <div>
            <h2 className="text-[22px] font-extrabold tracking-tight leading-tight text-[#EAF1EC]">
              That was today&apos;s {limitCount} scans
            </h2>
            <p className="text-[14px] text-[#9AAAA0] font-medium mt-0.5">
              Resets in {timeLeft.hours} h {timeLeft.minutes} min
            </p>
          </div>
        </div>

        {/* Reassurance Callout Card */}
        <div className="bg-[#151D18] border border-[#2A372F] rounded-[18px] p-4 mb-6">
          <p className="text-[13px] text-[#9AAAA0] leading-relaxed">
            Your Tree and streak are safe. Reading the Daily Root and opening a
            rabbit hole on a saved card still keeps your streak going.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onSeePro}
            className="w-full h-14 bg-[#FFC857] hover:bg-[#E5B040] active:scale-[0.98] text-[#0E1411] font-bold text-[16px] rounded-btn flex items-center justify-center transition-all shadow-[0_4px_16px_rgba(255,200,87,0.25)]"
          >
            See Pro
          </button>

          <button
            onClick={handleRemindTomorrow}
            className="w-full h-14 bg-[#151D18] hover:bg-[#1D2822] active:scale-[0.98] border border-[#2A372F] text-[#EAF1EC] font-bold text-[15px] rounded-btn flex items-center justify-center transition-all"
          >
            {reminded ? "Reminder scheduled ✓" : "Remind me tomorrow"}
          </button>

          <button
            onClick={() => {
              onClose();
              router.push("/tree");
            }}
            className="pt-2 text-[14px] font-semibold text-[#9AAAA0] hover:text-[#EAF1EC] text-center transition-colors"
          >
            Browse my Tree
          </button>
        </div>
      </div>
    </div>
  );
}
