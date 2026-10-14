"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RootsCard, StoredRoot, GraphEdge } from "@/types/roots";
import { saveRoot, saveEdge, getStoredRoots } from "@/lib/storage/store";
import { LENSES } from "@/lib/constants";

export default function AnalyzingPage() {
  const params = useParams();
  const router = useRouter();
  const scanId = params.id as string;

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [inputText, setInputText] = useState<string>("");
  const [progress, setProgress] = useState(20);
  const [statusMessage, setStatusMessage] = useState("Decomposing input...");
  const [partialCard, setPartialCard] = useState<Partial<RootsCard> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const raw = sessionStorage.getItem(`deeproots_pending_${scanId}`);
    if (!raw) {
      router.push("/scan");
      return;
    }

    const payload = JSON.parse(raw);
    if (payload.imageBase64) setPreviewImage(payload.imageBase64);
    if (payload.inputText) setInputText(payload.inputText);

    async function runScanPipeline() {
      try {
        setStatusMessage("Extracting components & hidden layers...");
        setProgress(35);

        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Decomposition failed");
        }

        const data = await res.json();
        const card: RootsCard = data.card;

        if (isCancelled) return;

        setProgress(70);
        setStatusMessage("Uncovering the Root discovery...");
        setPartialCard(card);

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

        // Phase D: Evaluate & PERSIST Cross-Scan Knowledge Graph Links
        setStatusMessage("Connecting to knowledge tree...");
        setProgress(90);

        const allRoots = getStoredRoots();
        try {
          const linkRes = await fetch("/api/link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newRoot: stored, existingRoots: allRoots }),
          });

          if (linkRes.ok) {
            const linkData = await linkRes.json();
            const edges: GraphEdge[] = linkData.edges || [];
            // Explicitly consume and save all returned edges
            edges.forEach((edge) => saveEdge(edge));
          }
        } catch (linkErr) {
          console.warn("Link stage skipped:", linkErr);
        }

        setProgress(100);
        sessionStorage.removeItem(`deeproots_pending_${scanId}`);

        setTimeout(() => {
          if (!isCancelled) {
            router.push(`/root/${scanId}`);
          }
        }, 600);
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || "Failed to decompose. Please try again.");
        }
      }
    }

    runScanPipeline();

    return () => {
      isCancelled = true;
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
        <div className="w-full h-44 rounded-[20px] bg-[#151D18] border border-[#2A372F] flex items-center justify-center overflow-hidden mb-5 relative">
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
        <div className="mb-3">
          <h2 className="text-[24px] font-extrabold text-[#EAF1EC] tracking-tight leading-tight">
            {partialCard?.title || inputText || "Decomposing..."}
          </h2>
          <p className="text-[13px] text-[#FFC857] mt-1 font-medium">
            {statusMessage}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-[#1D2822] rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-[#FFC857] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {error ? (
          <div className="p-4 rounded-card bg-red-950/40 border border-red-500/40 text-red-200">
            <p className="font-semibold text-[15px] mb-1">Decomposition halted</p>
            <p className="text-[13px] opacity-90 mb-3">{error}</p>
            <button
              onClick={() => router.push("/scan")}
              className="px-4 py-2 bg-[#FFC857] text-[#0E1411] font-bold text-[13px] rounded-lg"
            >
              Back to Scan
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* The Root Reveal Skeleton */}
            <div className="bg-[#231A00]/80 border-2 border-dashed border-[#FFC857]/60 rounded-card p-4 transition-all">
              <span className="text-[10px] font-bold tracking-wider text-[#FFC857] uppercase block mb-1">
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
                <div className="space-y-2 py-1">
                  <div className="h-4 bg-[#FFC857]/20 rounded-md w-3/4 animate-pulse" />
                  <div className="h-3.5 bg-[#FFC857]/15 rounded-md w-1/2 animate-pulse" />
                </div>
              )}
            </div>

            {/* Components Streaming In */}
            {partialCard?.components && partialCard.components.length > 0 ? (
              partialCard.components.slice(0, 3).map((comp, idx) => {
                const lensInfo = comp.lens ? LENSES[comp.lens] : undefined;
                return (
                  <div
                    key={idx}
                    className="p-3.5 bg-[#151D18] border border-[#2A372F] rounded-[16px] flex items-center justify-between"
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
              <div className="p-4 bg-[#151D18] border border-[#2A372F] rounded-[16px] space-y-2">
                <div className="h-3.5 bg-[#1D2822] rounded w-2/5 animate-pulse" />
                <div className="h-3 bg-[#1D2822] rounded w-4/5 animate-pulse" />
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => router.push("/scan")}
        className="w-full text-center text-[14px] font-medium text-[#9AAAA0] hover:text-[#EAF1EC] py-3 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
