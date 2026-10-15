import { Lens } from "./roots";

export type MaterialToken =
  | "grain"
  | "tomato"
  | "leaf"
  | "cream"
  | "oil"
  | "glass"
  | "ink"
  | "muted"
  | "text"
  | "amber";

export type VisualToken = Lens | MaterialToken;

export type VisualPrimitive =
  | { t: "rect"; x: number; y: number; w: number; h: number; r?: number; fill: VisualToken }
  | { t: "circle"; cx: number; cy: number; r: number; fill: VisualToken }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill: VisualToken }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; stroke: VisualToken; sw?: number }
  | { t: "poly"; points: [number, number][]; fill: VisualToken }
  | { t: "path"; d: string; fill?: VisualToken; stroke?: VisualToken; sw?: number };

export interface VisualPart {
  id: string;
  componentIndex: number; // MUST point at a real component in the card
  label: string; // <= 3 words, derived from the component name
  lens: Lens;
  order: number; // reveal order
  box?: { x: number; y: number; w: number; h: number }; // 0..1, hotspots only
  art?: VisualPrimitive[]; // explode only, 0..100 grid, <= 12 primitives per part
  explodeVector?: [number, number]; // explode only
  labelAt?: [number, number]; // explode only, on the 0..100 grid
  pos?: [number, number]; // flow only, on the 0..100 grid
}

export interface VisualLink {
  from: string;
  to: string;
  kind: "contains" | "causes" | "flows" | "becomes";
  label?: string;
}

export type MotionPreset =
  | "float"
  | "steam"
  | "explode"
  | "pathflow"
  | "pulse"
  | "reveal"
  | "orbit"
  | "sweep";

export interface VisualSpec {
  version: 1;
  archetype: "constellation" | "hotspots" | "explode" | "flow" | "loop" | "word";
  subject: string;
  alt: string; // required
  parts: VisualPart[];
  rootNode?: { label: string; pos: [number, number] }; // flow only
  links: VisualLink[];
  motion: {
    preset: MotionPreset;
    intensity: 1 | 2 | 3;
  };
  status: "ready" | "fallback";
}
