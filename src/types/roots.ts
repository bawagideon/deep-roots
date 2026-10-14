export type Lens = "language" | "culture" | "mind" | "money" | "tech" | "origins";

export interface ClaimSource {
  title: string;
  url: string;
  retrievedAt: string;
}

export interface Claim {
  id: string; // e.g. "c1"
  text: string; // one checkable statement <= 140 chars
  status: "established" | "interpretation" | "open_question";
  sources: ClaimSource[]; // empty initially, filled via Pass 2 / search
}

export interface CardLayer {
  name: string;
  lens?: Lens;
  summary: string;
  claimIds: string[];
}

export interface CardComponent {
  name: string;
  role: string;
  hiddenFact: string;
  claimIds: string[];
  layer?: string;
  lens?: Lens;
}

export interface NextQuestion {
  text: string;
  kind: "deepen" | "cause" | "compare" | "contradiction";
  targetComponent?: string;
}

export interface CardConcept {
  label: string;
  lens?: Lens;
}

export interface RootsCard {
  title: string;
  oneLiner: string;
  inputKind: "photo" | "screenshot" | "text" | "question" | "link";
  inputSummary: string;
  needsClarification?: string;
  root: {
    headline: string;
    body: string;
    claimIds: string[];
    lens?: Lens;
  };
  layers: CardLayer[];
  components: CardComponent[];
  lenses: Lens[];
  nextQuestions: NextQuestion[];
  concepts: CardConcept[];
  claims: Claim[];
  promptVersion?: string;
  modelUsed?: string;
}

export interface StoredRoot {
  id: string;
  userId?: string;
  parentId?: string | null;
  parentTitle?: string;
  depth: number;
  inputKind: "photo" | "screenshot" | "text" | "question" | "link";
  inputText?: string;
  imagePath?: string;
  title: string;
  card: RootsCard;
  lenses: Lens[];
  createdAt: string;
  isSeeded?: boolean;
}

export interface GraphEdge {
  id: string;
  fromRoot: string;
  toRoot: string;
  type: "parent" | "shared_concept" | "cause" | "contrast" | "unexpected";
  why: string;
  limits?: string;
  claimIds?: string[];
  createdAt: string;
}

export interface UserBadge {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  icon: "first_root" | "streak" | "all_lenses" | "rabbit_depth";
  progress?: string;
}

export type ReadingDepth = "simple" | "standard" | "deep";
export type ReadingTone = "playful" | "neutral";

export interface UserPreferences {
  lenses: Lens[];
  depth: ReadingDepth;
  language: string;
  tone: ReadingTone;
  openTo: "home" | "camera";
  timezone: string;
  notifications: {
    dailyRoot: { enabled: boolean; time: string };
    streakReminder: boolean;
    weeklyRecap: boolean;
    quietHours: { from: string; to: string };
  };
  privacy: {
    imageRetentionDays: 0 | 7 | 30 | 90;
    shareDefault: "off" | "ask";
    analytics: boolean;
  };
}

export interface Entitlements {
  plan: "free" | "pro";
  dailyScanLimit: number;
  maxRabbitDepth: number;
  allClaimsEvidence: boolean;
  fullUnexpectedConnections: boolean;
  canExportTree: boolean;
  unwatermarkedShares: boolean;
  personalizedDailyRoot: boolean;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email?: string;
  isAnonymous: boolean;
  plan: "free" | "pro";
  memberSince: string;
}

export interface UserStats {
  streak: number;
  bestStreak: number;
  lastActive: string;
  activeDays: string[];
  scansToday: number;
  scansLimit: number;
  selectedLenses: Lens[];
  lensCounts: Record<Lens, number>;
  totalRoots: number;
  totalRabbitHoles: number;
  totalLinks: number;
  badges: UserBadge[];
  preferences?: UserPreferences;
  profile?: UserProfile;
}
