"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Image as ImageIcon, Link as LinkIcon, Sparkles, AlertCircle } from "lucide-react";
import { getUserStats } from "@/lib/storage/store";

export default function ScanPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"photo" | "type" | "link">("photo");
  const [textInput, setTextInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stats = getUserStats();
  const scansRemaining = Math.max(0, stats.scansLimit - stats.scansToday);

  // Quick hint chips
  const hintChips = ["A snack", "A coin", "A word on a sign", "A tool", "A proverb"];

  const handleSelectHint = (hint: string) => {
    setTextInput(hint);
    setTab("type");
  };

  // Image resizing to 1280px & EXIF stripping via HTML Canvas
  const processImageFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1280;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.82);
          resolve(compressedDataUrl);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      const base64 = await processImageFile(file);

      // Save payload in session storage for the analyzing screen
      const scanId = `scan-${Date.now()}`;
      sessionStorage.setItem(
        `deeproots_pending_${scanId}`,
        JSON.stringify({
          inputKind: "photo",
          imageBase64: base64,
          mimeType: "image/jpeg",
        })
      );

      router.push(`/scan/${scanId}`);
    } catch (err: any) {
      setError("Failed to process image. Please try again.");
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    const scanId = `scan-${Date.now()}`;
    sessionStorage.setItem(
      `deeproots_pending_${scanId}`,
      JSON.stringify({
        inputKind: textInput.includes("?") ? "question" : "text",
        inputText: textInput.trim(),
      })
    );

    router.push(`/scan/${scanId}`);
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    const scanId = `scan-${Date.now()}`;
    sessionStorage.setItem(
      `deeproots_pending_${scanId}`,
      JSON.stringify({
        inputKind: "link",
        inputText: urlInput.trim(),
      })
    );

    router.push(`/scan/${scanId}`);
  };

  return (
    <div className="flex flex-col min-h-screen px-6 pt-6 pb-8 justify-between bg-[#0E1411]">
      {/* Top Bar */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-[#151D18] border border-[#2A372F] flex items-center justify-center text-[#EAF1EC] hover:bg-[#1D2822] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <h1 className="text-[18px] font-bold text-[#EAF1EC] tracking-tight">
            Scan
          </h1>

          <div className="px-3 py-1 rounded-full bg-[#151D18] border border-[#2A372F] text-[12px] font-semibold text-[#9AAAA0]">
            {scansRemaining} of {stats.scansLimit} left
          </div>
        </div>

        {/* Segmented Mode Control */}
        <div className="grid grid-cols-3 p-1 bg-[#151D18] border border-[#2A372F] rounded-[16px] mb-6">
          <button
            type="button"
            onClick={() => setTab("photo")}
            className={`h-10 rounded-[12px] text-[14px] font-bold transition-all ${
              tab === "photo"
                ? "bg-[#FFC857] text-[#0E1411] shadow-sm"
                : "text-[#9AAAA0] hover:text-[#EAF1EC]"
            }`}
          >
            Photo
          </button>
          <button
            type="button"
            onClick={() => setTab("type")}
            className={`h-10 rounded-[12px] text-[14px] font-bold transition-all ${
              tab === "type"
                ? "bg-[#FFC857] text-[#0E1411] shadow-sm"
                : "text-[#9AAAA0] hover:text-[#EAF1EC]"
            }`}
          >
            Type
          </button>
          <button
            type="button"
            onClick={() => setTab("link")}
            className={`h-10 rounded-[12px] text-[14px] font-bold transition-all ${
              tab === "link"
                ? "bg-[#FFC857] text-[#0E1411] shadow-sm"
                : "text-[#9AAAA0] hover:text-[#EAF1EC]"
            }`}
          >
            Link
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-[13px] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* PHOTO VIEW */}
        {tab === "photo" && (
          <div className="flex flex-col items-center">
            {/* Viewfinder frame */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative w-full aspect-[4/5] rounded-[24px] bg-[#151D18] border-2 border-dashed border-[#2A372F] flex flex-col items-center justify-center cursor-pointer overflow-hidden group hover:border-[#FFC857]/60 transition-all"
            >
              {/* Corner yellow brackets */}
              <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#FFC857]" />
              <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#FFC857]" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#FFC857]" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#FFC857]" />

              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#1D2822] border border-[#2A372F] flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                  📷
                </div>
                <div className="px-4 py-1.5 rounded-full bg-[#1D2822] border border-[#2A372F] text-[13px] font-medium text-[#EAF1EC]">
                  Point at anything
                </div>
                <p className="text-[12px] text-[#9AAAA0] max-w-[200px]">
                  Tap to capture or choose an image from library
                </p>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Quick Hint Chips */}
            <div className="w-full flex flex-wrap gap-2 mt-5">
              {hintChips.map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => handleSelectHint(hint)}
                  className="px-3.5 py-1.5 rounded-full bg-[#151D18] border border-[#2A372F] text-[13px] text-[#9AAAA0] hover:text-[#EAF1EC] hover:border-[#FFC857]/40 transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TYPE VIEW */}
        {tab === "type" && (
          <form onSubmit={handleTextSubmit} className="flex flex-col gap-4">
            <div className="bg-[#151D18] border border-[#2A372F] rounded-card p-4">
              <label className="text-[12px] font-bold text-[#FFC857] uppercase tracking-wider block mb-2">
                What do you want to decompose?
              </label>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="e.g. Sourdough bread, 'A rolling stone gathers no moss', Elevator buttons, Inflation..."
                rows={5}
                className="w-full bg-transparent text-[#EAF1EC] text-[16px] placeholder-[#9AAAA0]/50 outline-none resize-none leading-relaxed"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {hintChips.map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => setTextInput(hint)}
                  className="px-3 py-1 rounded-full bg-[#151D18] border border-[#2A372F] text-[12px] text-[#9AAAA0] hover:text-[#EAF1EC] transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={!textInput.trim() || isProcessing}
              className="w-full h-14 bg-[#FFC857] hover:bg-[#E5B040] disabled:opacity-40 text-[#0E1411] font-bold text-[16px] rounded-btn flex items-center justify-center transition-all mt-2"
            >
              Decompose
            </button>
          </form>
        )}

        {/* LINK VIEW */}
        {tab === "link" && (
          <form onSubmit={handleLinkSubmit} className="flex flex-col gap-4">
            <div className="bg-[#151D18] border border-[#2A372F] rounded-card p-4">
              <label className="text-[12px] font-bold text-[#FFC857] uppercase tracking-wider block mb-2">
                Paste an article, concept or Wikipedia link
              </label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://..."
                className="w-full bg-transparent text-[#EAF1EC] text-[15px] placeholder-[#9AAAA0]/50 outline-none leading-relaxed py-1"
              />
            </div>

            <p className="text-[12px] text-[#9AAAA0] px-1">
              Links are safely fetched server-side to extract core concepts without tracking cookies or ads.
            </p>

            <button
              type="submit"
              disabled={!urlInput.trim() || isProcessing}
              className="w-full h-14 bg-[#FFC857] hover:bg-[#E5B040] disabled:opacity-40 text-[#0E1411] font-bold text-[16px] rounded-btn flex items-center justify-center transition-all mt-2"
            >
              Inspect Link
            </button>
          </form>
        )}
      </div>

      {/* Bottom Photo Controls */}
      {tab === "photo" && (
        <div className="w-full pt-6 flex items-center justify-between px-4">
          {/* Gallery button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-13 h-13 p-3.5 rounded-[16px] bg-[#151D18] border border-[#2A372F] text-[#EAF1EC] hover:bg-[#1D2822] transition-colors"
          >
            <ImageIcon className="w-6 h-6 text-[#9AAAA0]" />
          </button>

          {/* Shutter Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center p-1 active:scale-95 transition-transform"
          >
            <div className="w-full h-full rounded-full bg-[#FFC857] shadow-[0_0_20px_rgba(255,200,87,0.4)]" />
          </button>

          {/* Switch to type / link button */}
          <button
            type="button"
            onClick={() => setTab("type")}
            className="w-13 h-13 p-3.5 rounded-[16px] bg-[#151D18] border border-[#2A372F] text-[#EAF1EC] hover:bg-[#1D2822] transition-colors"
          >
            <Sparkles className="w-6 h-6 text-[#9AAAA0]" />
          </button>
        </div>
      )}
    </div>
  );
}
