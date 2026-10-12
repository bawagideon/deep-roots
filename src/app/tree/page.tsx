"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitFork, List, Network, ChevronRight, Sparkles, Filter } from "lucide-react";
import { StoredRoot, GraphEdge, Lens } from "@/types/roots";
import { getStoredRoots, getStoredEdges } from "@/lib/storage/store";
import { LENSES } from "@/lib/constants";

export default function RootTreePage() {
  const router = useRouter();
  const [roots, setRoots] = useState<StoredRoot[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");
  const [selectedLens, setSelectedLens] = useState<Lens | "all">("all");
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  useEffect(() => {
    const loadedRoots = getStoredRoots();
    const loadedEdges = getStoredEdges();
    setRoots(loadedRoots);
    setEdges(loadedEdges);
    if (loadedRoots.length > 0) {
      setActiveNodeId(loadedRoots[0].id);
    }
  }, []);

  const activeNode = roots.find((r) => r.id === activeNodeId) || roots[0];

  const filteredRoots =
    selectedLens === "all"
      ? roots
      : roots.filter((r) => r.lenses && r.lenses.includes(selectedLens));

  // Dynamic layout calculations for the mobile SVG graph
  const centerX = 180;
  const centerY = 190;
  const radius = 110;

  return (
    <div className="flex flex-col min-h-screen px-6 pt-10 pb-28 bg-[#0E1411]">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[28px] font-extrabold text-[#EAF1EC] tracking-tight leading-tight">
            Your Root Tree
          </h1>
          <p className="text-[13px] text-[#9AAAA0] font-medium mt-0.5">
            {roots.length} roots · {edges.length} links
          </p>
        </div>

        {/* Graph / List Switch */}
        <div className="flex items-center p-1 bg-[#151D18] border border-[#2A372F] rounded-[14px]">
          <button
            onClick={() => setViewMode("graph")}
            className={`px-3 py-1.5 rounded-[10px] text-[12px] font-bold transition-all ${
              viewMode === "graph"
                ? "bg-[#FFC857] text-[#0E1411]"
                : "text-[#9AAAA0] hover:text-[#EAF1EC]"
            }`}
          >
            Graph
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 rounded-[10px] text-[12px] font-bold transition-all ${
              viewMode === "list"
                ? "bg-[#FFC857] text-[#0E1411]"
                : "text-[#9AAAA0] hover:text-[#EAF1EC]"
            }`}
          >
            List
          </button>
        </div>
      </div>

      {/* Lens Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none whitespace-nowrap">
        <button
          onClick={() => setSelectedLens("all")}
          className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-all ${
            selectedLens === "all"
              ? "bg-[#1D2822] border-[#FFC857] text-[#EAF1EC]"
              : "bg-[#151D18] border-[#2A372F] text-[#9AAAA0] hover:text-[#EAF1EC]"
          }`}
        >
          All
        </button>

        {(Object.keys(LENSES) as Lens[]).map((key) => {
          const lens = LENSES[key];
          const isSelected = selectedLens === key;
          return (
            <button
              key={key}
              onClick={() => setSelectedLens(key)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border flex items-center gap-2 transition-all ${
                isSelected
                  ? "bg-[#1D2822] border-[#FFC857] text-[#EAF1EC]"
                  : "bg-[#151D18] border-[#2A372F] text-[#9AAAA0] hover:text-[#EAF1EC]"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: lens.color }}
              />
              <span>{lens.label}</span>
            </button>
          );
        })}
      </div>

      {/* GRAPH VIEW */}
      {viewMode === "graph" ? (
        <div className="flex-1 flex flex-col justify-between">
          <div className="relative w-full aspect-square rounded-[24px] bg-[#151D18] border border-[#2A372F] p-2 overflow-hidden flex items-center justify-center">
            <svg
              className="w-full h-full"
              viewBox="0 0 360 380"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Radial background rings */}
              <circle
                cx={centerX}
                cy={centerY}
                r={radius}
                fill="none"
                stroke="#1D2822"
                strokeWidth="1.2"
                strokeDasharray="4 4"
              />
              <circle
                cx={centerX}
                cy={centerY}
                r={radius * 0.55}
                fill="none"
                stroke="#1D2822"
                strokeWidth="1.2"
              />

              {/* Connecting lines */}
              {roots.map((r, i) => {
                if (i === 0) return null;
                const angle = ((i - 1) / Math.max(1, roots.length - 1)) * 2 * Math.PI;
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                const isSelected = activeNodeId === r.id;

                return (
                  <line
                    key={`line-${r.id}`}
                    x1={centerX}
                    y1={centerY}
                    x2={x}
                    y2={y}
                    stroke={isSelected ? "#FFC857" : "#2A372F"}
                    strokeWidth={isSelected ? "2" : "1.2"}
                    strokeDasharray={r.depth > 0 ? "none" : "3 3"}
                  />
                );
              })}

              {/* Outer nodes */}
              {roots.map((r, i) => {
                if (i === 0) return null;
                const angle = ((i - 1) / Math.max(1, roots.length - 1)) * 2 * Math.PI;
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                const isSelected = activeNodeId === r.id;
                const primaryLens = r.lenses?.[0] || "tech";
                const nodeColor = LENSES[primaryLens]?.color || "#FFC857";

                return (
                  <g
                    key={`node-${r.id}`}
                    onClick={() => setActiveNodeId(r.id)}
                    className="cursor-pointer transition-transform hover:scale-110"
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? 18 : 14}
                      fill="#0E1411"
                      stroke={nodeColor}
                      strokeWidth={isSelected ? 3.5 : 2.5}
                    />
                    <text
                      x={x}
                      y={y + 26}
                      textAnchor="middle"
                      fill={isSelected ? "#FFC857" : "#9AAAA0"}
                      fontSize="10"
                      fontWeight={isSelected ? "bold" : "normal"}
                    >
                      {r.title.slice(0, 11)}
                    </text>
                  </g>
                );
              })}

              {/* Center Root Node */}
              {roots[0] && (
                <g
                  onClick={() => setActiveNodeId(roots[0].id)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={centerX}
                    cy={centerY}
                    r={24}
                    fill="#0E1411"
                    stroke={
                      activeNodeId === roots[0].id
                        ? "#FFC857"
                        : LENSES[roots[0].lenses?.[0] || "tech"]?.color || "#9BE564"
                    }
                    strokeWidth="3.5"
                  />
                  <text
                    x={centerX}
                    y={centerY + 34}
                    textAnchor="middle"
                    fill="#EAF1EC"
                    fontSize="11"
                    fontWeight="bold"
                  >
                    {roots[0].title.slice(0, 15)}
                  </text>
                </g>
              )}
            </svg>
          </div>

          {/* Active Node Detail Card (Bottom drawer) */}
          {activeNode && (
            <Link
              href={`/root/${activeNode.id}`}
              className="mt-4 p-4 bg-[#151D18] hover:bg-[#1D2822] border border-[#2A372F] rounded-card flex items-center justify-between transition-all group"
            >
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor:
                      LENSES[activeNode.lenses?.[0] || "tech"]?.color || "#FFC857",
                  }}
                />
                <div className="min-w-0">
                  <h3 className="font-bold text-[16px] text-[#EAF1EC] tracking-tight truncate group-hover:text-[#FFC857] transition-colors">
                    {activeNode.title}
                  </h3>
                  <p className="text-[12px] text-[#9AAAA0] truncate">
                    {activeNode.card?.components?.length || 4} parts · {activeNode.depth > 0 ? `Rabbit hole depth ${activeNode.depth}` : "Primary scan"} · Tap to open
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#9AAAA0] flex-shrink-0 group-hover:text-[#FFC857] transition-colors" />
            </Link>
          )}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="flex flex-col gap-2.5">
          {filteredRoots.map((r) => {
            const primaryLens = r.lenses?.[0] || "tech";
            return (
              <Link
                key={r.id}
                href={`/root/${r.id}`}
                className="p-4 bg-[#151D18] hover:bg-[#1D2822] border border-[#2A372F] rounded-card flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: LENSES[primaryLens]?.color || "#FFC857",
                    }}
                  />
                  <div className="min-w-0">
                    <h3 className="font-bold text-[15px] text-[#EAF1EC] tracking-tight truncate group-hover:text-[#FFC857] transition-colors">
                      {r.title}
                    </h3>
                    <p className="text-[12px] text-[#9AAAA0] truncate">
                      {r.card?.root?.headline || r.card?.oneLiner}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.depth > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-[#1D2822] border border-[#2A372F] text-[10px] font-bold text-[#FFC857]">
                      Depth {r.depth}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-[#9AAAA0]" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
