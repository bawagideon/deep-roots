"use client";

import { useState } from "react";
import Link from "next/link";
import { X, Check } from "lucide-react";
import { upgradePlan } from "@/lib/storage/store";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureNotice?: string;
}

export function PaywallModal({ isOpen, onClose, featureNotice }: PaywallModalProps) {
  const [billingCycle, setBillingCycle] = useState<"yearly" | "monthly">("yearly");
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubscribe = () => {
    upgradePlan("pro");
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-[420px] bg-[#0E1411] border border-[#2A372F] rounded-[28px] p-6 text-left my-auto shadow-2xl flex flex-col justify-between min-h-[640px]">
        {/* Close Button */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-[#151D18] border border-[#2A372F] flex items-center justify-center text-[#EAF1EC] hover:bg-[#1D2822] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {featureNotice && (
              <span className="text-[12px] font-semibold text-[#FFC857] px-3 py-1 rounded-full bg-[#231A00] border border-[#FFC857]/40">
                {featureNotice}
              </span>
            )}
          </div>

          {/* Heading */}
          <span className="text-[12px] font-bold tracking-wider text-[#FFC857] uppercase block mb-1.5">
            DEEP ROOTS PRO
          </span>
          <h2 className="text-[36px] font-extrabold tracking-tight leading-[1.08] text-[#EAF1EC] mb-2.5">
            Deeper without limits.
          </h2>
          <p className="text-[14px] text-[#9AAAA0] leading-snug mb-6">
            Your Tree and your streak stay free. Pro adds volume and depth.
          </p>

          {/* Feature Checklist */}
          <div className="flex flex-col gap-3 mb-6">
            {[
              "Many more scans and rabbit holes every day",
              "Sources checked for every claim",
              "Unexpected Connections in full",
              "Daily Root picked from your Tree",
              "Export your Tree and clean share cards",
            ].map((feature, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <Check className="w-4 h-4 text-[#FFC857] stroke-[3] mt-0.5 flex-shrink-0" />
                <span className="text-[14px] font-medium text-[#EAF1EC] leading-snug">
                  {feature}
                </span>
              </div>
            ))}
          </div>

          {/* Plan Selector */}
          <div className="flex flex-col gap-3 mb-6">
            {/* Yearly */}
            <div
              onClick={() => setBillingCycle("yearly")}
              className={`p-4 rounded-[18px] border cursor-pointer transition-all flex items-center justify-between ${
                billingCycle === "yearly"
                  ? "bg-[#181F1A] border-[#FFC857] shadow-sm"
                  : "bg-[#151D18] border-[#2A372F] hover:border-[#3A4C40]"
              }`}
            >
              <div>
                <span className="text-[16px] font-bold text-[#EAF1EC] block leading-tight">
                  Yearly
                </span>
                <span className="text-[13px] text-[#9AAAA0] mt-0.5 block">
                  $39.99 per year · 7-day free trial
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#FFC857] text-[#0E1411] text-[11px] font-extrabold tracking-wide uppercase">
                Best value
              </span>
            </div>

            {/* Monthly */}
            <div
              onClick={() => setBillingCycle("monthly")}
              className={`p-4 rounded-[18px] border cursor-pointer transition-all ${
                billingCycle === "monthly"
                  ? "bg-[#181F1A] border-[#FFC857] shadow-sm"
                  : "bg-[#151D18] border-[#2A372F] hover:border-[#3A4C40]"
              }`}
            >
              <span className="text-[16px] font-bold text-[#EAF1EC] block leading-tight">
                Monthly
              </span>
              <span className="text-[13px] text-[#9AAAA0] mt-0.5 block">
                $4.99 per month
              </span>
            </div>
          </div>
        </div>

        {/* CTA & Fine Print */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <button
            onClick={handleSubscribe}
            disabled={isSuccess}
            className="w-full h-14 bg-[#FFC857] hover:bg-[#E5B040] active:scale-[0.98] text-[#0E1411] font-bold text-[16px] rounded-btn flex items-center justify-center transition-all shadow-[0_4px_16px_rgba(255,200,87,0.25)]"
          >
            {isSuccess ? (
              <span className="flex items-center gap-2">
                <Check className="w-5 h-5 stroke-[3]" />
                Activated Pro!
              </span>
            ) : billingCycle === "yearly" ? (
              "Start free trial"
            ) : (
              "Subscribe now"
            )}
          </button>

          <p className="text-[11px] text-[#9AAAA0] text-center px-4 leading-tight">
            Renews automatically at the price shown. Cancel anytime in Settings.
          </p>

          <div className="flex items-center gap-4 text-[12px] text-[#9AAAA0] pt-1">
            <button
              onClick={() => alert("Purchases restored successfully.")}
              className="hover:text-[#EAF1EC] transition-colors"
            >
              Restore purchase
            </button>
            <span>·</span>
            <Link href="/terms" className="hover:text-[#EAF1EC] transition-colors">
              Terms
            </Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-[#EAF1EC] transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
