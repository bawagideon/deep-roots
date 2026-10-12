"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { RootsCard, StoredRoot } from "@/types/roots";
import { saveRoot, getStoredRoots } from "@/lib/storage/store";
import { LENSES } from "@/lib/constants";

export default function AnalyzingPage() {
  const params = useParams();
  const router = useRouter();
  const scanId = params.id as string;

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [inputText, setInputText] = useState<string>("");
  const [progress, setProgress] = useState(15);
  const [streamStage, setStreamStage] = useState<
    "identifying" | "decomposing" | "revealing" | "complete"
  >("identifying");
  const [partialCard, setPartialCard] = useState<Partial<RootsCard> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    // Load payload from session storage
    const raw = sessionStorage.getItem(`deeproots_pending_${scanId}`);
    if (!raw) {
      router.push("/scan");
      return;
    }

    const payload = JSON.parse(raw);
    if (payload.imageBase64) {
      setPreviewImage(payload.imageBase64);
    }
    if (payload.inputText) {
      setInputText(payload.inputText);
    }

    // Start progress simulation
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev < 90) return prev + 12;
        return prev;
      });
    }, 450);

    // Call /api/scan
    async function runScan() {
      try {
        setStreamStage("identifying");
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to analyze input");
        }

        const data = await res.json();
        const card: RootsCard = data.card;

        if (isCancelled) return;

        setStreamStage("decomposing");
        setPartialCard({
          title: card.title,
          oneLiner: card.oneLiner,
          components: card.components.slice(0, 2),
        });

        // Stage 2: Reveal the Root
        setTimeout(() => {
          if (isCancelled) return;
          setStreamStage("revealing");
          setPartialCard(card);
          setProgress(100);

          // Save card to storage
          const stored: StoredRoot = {
            id: scanId,
            depth: 0,
            inputKind: card.inputKind,
            inputText: payload.inputText,
            imagePath: payload.imageBase64 ? "user-scan" : undefined,
            title: card.title,
            card: card,
            lenses: card.lenses,
            createdAt: new Date().toISOString(),
          };

          saveRoot(stored);

          // Trigger cross-scan link analysis in the background
          const allRoots = getStoredRoots();
          fetch("/api/link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newRoot: stored, existingRoots: allRoots }),
          }).catch(() => {});

          // Clean up pending session payload
          sessionStorage.removeItem(`deeproots_pending_${scanId}`);

          // Navigate to full card view
          setTimeout(() => {
            router.push(`/root/${scanId}`);
          }, 800);
        }, 1200);
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || "Failed to decompose. Please try again.");
        }
      }
    }

    runScan();

    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, [scanId, router]);

  return (
    <div className="flex flex-col min-h-screen px-6 pt-6 pb-12 justify-between bg-[#0E1411]">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-[#151D18] border border-[#2A372F] flex items-center justify-center text-[#EAF1EC]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-[14px] font-bold text-[#EAF1EC]">
            {previewImage ? "Photo scan" : "Text scan"}
          </span>
          <div className="w-10" />
        </div>

        {/* Media Preview Box */}
        <div className="w-full h-48 rounded-[20px] bg-[#151D18] border border-[#2A372F] flex items-center justify-center overflow-hidden mb-6 relative">
          {previewImage ? (
            <img
              src={previewImage}
              alt="Scan preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="p-6 text-center">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-[14px] text-[#9AAAA0] font-medium max-w-[260px] truncate">
                "{inputText || "Decomposing..."}"
              </p>
            </div>
          )}
        </div>

        {/* Title & subtitle */}
        <div className="mb-4">
          <h2 className="text-[26px] font-extrabold text-[#EAF1EC] tracking-tight leading-tight">
            {partialCard?.title || inputText || "Analyzing..."}
          </h2>
          <p className="text-[14px] text-[#9AAAA0] mt-1">
            Splitting it into parts and finding the Root
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-[#1D2822] rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-[#FFC857] transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {error ? (
          <div className="p-4 rounded-card bg-red-950/40 border border-red-500/40 text-red-200">
            <p className="font-semibold text-[15px] mb-1">Decomposition halted</p>
            <p className="text-[13px] opacity-90 mb-3">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#FFC857] text-[#0E1411] font-bold text-[13px] rounded-lg"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* The Root Skeleton / Reveal */}
            <div className="bg-[#231A00]/80 border-2 border-dashed border-[#FFC857]/60 rounded-card p-4 transition-all">
              <span className="text-[10px] font-bold tracking-wider text-[#FFC857] uppercase block mb-2">
                The Root
              </span>
              {partialCard?.root ? (
                <div>
                  <h4 className="text-[15px] font-bold text-[#EAF1EC] leading-snug">
                    {partialCard.root.headline}
                  </h4>
                  <p className="text-[13px] text-[#9AAAA0] mt-1 line-clamp-2">
                    {partialCard.root.body}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="h-4 bg-[#FFC857]/20 rounded-md w-3/4 animate-pulse" />
                  <div className="h-3.5 bg-[#FFC857]/15 rounded-md w-1/2 animate-pulse" />
                </div>
              )}
            </div>

            {/* Components Streaming In */}
            {partialCard?.components && partialCard.components.length > 0 ? (
              partialCard.components.map((comp, idx) => {
                const lensInfo = comp.lens ? LENSES[comp.lens] : undefined;
                return (
                  <div
                    key={idx}
                    className="p-3.5 bg-[#151D18] border border-[#2A372F] rounded-[16px] flex items-center justify-between animate-fadeIn"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          backgroundColor: lensInfo?.color || "#5FE0E8",
                        }}
                      />
                      <div>
                        <h4 className="text-[14px] font-bold text-[#EAF1EC]">
                          {comp.name}
                        </h4>
                        <p className="text-[12px] text-[#9AAAA0] line-clamp-1">
                          {comp.role}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <>
                <div className="p-4 bg-[#151D18] border border-[#2A372F] rounded-[16px] space-y-2">
                  <div className="h-3.5 bg-[#1D2822] rounded w-2/5 animate-pulse" />
                  <div className="h-3 bg-[#1D2822] rounded w-4/5 animate-pulse" />
                </div>
                <div className="p-4 bg-[#151D18] border border-[#2A372F] rounded-[16px] space-y-2">
                  <div className="h-3.5 bg-[#1D2822] rounded w-1/3 animate-pulse" />
                  <div className="h-3 bg-[#1D2822] rounded w-3/5 animate-pulse" />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Cancel button */}
      <button
        onClick={() => router.push("/scan")}
        className="w-full text-center text-[14px] font-medium text-[#9AAAA0] hover:text-[#EAF1EC] py-3 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
