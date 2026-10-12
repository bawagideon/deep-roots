# Deep Roots — MVP Build Spec

Oct 12, 2026 · @My king

## Verdict and thesis

Build it, but as "Cal AI for curiosity", not the 2024 everything-app: snap or paste anything, get the same-shaped breakdown every time, and watch your collection grow.

Your Cal AI read is right. Its pull is photo in, a fixed-shape answer out, tallied daily. Deep Roots needs three equivalents:

1. **A fixed output shape.** The Roots Card: the same sections every scan, so it is instantly recognisable and shareable, like a macro readout.
2. **A tally.** Six Lens rings (Language, Culture, Mind & Body, Money, Tech, Origins) fill as you scan, like macro rings.
3. **A daily reason to return.** Root of the Day plus a streak.

**The loop:** Scan → Root reveal → tap a Rabbit Hole (a component or question) → it becomes a child card → the Root Tree grows → rings and streak move → share the card.

**My honest caution:** "everything can be broken down" is true but does not retain people alone. The scan is the hook; the tally and the tree are the retention. Scan-anything apps already exist and churn on weekly paywalls, so the shape and the collection are the product.

**Decisions I made for you:** mobile-first web app (PWA), photo/text/link/screenshot input instead of live video, no login before the first scan, Claude vision for analysis.

## v2: what changed after the second review

The second review (ChatGPT) was right on most points. I adopted seven, adjusted one and disagree with one. Sections below are updated to match.

| Point raised | Call | What changed in this spec |
| --- | --- | --- |
| Layers should fit the input, not one template | Adopted with a guardrail | Fixed frame (title, Root, components, next questions) so cards stay recognisable and shareable. Variable layers: 2 to 5, chosen per input. A fully free-form card would lose the Cal AI mechanic |
| Lenses are navigation, not a constraint | Adopted | `lensWeights` (always filled) is replaced by `lenses`, listing only lenses with a stated link. One lens is valid. Never pad |
| Root Tree must be a real graph | Adopted | Typed edges with a written reason. Cross-scan links are proposed at save time |
| Evidence from day one | Adopted, built as a second pass | Claim ledger with status (established, interpretation, open question). Sources only when actually retrieved. The model's own confidence is removed |
| Unexpected Connection as the signature mechanic | Adopted, gated | Needs a corpus, so it unlocks after 5 saved roots and must pass a quality bar |
| Privacy, deletion, SSRF, server-side quotas, account recovery | Adopted | Added below |
| Do not pin Next.js 15 | Adopted | Current stable release |
| Check the model IDs | Partly | `claude-sonnet-5-5` and `claude-haiku-5-5` are the IDs Anthropic lists as current. Still confirm at build time and keep them in env vars |
| Do not build nine screens before validating | Disagree, with a gate | The mockups already exist and the build order is already loop-first. Added a hard quality gate at the end of Day 1: no Tree or Progress work until real scans pass the eval below |

**What neither review covered:** the product lives or dies on the quality of the first discovery, so the plan now builds a 30-input eval set before any UI polish.

## Competitive scan

Nobody owns "decompose anything into a consistent shape, then collect it". Scanners identify things; none build a personal map from them.

| Product | What it does | Why it matters for Deep Roots |
| --- | --- | --- |
| [Cal AI](https://neuronfeed.com/startups/cal-ai) | Photo of food becomes calories and macros; reported 10M+ users, acquired by MyFitnessPal in late 2025 | Proves the mechanic: one magic moment that is demo-able on short video, fixed-shape output, daily tally |
| [Google Lens / Circle to Search](https://www.search.google/ways-to-search/circle-to-search/) | Identify and search anything on screen or camera, AI Overviews | Free and everywhere, so "identify" alone is not a product. Our value is the structured breakdown and the collection |
| [Lens Scan](https://apps.apple.com/us/app/lens-scan-identify-everything/id6560107458), [AI Snap Identifier](https://apps.apple.com/app/id6479989668) | Scan anything, get an explanation; subscription-gated | Crowded, generic output, no memory between scans. This is the gap: shape plus collection |
| [Cal AI growth notes](https://superframeworks.com/case-study/cal-ai) | Influencer and short-form demo drove early growth | Design the Roots Card as a shareable 9:16 / 1:1 image from day one |

Figures are approximate, taken from search-result pages, not primary filings. Re-verify before using them in a pitch.

## MVP scope

Two days fits one loop done well: scan, reveal, deepen, collect, return. Everything else from the 2024 prompt waits.

**In (must ship)**

- Welcome with lens picker (3 taps, no signup)
- Home: Root of the Day, Lens rings, streak, recent roots, big Scan button
- Scan: camera/photo, type, paste link or text
- Analyzing state that streams the card in progressively
- Roots Card result with components, lenses, the Root, claim evidence, rabbit holes
- Rabbit hole deepen: child card from a component or question
- Root Tree: simple radial or list-tree of your cards
- Progress: rings, streak, counts, badges (3)
- Share card: server-rendered image
- Anonymous auth, daily scan limit (5 free), basic error and empty states

**Out (cut from the 2024 plan, in this order of regret)**

| Cut | Why | When |
| --- | --- | --- |
| AR / WebXR | Needs hardware, huge effort, photo scan gives 90% of the magic | Never for v1 |
| Community knowledge base, voting, expert Q&A | Needs users first and moderation | After 1,000 active users |
| Documentaries and podcasts | Content production, not software | Later, AI-narrated audio per card is the cheap version |
| User-made discovery paths | Your Root Tree already is a personal path | v1.1 as shareable trees |
| Live video scan | Cost and latency | v1.2 |
| Journal | Rabbit-hole notes cover it | v1.1 |
| Payments | Validate the loop first | Week 2 |

## Core model: Roots Card and Lenses

Every input returns one Roots Card with a fixed frame and variable layers. Six Lenses are the tally categories, the equivalent of Cal AI's macros.

| Lens | Covers (from your 2024 list) | Colour token |
| --- | --- | --- |
| Language | words, names, origins of terms | `--lens-language` #7FB8FF |
| Culture | family, ritual, everyday tasks, food, customs | `--lens-culture` #FF9B7A |
| Mind & Body | physiology, psychology, habits, trends | `--lens-mind` #D4A5FF |
| Money | economics, trade, pricing, supply chains | `--lens-money` #9BE564 |
| Tech | ICT, materials, engineering, human potential | `--lens-tech` #5FE0E8 |
| Origins | religion, history, evolution | `--lens-origins` #FF86B8 |

```ts
type Lens = "language" | "culture" | "mind" | "money" | "tech" | "origins";

type Claim = {
  id: string;                    // "c1"
  text: string;                  // one checkable statement, <= 140 chars
  status: "established" | "interpretation" | "open_question";
  sources: { title: string; url: string; retrievedAt: string }[];  // empty after pass 1, never invented
};

type RootsCard = {
  title: string;
  oneLiner: string;              // <= 120 chars
  inputKind: "photo" | "screenshot" | "text" | "question" | "link";
  inputSummary: string;          // what the model believes it saw; shown so users can correct it
  needsClarification?: string;   // set when the input is ambiguous; no card is saved
  root: { headline: string; body: string; claimIds: string[] };  // the hidden layer, cites >= 1 claim
  layers: {                      // 2 to 5, chosen for THIS input (e.g. Biology, Supply chain, Etymology)
    name: string; lens?: Lens; summary: string; claimIds: string[];
  }[];
  components: {                  // 3 to 6
    name: string; role: string; hiddenFact: string; claimIds: string[]; layer?: string;
  }[];
  lenses: Lens[];                // ONLY lenses with a real, stated link. 1 to 6. Omit the rest
  nextQuestions: {               // exactly 3
    text: string; kind: "deepen" | "cause" | "compare" | "contradiction"; targetComponent?: string;
  }[];
  concepts: { label: string; lens?: Lens }[];   // 2 to 5, used to link cards across scans
  claims: Claim[];
};
```

Rules the prompt must enforce: no invented statistics, dates or quotes; a folk etymology or contested story is `interpretation`, never `established`; unresolved questions are `open_question`; never pad a lens or a layer to fill space; if the input is unclear, return `needsClarification` instead of guessing. For private inputs (receipts, chats, IDs) analyse structure and context only and never copy names, account numbers or contact details into any saved field.

**Rings measure exploration, not intelligence.** A ring counts the distinct cards saved this week that touch that lens through `lenses`. Full at 10. Copy says "explored", never "score" or "level".

## Decomposition Engine

Every scan runs the same five stages. The card frame is fixed; what fills it is decided per input.

1. **Capture.** Photo, screenshot, text or a question. Detect the type and pick an analysis strategy. Documents and URLs come after the core works.
2. **Decompose.** Identify parts, processes, causes, context and the hidden systems behind the input. Choose 2 to 5 layers that actually matter for it.
3. **Reveal.** One surprising, checkable discovery (the Root), backed by at least one claim.
4. **Connect.** Extract concepts, then link to earlier cards with a written reason (see Graph).
5. **Choose the next rabbit hole.** Three questions of different kinds: deepen a component, trace a cause, compare two concepts, or test a contradiction.

**Two passes, so evidence never slows the first reveal**

- **Pass 1 (streamed, about 3 to 6 seconds).** The scan model returns the card. All claims carry a status; `sources` is empty. The card shows a "Checking sources" chip.
- **Pass 2 (async, after the card renders).** For the Root claim and up to 4 other `established` claims, a Haiku call with web search finds sources. It attaches title, URL and retrieval time, or downgrades the claim to `interpretation` when nothing supports it. The client updates live or by polling.
- The Evidence section shows each claim with a status badge and its sources. Every claim has Report a mistake. Source links are shown only when retrieved, never generated.

**Unexpected Connection (signature mechanic).** When a new card links to an older card in a different lens and the adjudicator rates the link surprising and well supported, save an `unexpected` edge and show a banner on the card with the reason and its limits (when the link does not hold). Locked until the user has 5 saved roots. If nothing clears the bar, show nothing.

## Screens and flows

Nine screens, mobile-first at 390 wide, matching the [mockup canvas](https://claude.ai/artifact/G6uxvjVdWnrSSYN63NBLsS), which also has a design-tokens board. Bottom tab bar: Home, Scan (centre button), Tree. Progress opens from the streak pill on Home. Tap targets 44px minimum. Dark theme only for v1.

| # | Screen | Route | Contains | States to build |
| --- | --- | --- | --- | --- |
| 1 | Welcome | `/welcome` | One-line promise, example Roots Card peek, pick 3 of 6 Lenses, Start button | Shown once; skip allowed |
| 2 | Home | `/` | Greeting and streak, Root of the Day card, six Lens rings with weekly points, Recent roots list, Scan button | Empty (no roots yet shows a sample), loaded, scan-limit reached |
| 3 | Scan | `/scan` | Viewfinder (file input with capture), gallery button, tabs Photo / Type / Link, hint chips, shutter | Permission denied falls back to upload; image too large resized client-side to 1280px JPEG |
| 4 | Analyzing | `/scan/[id]` | Captured image, progress steps, Root and components streaming in as skeletons that fill | Streaming, failed with retry, needs clarification |
| 5 | Roots Card | `/root/[id]` | Image header, title and one-liner, **The Root** panel (amber), components list, Lens bars, connections chips, rabbit holes, Evidence section with claim badges, Share and Save | Full card; sticky bottom actions |
| 6 | Rabbit hole | `/root/[id]` as sheet | A component or question deepened into a child card with a breadcrumb back to the parent | Streaming, depth limit 3 for v1 |
| 7 | Root Tree | `/tree` | Radial graph (d3-force) of cards and connections coloured by Lens, filter chips, tap node opens card, list view toggle | Empty, under 5 nodes shows ghost nodes to fill |
| 8 | Progress | `/me` | Streak with 7-day strip, Lens rings (exploration, not score), counts (roots, rabbit holes, connections), three badges, daily limit meter | Locked and unlocked badges |
| 9 | Share card | `/root/[id]/share` | 1080×1350 image: title, the Root, three components, Lens bars, watermark and app name; Share and Save image | Rendered server-side via `@vercel/og` |

**Primary flow:** Welcome → Home → Scan → Analyzing → Roots Card → Rabbit hole → Roots Card → Tree → Share.

**Return flow:** Notification or open → Home → Root of the Day → Scan.

Micro-interactions that carry the loop: the Root panel reveals last with a short amber glow, a Lens ring animates when points land, a new node pulses into the Tree, and streak flames only after the first card of the day.

## Tech stack, data and API

One Next.js app on Vercel, Supabase for auth and data, Claude for analysis. No separate backend.

| Layer | Choice | Note |
| --- | --- | --- |
| App | Current stable Next.js (App Router), TypeScript, Tailwind, shadcn/ui, Framer Motion | PWA manifest so it installs on a phone |
| AI | Anthropic API via Vercel AI SDK `streamObject` + zod | Main scan: `claude-sonnet-5-5` (vision). Rabbit holes and daily root: `claude-haiku-5-5`. Confirm IDs and pricing in the Anthropic docs at build time and keep IDs in env vars |
| Data | Supabase Postgres, Auth (anonymous sign-in, upgrade to Google later), Storage bucket `scans` | Row Level Security on every table |
| Graph | `d3-force` in an SVG | No heavy graph library |
| Share image | `@vercel/og` route | 1080×1350 |
| Rate limit | Upstash Redis or a `usage` table | 5 scans per user per day, enforced server-side |

**Request flow**

```text
Client resize image (1280px JPEG, strip EXIF)
  -> POST /api/scan (multipart: image | text | url)
  -> auth + daily limit check
  -> Claude (system prompt + image) streamObject(RootsCardSchema)
  -> stream partial object to client (cards fills in live)
  -> on finish: upload image, insert row in roots, update streak + weekly lens points
  -> client navigates to /root/[id]
```

**Data model (Postgres)**

| Table | Columns |
| --- | --- |
| `profiles` | id (= auth.uid), lenses text\[\], streak int, best\_streak int, last\_active date, created\_at |
| `roots` | id uuid, user\_id, parent\_id uuid null, depth int, input\_kind, input\_text, image\_path, title, card jsonb, lenses text\[\], created\_at |
| `usage` | user\_id, day date, scans int, primary key (user\_id, day) |
| `daily_roots` | day date primary key, card jsonb. Seed 14 days by hand or generate once with a script |

Graph edges are stored explicitly in the `edges` and `concepts` tables below. Do not infer connections from shared text labels alone.

**Endpoints**

- `POST /api/scan` streams a RootsCard and saves it
- `POST /api/deepen` with `{rootId, kind: "component" | "question", index}` streams a child card, max depth 3
- `GET /api/roots`, `GET /api/roots/[id]`, `GET /api/me` (streak, rings, counts)
- `GET /api/og/root/[id]` share image

**System prompt for `/api/scan` (starting point)**

```text
You are Deep Roots. For any input, return a Roots Card as JSON matching the schema.
Explain what the thing is made of and the hidden systems behind it: its parts, origin of its name,
the culture and money around it, the mind and body angle, and where it came from.
Rules: never invent statistics, dates or quotes. If unsure, say so and set confidence low.
One fact per component. The Root must be surprising and checkable. Keep every field within its limit.
If the image contains people, describe the scene and objects only; never identify anyone.
Write for a curious 16-year-old: plain words, short sentences, no jargon without a gloss.
```

**Safety and cost:** server-only API key; 4 MB upload cap; reject non-image MIME types; block private IPs and cap size and time when fetching a pasted link; log tokens per scan from day one.

## Graph, privacy, accounts and cost (v2)

**Graph tables**

| Table | Columns |
| --- | --- |
| `edges` | id, user\_id, from\_root, to\_root, type (`parent`, `shared_concept`, `cause`, `contrast`, `unexpected`), why text (<= 140 chars), limits text null, claim\_ids text\[\], created\_by (`model` or `user`), created\_at |
| `concepts` | id, user\_id, label\_norm, lens null |
| `root_concepts` | root\_id, concept\_id |
| `analysis_runs` | id, user\_id, root\_id, pass (1 or 2), model, input\_tokens, output\_tokens, latency\_ms, status, est\_cost\_usd, created\_at |
| `shares` | token, root\_id, snapshot jsonb, created\_at. Public snapshots only; never links to the private image |

**Cross-scan linking (runs on save)**

1. Normalise the card's concepts and look up existing concepts for that user by label.
2. Take up to 10 candidate cards. In v1 use label match; in v1.1 add vector similarity.
3. A Haiku adjudicator receives the new card and the candidates, and returns only links with a real relationship: type, a one-sentence `why`, and `limits`.
4. Returning no links is a valid and common result. Do not force connections.

List view ships first; the graph is the same data drawn with `d3-force`.

**Privacy**

- First-use notice before upload: avoid IDs, bank details and private chats; crop or blur names.
- Strip EXIF on the client. Store images in a private bucket with signed URLs. Default retention for original images is 30 days; extracted cards stay until the user deletes them.
- Controls: delete one root, delete all my data, toggle image retention.
- Sharing is opt-in and creates a public snapshot (title, Root, a few components). Receipts and chat screenshots default to sharing off.

**Accounts.** Anonymous Supabase sign-in for the first scan. After the third saved root, prompt "Save your Tree" and link an email or Google identity to the same user so nothing is lost on a new device.

**Quotas and cost.** Increment the `usage` row in a transaction before calling the model; reject at the limit. Add an IP-level rate limit. Log every model call to `analysis_runs`. Cache identical text inputs for 24 hours. A client-side counter is display only.

**Fetching links.** Server-side fetch only for http(s); resolve DNS and block private, loopback and link-local ranges; cap redirects, size and time; send no user cookies.

## Two-day build plan

Day 1 ends with a working scan-to-card loop on a phone. Day 2 adds the tally, the tree, sharing and polish. Build in this order; do not start a block until the previous one runs.

**Day 1: the loop**

- [ ] Block 1 (1h): inspect any existing repo and keep working code; otherwise scaffold current stable Next.js, Tailwind, shadcn, tokens from the mockups, PWA manifest, Supabase tables, RLS, anonymous auth
- [ ] Block 2 (3h, quality gate): v2 zod schema, `/api/scan` with `streamObject`, server-side validation before save, the 30-input eval set, prompt tuning until the bar below is met
- [ ] Block 3 (2h): capture for photo, screenshot, text and question; client resize and EXIF strip; privacy notice; Analyzing screen with streaming fill
- [ ] Block 4 (2h): Roots Card with Evidence section (claim badges), persistence, reload from the database
- [ ] Block 5 (1h): Home with recent roots and empty state, tab bar, Welcome
- [ ] Block 6 (1h): deploy, test on a real phone, confirm saved roots survive a refresh. If the Block 2 bar is not met, fix the prompt before starting Day 2

**Day 2: the retention**

- [ ] Block 7 (2h): rabbit holes with the three question kinds, breadcrumbs, depth history, depth limit 3
- [ ] Block 8 (2h): evidence pass 2 with web search, source chips, status downgrade, Report a mistake
- [ ] Block 9 (2h): `edges` and `concepts`, cross-scan linking on save, Root Tree list view first, graph second
- [ ] Block 10 (1h): Daily Root (seeded cards labelled as seeded), exploration rings, streak
- [ ] Block 11 (1h): opt-in share cards and the public snapshot route
- [ ] Block 12 (2h): server-side quotas, usage logging, delete controls, "Save your Tree" account linking, error and empty states, real-device pass, final deploy

**Acceptance criteria**

- A first-time user reaches a Roots Card in under 30 seconds from opening the link, with no signup
- First visible content streams in under 3 seconds after the photo is sent
- Every card passes the schema; malformed output retries once, then shows the retry state
- Rings and streak update the moment a card is saved
- Share image renders correctly on WhatsApp and Instagram previews

**Risks and fallbacks**

| Risk | Fallback |
| --- | --- |
| Hallucinated facts hurt trust | Claim status and sources, "report a mistake" link on every card, claim-level evidence pass in v1 |
| Cost per scan | Haiku for follow-ups, resize images, 5 scans per day cap, log tokens |
| Cards feel generic | Spend the first 2 hours of Block 2 on the prompt; the Root must be genuinely surprising |
| Camera permissions on some browsers | File input with `capture` always works; gallery upload is the fallback |
| Day 2 slips | Cut in this order: graph view (ship the list), badges, Unexpected Connection, Root of the Day. Never cut evidence, persistence or the quality gate |

## Quality gate and what to measure

The product is only as good as its first discovery, so test that before building more.

**Eval set (Block 2).** Collect 30 real inputs: 10 everyday objects, 6 food or packaging, 5 screenshots (no private data), 5 proverbs or phrases, 4 questions. Run each through `/api/scan` and rate every card on four yes/no questions: correct, specific to this input, checkable, and "I didn't know that". Two people rate; disagreements are discussed.

**Gate:** at least 21 of 30 cards must score yes on all four before Day 2 starts. This bar is a starting hypothesis; adjust it after the first run, but keep a bar.

**Product metrics to log from the first user** (hypotheses to calibrate, not benchmarks)

| Metric | What it tells you |
| --- | --- |
| Time to first card | Whether the magic moment is fast enough |
| Rabbit-hole tap rate per card | Whether the loop pulls people deeper |
| Save rate | Whether cards are worth keeping |
| Cards per active day | Habit strength |
| Day 1 and day 7 return | Whether the tally and daily Root bring people back |
| Report-a-mistake rate | Trust and accuracy |
| Cost per card (from `analysis_runs`) | Whether the free tier is affordable |

## Agent directive

Paste this to the coding agent together with this spec and the mockup canvas.

```text
Build Deep Roots, a mobile-first web app: capture anything, see its hidden components, and grow a personal map of how the world works.

Read the attached Build Spec and mockups first. They are references, not orders: review their technical assumptions and fix what is wrong. Inspect the existing repository, keep working code, list implementation risks and a short task plan, then start building. Do not stop at another spec or a static prototype.

Rules
1. Inputs: photo, screenshot, text, question. URLs and documents only after the core works.
2. Every input goes through the Decomposition Engine and returns a Roots Card in the v2 schema: fixed frame, 2 to 5 layers chosen per input, a Root, components, only the lenses that truly apply, claims with status, three next questions.
3. Never invent a lens, layer or connection to fill space. Empty is valid.
4. Pass 1 streams the card. Pass 2 attaches sources or downgrades unsupported claims. Show sources only if retrieved.
5. Validate every model response against the zod schema server-side before saving. Handle interrupted streams and malformed output with a retry state.
6. Graph edges are explicit rows with a type and a written reason. Linking may return nothing.
7. Keep keys server-side. Enforce quotas, upload limits, MIME checks, SSRF protection and RLS on the server. Log tokens, latency, status and cost for every model call.
8. Privacy: pre-upload notice, EXIF stripped, private storage, retention setting, delete one or all, opt-in sharing.
9. Verify model IDs against current Anthropic docs; keep them in env vars. Use current stable Next.js.
10. No mock data pretending to be real. Label seeded content as seeded.

Order: Day 1 quality gate (eval set passes) before any Tree, Progress or share work. Day 2 follows the spec's blocks 7 to 12. Cut in this order: graph view (ship list), badges, Unexpected Connection, Daily Root. Never cut evidence, persistence or the gate.

Done when: a new user submits an image or text, gets a correct and genuinely surprising card, deepens it, saves it, reloads and finds it in the Tree, and the main journey works on a real phone.
```
