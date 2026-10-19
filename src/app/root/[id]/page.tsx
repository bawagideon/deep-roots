"use client";

import { useEffect, useState, useRef } from "react";
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
  Download,
  Info,
} from "lucide-react";
import { StoredRoot, RootsCard, Claim, Lens } from "@/types/roots";
import { getStoredRoots, saveRoot, deleteRoot, getUserStats } from "@/lib/storage/store";
import { LENSES } from "@/lib/constants";
import { PaywallModal } from "@/components/paywall/PaywallModal";
import { VisualStage } from "@/components/visual/VisualStage";
import { buildConstellationSpec, getCardVisualSpec } from "@/lib/visual/generator";
import { VisualSpec } from "@/types/visual";
import confetti from "canvas-confetti";
import { UnearthReveal } from "@/components/motion/UnearthReveal";
import { SeedArc } from "@/components/motion/SeedArc";

export default function RootCardPage() {
  const params = useParams();
  const router = useRouter();
  const rootId = params.id as string;

  const [root, setRoot] = useState<StoredRoot | null>(null);
  const [isSaved, setIsSaved] = useState(true);
  const [saveButtonRect, setSaveButtonRect] = useState<DOMRect | null>(null);
  const [isVerifyingSources, setIsVerifyingSources] = useState(false);
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
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [visualSpec, setVisualSpec] = useState<VisualSpec | null>(null);

  useEffect(() => {
    const all = getStoredRoots();
    const found = all.find((r) => r.id === rootId);

    if (found) {
      setRoot(found);

      // Trigger Pass 2: real source verification if claims don't have sources yet
      const needsVerification = found.card.claims.some(
        (c) => (!c.sources || c.sources.length === 0) && c.status === "established"
      );

      if (needsVerification && !isVerifyingSources) {
        setIsVerifyingSources(true);
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
            }
          })
          .catch(() => {})
          .finally(() => setIsVerifyingSources(false));
      }
    }
  }, [rootId]);

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
  const currentVisualSpec = visualSpec || buildConstellationSpec(card);

  useEffect(() => {
    if (root) {
      const c = activeRabbitHole ? activeRabbitHole.card : root.card;
      setVisualSpec(buildConstellationSpec(c));
      getCardVisualSpec(c)
        .then((s) => setVisualSpec(s))
        .catch(() => {});
    }
  }, [root, activeRabbitHole]);

  const verifiedSourcesCount = card.claims.filter(
    (c) => c.sources && c.sources.length > 0 && c.evidenceStatus === "supported"
  ).length;
  const establishedCount = card.claims.filter((c) => c.status === "established").length;
  const interpretationCount = card.claims.filter((c) => c.status === "interpretation").length;

  const handleToggleBookmark = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (isSaved) {
      // Remove root from store
      deleteRoot(root.id);
      setIsSaved(false);
    } else {
      if (e?.currentTarget) {
        setSaveButtonRect(e.currentTarget.getBoundingClientRect());
      }
      saveRoot(root);
      setIsSaved(true);
    }
  };

  const handleDeepen = async (target: {
    kind: "component" | "question";
    componentName?: string;
    questionText?: string;
  }) => {
    try {
      const currentDepth = activeRabbitHole ? activeRabbitHole.depth : root.depth;
      const stats = getUserStats();
      const plan = stats.profile?.plan || "free";
      const maxAllowedDepth = plan === "pro" ? 5 : 3;

      if (currentDepth >= maxAllowedDepth) {
        setShowPaywallModal(true);
        return;
      }

      setIsDeepening(true);

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

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to deepen");
      }

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

      // Save as child root in persistent store
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

      try {
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
      } catch {}
    } catch (err: any) {
      alert(err.message || "Could not deepen rabbit hole.");
    } finally {
      setIsDeepening(false);
    }
  };

  const handleReportMistake = async (claimId: string, claimText: string) => {
    setReportedClaims((prev) => ({ ...prev, [claimId]: true }));
    try {
      await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootId: root.id,
          claimId,
          claimText,
          reason: "User flagged for verification review",
        }),
      });
    } catch {}
  };

  return (
    <div className="flex flex-col min-h-screen px-6 pt-6 pb-32 bg-[#0E1411]">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between mb-4">
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

        {activeRabbitHole ? (
          <div className="px-3 py-1 rounded-full bg-[#1D2822] border border-[#FFC857]/40 text-[#FFC857] text-[12px] font-bold">
            Depth {activeRabbitHole.depth} of 3
          </div>
        ) : root.isSeeded ? (
          <div className="px-3 py-1 rounded-full bg-[#1D2822] border border-[#2A372F] text-[#9AAAA0] text-[11px] font-medium">
            Sample Root
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleBookmark}
            title={isSaved ? "Remove from Tree" : "Save to Tree"}
            className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${
              isSaved
                ? "bg-[#1D2822] border-[#FFC857] text-[#FFC857]"
                : "bg-[#151D18] border-[#2A372F] text-[#9AAAA0]"
            }`}
          >
            <Bookmark className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={() => setShowShareModal(true)}
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

      {/* Visual Discovery Engine */}
      <div className="mb-5">
        <VisualStage
          spec={currentVisualSpec}
          card={card}
          onDigDeeper={(componentName) =>
            handleDeepen({ kind: "component", componentName })
          }
        />
      </div>

      {/* Title & One-Liner */}
      <div className="mb-4">
        <h1 className="text-[30px] font-extrabold text-[#EAF1EC] tracking-tight leading-[1.12]">
          {card.title}
        </h1>
        <p className="text-[15px] text-[#9AAAA0] leading-snug mt-2">
          {card.oneLiner}
        </p>

        {/* Separated Honest Evidence Sourcing Counter */}
        <div className="mt-3 text-[12px] font-medium flex items-center gap-2">
          {verifiedSourcesCount > 0 ? (
            <span className="text-[#9BE564] flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              {verifiedSourcesCount} of {card.claims.length} claims verified with external sources
            </span>
          ) : isVerifyingSources ? (
            <span className="text-[#FFC857] animate-pulse">
              Checking external sources ({establishedCount} established claims)...
            </span>
          ) : (
            <span className="text-[#9AAAA0] flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              {establishedCount} established claims, {interpretationCount} interpretations
            </span>
          )}
        </div>
      </div>

      {/* THE ROOT Panel with Signature Unearth Reveal */}
      <UnearthReveal
        headline={card.root.headline}
        body={card.root.body}
        tag={card.root.lens ? `THE ROOT · ${LENSES[card.root.lens]?.label || ""}` : "THE ROOT"}
        className="mb-8"
      />

      {/* Components Breakdown */}
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
            Claims & Verifications
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
                {/* Status Badges */}
                {claim.evidenceStatus === "supported" ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#9BE564]/15 text-[#9BE564] border border-[#9BE564]/30">
                    Established · Supported by source
                  </span>
                ) : claim.evidenceStatus === "contradicted" ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-950/40 text-red-400 border border-red-500/30">
                    Contradicted by source
                  </span>
                ) : claim.evidenceStatus === "insufficient" ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FF9B7A]/15 text-[#FF9B7A] border border-[#FF9B7A]/30">
                    Interpretation · Insufficient evidence
                  </span>
                ) : claim.status === "established" ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#5FE0E8]/15 text-[#5FE0E8] border border-[#5FE0E8]/30">
                    Established · Unverified
                  </span>
                ) : claim.status === "interpretation" ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FF9B7A]/15 text-[#FF9B7A] border border-[#FF9B7A]/30">
                    Interpretation: widely told
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#D4A5FF]/15 text-[#D4A5FF] border border-[#D4A5FF]/30">
                    Open question
                  </span>
                )}

                {/* View sources / Report actions */}
                <div className="flex items-center gap-2">
                  {claim.sources && claim.sources.length > 0 ? (
                    <button
                      onClick={() => setSelectedClaimSources(claim)}
                      className="px-3 py-1 rounded-full bg-[#1D2822] hover:bg-[#2A372F] text-[12px] font-bold text-[#EAF1EC] border border-[#2A372F] transition-colors"
                    >
                      View sources
                    </button>
                  ) : reportedClaims[claim.id] ? (
                    <span className="text-[11px] text-[#9BE564] font-semibold">Reported ✓</span>
                  ) : (
                    <button
                      onClick={() => handleReportMistake(claim.id, claim.text)}
                      className="text-[12px] text-[#9AAAA0] hover:text-[#EAF1EC] transition-colors"
                    >
                      Report a mistake
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
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
          onClick={() => setShowShareModal(true)}
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
          <span>{isSaved ? "Saved in Tree ✓" : "Add to my Tree"}</span>
        </button>
      </div>

      {/* Verified Sources Modal */}
      {selectedClaimSources && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#151D18] border border-[#2A372F] rounded-sheet p-6 animate-slideUp max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[17px] font-bold text-[#EAF1EC]">
                Retrieved Evidence
              </h3>
              <button
                onClick={() => setSelectedClaimSources(null)}
                className="w-8 h-8 rounded-full bg-[#1D2822] flex items-center justify-center text-[#9AAAA0]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-[13px] text-[#9AAAA0] mb-2 leading-relaxed">
                Claim statement: <span className="text-[#EAF1EC] italic">"{selectedClaimSources.text}"</span>
              </p>
              {selectedClaimSources.evidenceStatus && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#1D2822] border border-[#2A372F]">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      selectedClaimSources.evidenceStatus === "supported"
                        ? "bg-[#9BE564]"
                        : selectedClaimSources.evidenceStatus === "contradicted"
                        ? "bg-red-400"
                        : "bg-[#FFC857]"
                    }`}
                  />
                  <span className="text-[#EAF1EC] capitalize">
                    {selectedClaimSources.evidenceStatus} by external text
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 mb-6 overflow-y-auto pr-1">
              {selectedClaimSources.sources?.map((src, i) => (
                <div
                  key={i}
                  className="p-3.5 bg-[#1D2822] border border-[#2A372F] rounded-[14px] flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="pr-2 min-w-0">
                      <h4 className="text-[14px] font-semibold text-[#EAF1EC] line-clamp-1">
                        {src.title}
                      </h4>
                      <p className="text-[11px] text-[#9AAAA0] mt-0.5 truncate">
                        {src.url}
                      </p>
                    </div>
                    {src.url && (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-[#2A372F] rounded text-[#9AAAA0] hover:text-[#FFC857] transition-colors flex-shrink-0"
                        title="Open external source"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                  {src.excerpt && (
                    <div className="bg-[#0E1411] border-l-2 border-[#9BE564] p-2.5 rounded-r text-[12px] text-[#C4D1C9] italic leading-relaxed">
                      "{src.excerpt}"
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelectedClaimSources(null)}
              className="w-full h-12 bg-[#1D2822] hover:bg-[#2A372F] text-[#EAF1EC] font-bold text-[14px] rounded-btn transition-colors mt-auto"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Share Snapshot Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0E1411] border border-[#2A372F] rounded-[24px] p-6 shadow-2xl relative flex flex-col justify-between">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#151D18] border border-[#2A372F] flex items-center justify-center text-[#9AAAA0]"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Share Card Snapshot */}
            <div className="bg-[#151D18] border border-[#2A372F] rounded-[20px] p-5 my-3 shadow-inner">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[14px] font-bold text-[#EAF1EC] flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FFC857]" />
                  Deep Roots
                </span>
                <span className="text-[11px] text-[#9AAAA0] font-semibold uppercase">
                  Discovery Card
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

            {/* Privacy Disclaimer */}
            <p className="text-[11px] text-[#9AAAA0] text-center mb-3">
              Public snapshot only. Private photos, scan metadata, and notes are never shared.
            </p>

            {/* Action buttons */}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/root/${root.id}`
                    );
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }
                }}
                className="w-full h-12 bg-[#FFC857] text-[#0E1411] font-bold rounded-btn text-[14px] flex items-center justify-center gap-2 transition-all"
              >
                {copiedLink ? <Check className="w-4 h-4 stroke-[3]" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedLink ? "Snapshot Link Copied!" : "Copy Public Link"}</span>
              </button>

              <button
                onClick={() => setShowShareModal(false)}
                className="w-full h-11 bg-[#151D18] text-[#9AAAA0] hover:text-[#EAF1EC] font-medium rounded-btn text-[13px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pro Paywall Modal */}
      <PaywallModal
        isOpen={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        featureNotice="Pro unlocks rabbit hole depth 5"
      />

      {/* Signature Seed Arc Projectile */}
      <SeedArc
        startRect={saveButtonRect}
        onFinish={() => setSaveButtonRect(null)}
      />
    </div>
  );
}
