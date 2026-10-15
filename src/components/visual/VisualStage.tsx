"use client";

import { useState } from "react";
import { VisualSpec, VisualPart } from "@/types/visual";
import { RootsCard, CardComponent } from "@/types/roots";
import { resolveVisualToken } from "@/lib/visual/integrity";
import { LENSES } from "@/lib/constants";
import { ArrowRight, Sparkles } from "lucide-react";

interface VisualStageProps {
  spec: VisualSpec;
  card: RootsCard;
  onDigDeeper?: (componentName: string) => void;
  reducedMotion?: boolean;
}

export function VisualStage({
  spec,
  card,
  onDigDeeper,
  reducedMotion = false,
}: VisualStageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCalm, setIsCalm] = useState(reducedMotion);

  const parts = spec.parts || [];
  const selectedPart = parts.find((p) => p.id === selectedId);
  const selectedComponent: CardComponent | null =
    selectedPart !== undefined && card.components
      ? card.components[selectedPart.componentIndex] || null
      : null;

  // Calculate constellation coordinates dynamically
  const n = parts.length;
  const constellationParts = parts.map((p, i) => {
    const angle = ((-90 + (i * 360) / Math.max(1, n)) * Math.PI) / 180;
    return {
      ...p,
      x: 50 + 32 * Math.cos(angle),
      y: 50 + 32 * Math.sin(angle),
    };
  });

  return (
    <div className="w-full flex flex-col gap-3">
      {/* SVG Stage */}
      <div className="relative w-full aspect-square bg-[#0E1411] border border-[#2A372F] rounded-[24px] overflow-hidden p-2 shadow-inner">
        <svg
          viewBox="0 0 100 100"
          className={`w-full h-full select-none ${isCalm ? "calm" : ""}`}
          role="img"
          aria-label={spec.alt}
        >
          {/* Constellation Archetype */}
          {spec.archetype === "constellation" && (
            <g>
              {/* Spoke Lines */}
              {constellationParts.map((p) => (
                <line
                  key={`line-${p.id}`}
                  x1="50"
                  y1="50"
                  x2={p.x}
                  y2={p.y}
                  stroke={resolveVisualToken(p.lens)}
                  strokeOpacity={selectedId && selectedId !== p.id ? 0.15 : 0.45}
                  strokeWidth="0.8"
                  strokeDasharray="1.5 1"
                />
              ))}

              {/* Center Root Node */}
              <g
                tabIndex={0}
                role="button"
                onClick={() => setSelectedId("root")}
                className="cursor-pointer outline-none group"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="9"
                  fill="#231A00"
                  stroke="#FFC857"
                  strokeWidth={selectedId === "root" ? "1.8" : "1.2"}
                />
                <circle cx="50" cy="50" r="12" fill="#FFC857" opacity="0.12" />
                <text
                  x="50"
                  y="51.2"
                  textAnchor="middle"
                  fill="#FFC857"
                  className="font-black text-[3.2px] tracking-wider uppercase pointer-events-none"
                >
                  ROOT
                </text>
              </g>

              {/* Component Nodes */}
              {constellationParts.map((p) => {
                const isSelected = selectedId === p.id;
                const tokenColor = resolveVisualToken(p.lens);

                return (
                  <g
                    key={p.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => setSelectedId(p.id)}
                    className="cursor-pointer outline-none transition-all duration-300"
                    opacity={selectedId && !isSelected && selectedId !== "root" ? 0.35 : 1}
                  >
                    {/* Hit target */}
                    <circle cx={p.x} cy={p.y} r="10" fill="transparent" />

                    {/* Node circle */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isSelected ? "7" : "5.8"}
                      fill="#151D18"
                      stroke={tokenColor}
                      strokeWidth={isSelected ? "1.8" : "1.2"}
                    />
                    <circle cx={p.x} cy={p.y} r="2" fill={tokenColor} />

                    {/* Node label */}
                    <text
                      x={p.x}
                      y={p.y + 10}
                      textAnchor="middle"
                      fill="#EAF1EC"
                      className="font-bold text-[3px] pointer-events-none"
                      style={{
                        paintOrder: "stroke",
                        stroke: "#0E1411",
                        strokeWidth: "0.8px",
                      }}
                    >
                      {p.label}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* Flow Archetype */}
          {spec.archetype === "flow" && (
            <g>
              {spec.links.map((link, idx) => {
                const fromPart = parts.find((p) => p.id === link.from);
                const toPart = parts.find((p) => p.id === link.to);
                const fromPos = fromPart?.pos || [20, 50];
                const toPos = toPart?.pos || spec.rootNode?.pos || [80, 50];
                const midX = (fromPos[0] + toPos[0]) / 2;

                const pathData = `M ${fromPos[0]} ${fromPos[1]} C ${midX} ${fromPos[1]}, ${midX} ${toPos[1]}, ${toPos[0]} ${toPos[1]}`;

                return (
                  <g key={idx}>
                    <path
                      d={pathData}
                      fill="none"
                      stroke={fromPart ? resolveVisualToken(fromPart.lens) : "#FFC857"}
                      strokeOpacity="0.4"
                      strokeWidth="0.9"
                    />
                  </g>
                );
              })}

              {parts.map((p) => {
                const pos = p.pos || [30, 50];
                const isSelected = selectedId === p.id;
                const tokenColor = resolveVisualToken(p.lens);

                return (
                  <g
                    key={p.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => setSelectedId(p.id)}
                    className="cursor-pointer outline-none"
                    opacity={selectedId && !isSelected ? 0.35 : 1}
                  >
                    <circle cx={pos[0]} cy={pos[1]} r="9" fill="transparent" />
                    <circle
                      cx={pos[0]}
                      cy={pos[1]}
                      r={isSelected ? "6.5" : "5"}
                      fill="#151D18"
                      stroke={tokenColor}
                      strokeWidth="1.3"
                    />
                    <circle cx={pos[0]} cy={pos[1]} r="1.8" fill={tokenColor} />
                    <text
                      x={pos[0]}
                      y={pos[1] + 9}
                      textAnchor="middle"
                      fill="#EAF1EC"
                      className="font-bold text-[3px]"
                    >
                      {p.label}
                    </text>
                  </g>
                );
              })}

              {spec.rootNode && (
                <g
                  onClick={() => setSelectedId("root")}
                  className="cursor-pointer"
                >
                  <circle
                    cx={spec.rootNode.pos[0]}
                    cy={spec.rootNode.pos[1]}
                    r="6.5"
                    fill="#231A00"
                    stroke="#FFC857"
                    strokeWidth="1.2"
                  />
                  <text
                    x={spec.rootNode.pos[0]}
                    y={spec.rootNode.pos[1] + 10}
                    textAnchor="middle"
                    fill="#FFC857"
                    className="font-bold text-[3px]"
                  >
                    {spec.rootNode.label}
                  </text>
                </g>
              )}
            </g>
          )}
        </svg>

        {/* Archetype Badge */}
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#151D18]/90 border border-[#2A372F] text-[10px] font-bold text-[#FFC857] uppercase tracking-wider">
          Visual: {spec.archetype}
        </div>
      </div>

      {/* Selected Part Detail & Rabbit Hole trigger */}
      {selectedId === "root" ? (
        <div className="bg-[#151D18] border border-[#FFC857]/50 rounded-[18px] p-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFC857]" />
            <h4 className="text-[14px] font-bold text-[#FFC857]">The Root Discovery</h4>
          </div>
          <p className="text-[13px] text-[#EAF1EC] leading-snug">
            {card.root?.headline}
          </p>
        </div>
      ) : selectedComponent ? (
        <div className="bg-[#151D18] border border-[#2A372F] rounded-[18px] p-4 flex flex-col gap-2.5 animate-fade-in shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: selectedComponent.lens
                    ? LENSES[selectedComponent.lens]?.color
                    : "#FFC857",
                }}
              />
              <h4 className="text-[14px] font-bold text-[#EAF1EC]">
                {selectedComponent.name}
              </h4>
              {selectedComponent.lens && (
                <span className="text-[11px] font-semibold text-[#9AAAA0] capitalize">
                  · {selectedComponent.lens}
                </span>
              )}
            </div>

            <span className="text-[11px] text-[#9AAAA0] font-medium">
              {selectedComponent.role}
            </span>
          </div>

          <p className="text-[13px] text-[#9AAAA0] leading-snug">
            {selectedComponent.hiddenFact}
          </p>

          {onDigDeeper && (
            <button
              onClick={() => onDigDeeper(selectedComponent.name)}
              className="mt-1 h-10 px-3.5 bg-[#FFC857] hover:bg-[#E5B040] text-[#0E1411] font-bold text-[13px] rounded-btn flex items-center justify-center gap-1.5 transition-all self-start"
            >
              <span>Dig deeper from this part</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-[#9AAAA0] px-1">
          Tap any component in the visual discovery engine to explore its hidden facts.
        </p>
      )}
    </div>
  );
}
