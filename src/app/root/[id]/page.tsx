"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Share2,
  Bookmark,
  Check,
  ExternalLink,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  X,
  Layers,
} from "lucide-react";
import { StoredRoot, RootsCard, Claim, Lens } from "@/types/roots";
import { getStoredRoots, saveRoot, getUserStats, saveUserStats } from "@/lib/storage/store";
import { LENSES } from "@/lib/constants";
import confetti from "canvas-confetti";

export default function RootCardPage() {
  const params = useParams();
  const router = useRouter();
  const rootId = params.id as string;

  const [root, setRoot] = useState<StoredRoot | null>(null);
  const [isSaved, setIsSaved] = useState(true);
  const [sourcesChecked, setSourcesChecked] = useState(false);
  const [selectedClaimSources, setSelectedClaimSources] = useState<Claim | null>(null);
  const [activeRabbitHole, setActiveRabbitHole] = useState<{
    card: RootsCard;
    depth: number;
    breadcrumb: string[];
  } | null>(null);
  const [isDeepening, setIsDeepening] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [reportedClaims, setReportedClaims] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const all = getStoredRoots();
    const found = all.find((r) => r.id === rootId);

    if (found) {
      setRoot(found);

      // Trigger Pass 2: check and attach evidence sources if not yet loaded
      if (found.card.claims && !sourcesChecked) {
        fetch("/api/evidence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claims: found.card.claims }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.claims) {
              const updatedCard = { ...found.card, claims: data.claims };
              const updatedRoot = { ...found, card: updatedCard };
              setRoot(updatedRoot);
              saveRoot(updatedRoot);
              setSourcesChecked(true);
            }
          })
          .catch(() => setSourcesChecked(true));
      }
    }
  }, [rootId, sourcesChecked]);

  if (!root) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center p-6 text-center">
        <p className="text-[#9AAAA0] mb-4">Root discovery not found.</p>
        <Link
          href="/"
          className="px-5 py-2.5 bg-[#FFC857] text-[#0E1411] font-bold rounded-btn text-[14px]"
        >
          Return Home
        </Link>
      </div>
    );
  }

  const card = activeRabbitHole ? activeRabbitHole.card : root.card;
  const establishedCount = card.claims.filter((c) => c.status === "established").length;
  const verifiedWithSources = card.claims.filter(
    (c) => c.sources && c.sources.length > 0
  ).length;

  const handleDeepen = async (target: {
    kind: "component" | "question";
    componentName?: string;
    questionText?: string;
  }) => {
    try {
      setIsDeepening(true);
      const currentDepth = activeRabbitHole ? activeRabbitHole.depth : root.depth;

      const res = await fetch("/api/deepen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentCard: card,
          kind: target.kind,
          targetComponent: target.componentName,
          questionText: target.questionText,
          currentDepth,
        }),
      });

      if (!res.ok) throw new Error("Failed to deepen");
      const data = await res.json();
      const childCard: RootsCard = data.card;

      const breadcrumbs = activeRabbitHole
        ? [...activeRabbitHole.breadcrumb, childCard.title]
        : [root.title, target.componentName || childCard.title];

      setActiveRabbitHole({
        card: childCard,
        depth: currentDepth + 1,
        breadcrumb: breadcrumbs,
      });

      // Save as child root in the knowledge tree
      const childId = `child-${Date.now()}`;
      const childRoot: StoredRoot = {
        id: childId,
        parentId: root.id,
        parentTitle: root.title,
        depth: currentDepth + 1,
        inputKind: "question",
        inputText: target.questionText || target.componentName,
        title: childCard.title,
        card: childCard,
        lenses: childCard.lenses,
        createdAt: new Date().toISOString(),
      };
      saveRoot(childRoot);

      // Trigger confetti on deep exploration milestone!
      try {
        confetti({ particleCount: 35, spread: 60, origin: { y: 0.8 } });
      } catch {}
    } catch (err) {
      alert("Could not deepen rabbit hole. Please try again.");
    } finally {
      setIsDeepening(false);
    }
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleReportMistake = (claimId: string) => {
    setReportedClaims((prev) => ({ ...prev, [claimId]: true }));
  };

  return (
    <div className="flex flex-col min-h-screen px-6 pt-6 pb-32 bg-[#0E1411]">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => {
            if (activeRabbitHole) {
              setActiveRabbitHole(null);
            } else {
              router.push("/");
            }
          }}
          className="w-10 h-10 rounded-full bg-[#151D18] border border-[#2A372F] flex items-center justify-center text-[#EAF1EC] hover:bg-[#1D2822] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {activeRabbitHole && (
          <div className="px-3 py-1 rounded-full bg-[#1D2822] border border-[#FFC857]/40 text-[#FFC857] text-[12px] font-bold">
            Depth {activeRabbitHole.depth} of 3
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsSaved(!isSaved);
              if (!isSaved) saveRoot(root);
            }}
            className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${
              isSaved
                ? "bg-[#1D2822] border-[#FFC857] text-[#FFC857]"
                : "bg-[#151D18] border-[#2A372F] text-[#9AAAA0]"
            }`}
          >
            <Bookmark className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={handleShare}
            className="w-10 h-10 rounded-full bg-[#151D18] border border-[#2A372F] flex items-center justify-center text-[#EAF1EC] hover:bg-[#1D2822] transition-colors"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Rabbit Hole Breadcrumbs */}
      {activeRabbitHole && (
        <div className="flex items-center gap-1.5 text-[13px] text-[#9AAAA0] mb-3 overflow-x-auto whitespace-nowrap py-1">
          {activeRabbitHole.breadcrumb.map((bc, idx) => (
            <span key={idx} className="flex items-center gap-1.5">
              {idx > 0 && <span className="text-[#FFC857] font-bold">›</span>}
              <span className={idx === activeRabbitHole.breadcrumb.length - 1 ? "text-[#EAF1EC] font-bold" : ""}>
                {bc}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Hero Media / Graphic Header */}
      <div className="w-full h-44 rounded-card bg-[#151D18] border border-[#2A372F] flex items-center justify-center overflow-hidden mb-6 relative">
        <div className="text-center p-6">
          <div className="w-14 h-14 rounded-2xl bg-[#231A00] border border-[#FFC857]/40 mx-auto flex items-center justify-center text-3xl mb-2 shadow-inner">
            {card.lenses.includes("origins")
              ? "⏳"
              : card.lenses.includes("tech")
              ? "⚡"
              : card.lenses.includes("money")
              ? "📈"
              : "🌱"}
          </div>
          <span className="text-[12px] font-semibold text-[#9AAAA0] tracking-wider uppercase">
            {card.inputSummary}
          </span>
        </div>
      </div>

      {/* Title & One-Liner */}
      <div className="mb-4">
        <h1 className="text-[32px] font-extrabold text-[#EAF1EC] tracking-tight leading-[1.12]">
          {card.title}
        </h1>
        <p className="text-[15px] text-[#9AAAA0] leading-snug mt-2">
          {card.oneLiner}
        </p>

        {/* Evidence Sourcing Status */}
        <div className="flex items-center gap-2 mt-3 text-[13px] text-[#9BE564] font-medium">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>
            Sources attached to {verifiedWithSources > 0 ? verifiedWithSources : establishedCount} of{" "}
            {card.claims.length} claims
          </span>
        </div>
      </div>

      {/* THE ROOT Panel (amber, soft glow, always highlighted) */}
      <div className="bg-[#231A00] border-[1.5px] border-[#FFC857] rounded-card p-5 mb-8 root-panel-glow relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-extrabold tracking-wider text-[#FFC857] uppercase">
            The Root
          </span>
          {card.root.lens && (
            <>
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: LENSES[card.root.lens]?.color || "#FFC857" }}
              />
              <span className="text-[12px] text-[#FFC857]/90 font-medium capitalize">
                {LENSES[card.root.lens]?.label}
              </span>
            </>
          )}
        </div>

        <h3 className="text-[20px] font-extrabold text-[#EAF1EC] tracking-tight leading-snug mb-2">
          {card.root.headline}
        </h3>
        <p className="text-[14px] text-[#EAF1EC]/90 leading-relaxed font-normal">
          {card.root.body}
        </p>
      </div>

      {/* "What it is made of" (Components breakdown) */}
      <div className="mb-8">
        <h2 className="text-[20px] font-bold text-[#EAF1EC] tracking-tight mb-3">
          What it is made of
        </h2>

        <div className="flex flex-col gap-3">
          {card.components.map((comp, idx) => {
            const lensInfo = comp.lens ? LENSES[comp.lens] : undefined;
            return (
              <div
                key={idx}
                className="p-4 bg-[#151D18] border border-[#2A372F] rounded-card hover:border-[#FFC857]/40 transition-all cursor-pointer group"
                onClick={() =>
                  handleDeepen({ kind: "component", componentName: comp.name })
                }
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: lensInfo?.color || "#5FE0E8" }}
                    />
                    <h3 className="font-bold text-[16px] text-[#EAF1EC] tracking-tight group-hover:text-[#FFC857] transition-colors">
                      {comp.name}
                    </h3>
                  </div>

                  {lensInfo && (
                    <span
                      className="text-[12px] font-bold tracking-tight px-2 py-0.5 rounded-md"
                      style={{
                        color: lensInfo.color,
                        backgroundColor: `${lensInfo.color}18`,
                      }}
                    >
                      {lensInfo.label}
                    </span>
                  )}
                </div>

                <p className="text-[13px] text-[#9AAAA0] font-medium leading-snug mb-2">
                  {comp.role}
                </p>

                <p className="text-[14px] text-[#EAF1EC] leading-snug">
                  {comp.hiddenFact}
                </p>

                <div className="flex items-center gap-1 mt-3 text-[12px] text-[#FFC857] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Explore rabbit hole</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rabbit Hole Next Questions */}
      <div className="mb-8">
        <h2 className="text-[20px] font-bold text-[#EAF1EC] tracking-tight mb-3">
          Choose your next rabbit hole
        </h2>

        <div className="flex flex-col gap-2.5">
          {card.nextQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() =>
                handleDeepen({
                  kind: "question",
                  questionText: q.text,
                  componentName: q.targetComponent,
                })
              }
              disabled={isDeepening}
              className="p-4 bg-[#151D18] hover:bg-[#1D2822] border border-[#2A372F] hover:border-[#FFC857]/60 rounded-card flex items-center justify-between text-left transition-all group"
            >
              <div className="pr-3">
                <span className="text-[11px] font-bold tracking-wider text-[#FFC857] uppercase block mb-1">
                  {q.kind}
                </span>
                <p className="text-[15px] font-medium text-[#EAF1EC] leading-snug">
                  {q.text}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#1D2822] group-hover:bg-[#FFC857] group-hover:text-[#0E1411] flex items-center justify-center flex-shrink-0 transition-colors text-[#9AAAA0]">
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Evidence Section */}
      <div className="mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[20px] font-bold text-[#EAF1EC] tracking-tight">
            Evidence
          </h2>
          <span className="text-[12px] text-[#9AAAA0]">
            Checking runs after the card loads
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {card.claims.map((claim) => (
            <div
              key={claim.id}
              className="p-4 bg-[#151D18] border border-[#2A372F] rounded-card"
            >
              <p className="text-[14px] text-[#EAF1EC] leading-snug mb-3 font-medium">
                "{claim.text}"
              </p>

              <div className="flex items-center justify-between">
                {/* Status Badge */}
                {claim.status === "established" ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#9BE564]/15 text-[#9BE564] border border-[#9BE564]/30">
                    Established
                  </span>
                ) : claim.status === "interpretation" ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FF9B7A]/15 text-[#FF9B7A] border border-[#FF9B7A]/30">
                    Interpretation: widely told, hard to verify
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#D4A5FF]/15 text-[#D4A5FF] border border-[#D4A5FF]/30">
                    Open question
                  </span>
                )}

                {/* View sources / Report button */}
                <div className="flex items-center gap-2">
                  {claim.sources && claim.sources.length > 0 ? (
                    <button
                      onClick={() => setSelectedClaimSources(claim)}
                      className="px-3 py-1 rounded-full bg-[#1D2822] hover:bg-[#2A372F] text-[12px] font-bold text-[#EAF1EC] border border-[#2A372F] transition-colors"
                    >
                      View sources
                    </button>
                  ) : reportedClaims[claim.id] ? (
                    <span className="text-[11px] text-[#9AAAA0]">Reported</span>
                  ) : (
                    <button
                      onClick={() => handleReportMistake(claim.id)}
                      className="text-[12px] text-[#9AAAA0] hover:text-[#EAF1EC] transition-colors"
                    >
                      Report
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Lenses touched disclaimer */}
        <p className="text-[12px] text-[#9AAAA0] mt-3 leading-relaxed px-1">
          Lenses touched:{" "}
          <strong className="text-[#EAF1EC]">
            {card.lenses.map((l) => LENSES[l]?.label).join(", ")}
          </strong>
          . Other lenses are left out because nothing here genuinely supports them.
        </p>
      </div>

      {/* Connected Concepts */}
      <div className="mb-6">
        <h2 className="text-[16px] font-bold text-[#EAF1EC] tracking-tight mb-2.5">
          Connected to
        </h2>
        <div className="flex flex-wrap gap-2">
          {card.concepts.map((con, idx) => (
            <Link
              key={idx}
              href="/tree"
              className="px-3 py-1.5 rounded-full bg-[#151D18] border border-[#2A372F] text-[13px] font-medium text-[#EAF1EC] hover:border-[#FFC857]/50 flex items-center gap-2 transition-colors"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: con.lens ? LENSES[con.lens]?.color : "#FFC857",
                }}
              />
              <span>{con.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] p-4 bg-[#0E1411]/90 backdrop-blur-md border-t border-[#2A372F] flex items-center gap-3 z-30">
        <button
          onClick={handleShare}
          className="flex-1 h-14 bg-[#151D18] hover:bg-[#1D2822] text-[#EAF1EC] font-bold text-[15px] rounded-btn border border-[#2A372F] flex items-center justify-center gap-2 transition-all"
        >
          <Share2 className="w-5 h-5 text-[#9AAAA0]" />
          <span>Share</span>
        </button>

        <button
          onClick={() => {
            saveRoot(root);
            try {
              confetti({ particleCount: 30, spread: 50 });
            } catch {}
            router.push("/tree");
          }}
          className="flex-[1.4] h-14 bg-[#FFC857] hover:bg-[#E5B040] text-[#0E1411] font-bold text-[15px] rounded-btn flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(255,200,87,0.25)] transition-all"
        >
          <span>Add to my Tree</span>
        </button>
      </div>

      {/* Sources Modal */}
      {selectedClaimSources && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#151D18] border border-[#2A372F] rounded-sheet p-6 animate-slideUp">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[17px] font-bold text-[#EAF1EC]">
                Sources & References
              </h3>
              <button
                onClick={() => setSelectedClaimSources(null)}
                className="w-8 h-8 rounded-full bg-[#1D2822] flex items-center justify-center text-[#9AAAA0]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[13px] text-[#9AAAA0] mb-4">
              Verified claim: "{selectedClaimSources.text}"
            </p>

            <div className="flex flex-col gap-2.5 mb-6">
              {selectedClaimSources.sources.map((src, i) => (
                <a
                  key={i}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 bg-[#1D2822] border border-[#2A372F] hover:border-[#FFC857]/50 rounded-[14px] flex items-center justify-between group transition-colors"
                >
                  <div className="pr-2">
                    <h4 className="text-[14px] font-semibold text-[#EAF1EC] group-hover:text-[#FFC857] transition-colors line-clamp-1">
                      {src.title}
                    </h4>
                    <p className="text-[11px] text-[#9AAAA0] mt-0.5 truncate">
                      {src.url}
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#9AAAA0] flex-shrink-0" />
                </a>
              ))}
            </div>

            <button
              onClick={() => setSelectedClaimSources(null)}
              className="w-full h-12 bg-[#1D2822] hover:bg-[#2A372F] text-[#EAF1EC] font-bold text-[14px] rounded-btn transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Share Card Modal (matching 9 Share card mockup) */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0E1411] border border-[#2A372F] rounded-[24px] p-6 shadow-2xl relative flex flex-col justify-between">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#151D18] border border-[#2A372F] flex items-center justify-center text-[#9AAAA0]"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Share Card Preview Box */}
            <div className="bg-[#151D18] border border-[#2A372F] rounded-[20px] p-5 my-3 shadow-inner">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[14px] font-bold text-[#EAF1EC] flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FFC857]" />
                  Deep Roots
                </span>
                <span className="text-[11px] text-[#9AAAA0] font-semibold uppercase">
                  Root card
                </span>
              </div>

              <h2 className="text-[22px] font-extrabold text-[#EAF1EC] tracking-tight mb-3">
                {card.title}
              </h2>

              <div className="bg-[#231A00] border border-[#FFC857]/60 rounded-[14px] p-3.5 mb-4">
                <span className="text-[10px] font-bold text-[#FFC857] uppercase block mb-1">
                  The Root
                </span>
                <p className="text-[13px] font-semibold text-[#EAF1EC] leading-snug">
                  {card.root.headline}
                </p>
              </div>

              <div className="space-y-2 mb-4">
                {card.components.slice(0, 3).map((comp, idx) => (
                  <div key={idx} className="text-[12px] text-[#9AAAA0] flex items-baseline gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: comp.lens ? LENSES[comp.lens]?.color : "#5FE0E8",
                      }}
                    />
                    <span className="text-[#EAF1EC] font-bold">{comp.name}:</span>
                    <span className="truncate">{comp.hiddenFact}</span>
                  </div>
                ))}
              </div>

              {/* Lens Color Strip */}
              <div className="flex items-center gap-1.5 pt-3 border-t border-[#2A372F]">
                {card.lenses.map((l) => (
                  <div
                    key={l}
                    className="h-1.5 flex-1 rounded-full"
                    style={{ backgroundColor: LENSES[l]?.color || "#FFC857" }}
                  />
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2.5 mt-2">
              <button
                onClick={handleCopyLink}
                className="w-full h-12 bg-[#FFC857] text-[#0E1411] font-bold rounded-btn text-[14px] flex items-center justify-center gap-2 transition-all"
              >
                {copiedLink ? <Check className="w-4 h-4 stroke-[3]" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedLink ? "Link Copied!" : "Copy Share Link"}</span>
              </button>

              <button
                onClick={() => setShowShareModal(false)}
                className="w-full h-11 bg-[#151D18] text-[#9AAAA0] hover:text-[#EAF1EC] font-medium rounded-btn text-[13px]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
