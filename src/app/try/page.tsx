"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Camera,
  ArrowRight,
  ShieldCheck,
  Check,
  Compass,
  AlertCircle,
} from "lucide-react";
import { RootsCard } from "@/types/roots";
import { UnearthReveal } from "@/components/motion/UnearthReveal";
import { FoilTiltCard } from "@/components/motion/FoilTiltCard";
import { LENSES } from "@/lib/constants";

const SUGGESTIONS = [
  "Instant noodles",
  "Blue jeans",
  "Barcodes",
  "Elevator music",
  "The zipper",
];

export default function GuestTryPage() {
  const router = useRouter();
  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [progressMsg, setProgressMsg] = useState("Splitting it into parts...");
  const [card, setCard] = useState<RootsCard | null>(null);
  const [visual, setVisual] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        setErrorMsg("Image exceeds maximum size of 4MB");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setErrorMsg(null);
    }
  };

  const runGuestScan = async (queryText?: string) => {
    const textToScan = queryText || inputText;
    if (!textToScan.trim() && !selectedFile) {
      setErrorMsg("Please enter an object name or upload a photo to explore.");
      return;
    }

    setIsScanning(true);
    setErrorMsg(null);

    // Rotating progress text
    const msgs = [
      "Splitting it into parts...",
      "Tracing where it came from...",
      "Checking historical systems...",
      "Unearthing the hidden layer...",
    ];
    let msgIdx = 0;
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % msgs.length;
      setProgressMsg(msgs[msgIdx]);
    }, 1400);

    try {
      let res: Response;

      if (selectedFile) {
        const formData = new FormData();
        formData.append("image", selectedFile);
        formData.append("inputKind", "photo");
        if (textToScan) formData.append("inputText", textToScan);
        res = await fetch("/api/guest-scan", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/guest-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inputKind: "text",
            inputText: textToScan,
          }),
        });
      }

      clearInterval(interval);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setErrorMsg(
            errData.error?.message ||
              "You've used your free guest scan! Sign up free to save your Tree and continue exploring."
          );
        } else {
          setErrorMsg(errData.error?.message || "Failed to scan object. Please try again.");
        }
        setIsScanning(false);
        return;
      }

      const data = await res.json();
      setCard(data.card);
      setVisual(data.visual);

      // Store in client storage ready for claim upon sign up
      if (typeof window !== "undefined") {
        const pendingClaim = {
          id: `guest_${Date.now()}`,
          title: data.card.title,
          card: data.card,
          visual: data.visual,
          inputKind: data.inputKind,
          inputText: data.inputText,
          createdAt: new Date().toISOString(),
        };
        localStorage.setItem("deeproots_guest_pending_claim", JSON.stringify(pendingClaim));
      }
    } catch (err: any) {
      clearInterval(interval);
      setErrorMsg(err.message || "Network error. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveToTree = () => {
    // Navigate to sign-up to claim root
    router.push("/sign-up?redirect_url=/");
  };

  return (
    <div className="flex flex-col min-h-screen px-6 pt-8 pb-16 bg-[#0E1411] text-[#EAF1EC]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-8">
        <Link href="/welcome" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#FFC857] flex items-center justify-center text-[#0E1411]">
            <Compass className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="font-extrabold text-[18px] tracking-tight text-[#EAF1EC]">
            Deep Roots
          </span>
        </Link>

        <Link
          href="/sign-in"
          className="text-[13px] font-bold text-[#FFC857] hover:underline"
        >
          Sign In
        </Link>
      </div>

      {!card ? (
        /* Capture Form View */
        <div className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#231A00] border border-[#FFC857]/40 text-[#FFC857] text-[11px] font-bold tracking-wider uppercase mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Free Guest Scan
            </div>

            <h1 className="text-[32px] font-extrabold leading-[1.08] tracking-tight mb-3">
              Everything has roots.
            </h1>
            <p className="text-[15px] text-[#9AAAA0] leading-relaxed mb-6">
              Pick any everyday object. We’ll break it down into parts and uncover the hidden system beneath it.
            </p>

            {/* Input Field */}
            <div className="space-y-3 mb-6">
              <div className="relative">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isScanning) runGuestScan();
                  }}
                  placeholder="e.g. Instant noodles, Blue jeans, Barcodes..."
                  disabled={isScanning}
                  className="w-full h-14 bg-[#151D18] border border-[#2A372F] focus:border-[#FFC857] rounded-btn px-4 text-[16px] text-[#EAF1EC] placeholder-[#55635B] outline-none transition-colors"
                />
              </div>

              {/* Suggestions */}
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    onClick={() => {
                      setInputText(sug);
                      runGuestScan(sug);
                    }}
                    disabled={isScanning}
                    className="px-3 py-1.5 rounded-full bg-[#151D18] hover:bg-[#1D2822] border border-[#2A372F] text-[12px] font-semibold text-[#9AAAA0] hover:text-[#EAF1EC] transition-colors"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Photo Upload Alternative */}
            <div className="p-4 rounded-[18px] bg-[#151D18] border border-[#2A372F] mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1D2822] flex items-center justify-center text-[#FFC857]">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-[#EAF1EC]">
                    {selectedFile ? selectedFile.name : "Or take / upload a photo"}
                  </div>
                  <div className="text-[12px] text-[#9AAAA0]">
                    Point at anything ordinary
                  </div>
                </div>
              </div>

              <label className="px-3.5 py-1.5 bg-[#1D2822] hover:bg-[#2A372F] text-[#FFC857] text-[12px] font-bold rounded-full border border-[#7A4E00]/40 cursor-pointer transition-colors">
                {selectedFile ? "Change" : "Browse"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-4 rounded-card bg-[#231A00] border border-[#FFC857]/50 text-[#FFC857] text-[13px] flex items-start gap-2.5 mb-6">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div>{errorMsg}</div>
                  <Link
                    href="/sign-up"
                    className="inline-block mt-2 font-bold underline"
                  >
                    Sign up free for more scans →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div>
            <button
              onClick={() => runGuestScan()}
              disabled={isScanning || (!inputText.trim() && !selectedFile)}
              className="w-full h-14 bg-[#FFC857] hover:bg-[#E5B040] disabled:opacity-40 text-[#0E1411] font-bold text-[16px] rounded-btn flex items-center justify-center gap-2 transition-all shadow-[0_8px_24px_rgba(255,200,87,0.25)]"
            >
              {isScanning ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-[#0E1411] border-t-transparent animate-spin" />
                  <span>{progressMsg}</span>
                </div>
              ) : (
                <>
                  <span>Unearth Deep Roots</span>
                  <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                </>
              )}
            </button>
            <p className="text-center text-[12px] text-[#55635B] mt-3">
              No account required for your first scan.
            </p>
          </div>
        </div>
      ) : (
        /* Discovery Card Revealed View */
        <div className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full animate-fade-in">
          <div>
            {/* Header info */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-[12px] font-bold text-[#FFC857] uppercase tracking-wider">
                Discovery Result
              </span>
              <button
                onClick={() => {
                  setCard(null);
                  setInputText("");
                  setSelectedFile(null);
                }}
                className="text-[12px] text-[#9AAAA0] hover:text-[#EAF1EC] underline"
              >
                Scan something else
              </button>
            </div>

            <h1 className="text-[28px] font-extrabold tracking-tight leading-tight mb-2">
              {card.title}
            </h1>
            <p className="text-[14px] text-[#9AAAA0] leading-snug mb-6">
              {card.oneLiner}
            </p>

            {/* Signature Unearth Reveal */}
            <UnearthReveal
              headline={card.root.headline}
              body={card.root.body}
              tag={card.root.lens ? `THE ROOT · ${LENSES[card.root.lens]?.label || ""}` : "THE ROOT"}
              className="mb-6"
            />

            {/* 3 Components Breakdown */}
            <div className="mb-6">
              <h3 className="text-[16px] font-bold text-[#EAF1EC] tracking-tight mb-3">
                Key Components
              </h3>
              <div className="space-y-2.5">
                {card.components.slice(0, 3).map((comp, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-[16px] bg-[#151D18] border border-[#2A372F]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[14px] font-bold text-[#EAF1EC]">
                        {comp.name}
                      </span>
                      {comp.lens && (
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${LENSES[comp.lens]?.color || "#FFC857"}20`,
                            color: LENSES[comp.lens]?.color || "#FFC857",
                          }}
                        >
                          {LENSES[comp.lens]?.label}
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-[#9AAAA0] leading-relaxed">
                      {comp.hiddenFact}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Foil Tilt Card Preview */}
            <div className="my-6 flex justify-center">
              <FoilTiltCard
                title={card.title}
                rootHeadline={card.root.headline}
                lenses={card.lenses}
                showSweepButton={true}
              />
            </div>
          </div>

          {/* Sticky Claim CTA */}
          <div className="sticky bottom-0 pt-4 pb-2 bg-[#0E1411]/95 backdrop-blur-md border-t border-[#2A372F]">
            <button
              onClick={handleSaveToTree}
              className="w-full h-14 bg-[#FFC857] hover:bg-[#E5B040] text-[#0E1411] font-bold text-[16px] rounded-btn flex items-center justify-center gap-2 transition-all shadow-[0_8px_24px_rgba(255,200,87,0.3)]"
            >
              <span>Save to my Tree</span>
              <ArrowRight className="w-5 h-5 stroke-[2.5]" />
            </button>
            <p className="text-center text-[12px] text-[#9AAAA0] mt-2">
              Free account · Keep your discoveries forever · 5 scans/day
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
