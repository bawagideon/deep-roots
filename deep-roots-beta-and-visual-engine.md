# Deep Roots: Beta Completion + Visual Discovery Engine

Repo: `bawagideon/deep-roots` (public). Baseline commit `6bac2b9`. Live: `deep-roots-neon.vercel.app`.
Read with the MVP Build Spec (v2), Phase 2 Spec (v3) and the mockups.

---

## 0. What is verified and what is not

| Claim | Status | Evidence |
| --- | --- | --- |
| `/welcome` shows an emoji (🍜) in a styled box, not an image or animation engine | Verified | Fetched the live page: the text node is the emoji |
| `/api/deepen` returns the generic catch-all error | Verified | Your response headers: body size 41 B equals `{"error":"Failed to deepen rabbit hole."}` exactly |
| The failure is fast (about 1 s), so it died early, not on a slow model call | Inferred | Status 500 in 1007 ms. A real card generation takes seconds. Likely causes: bad or missing key, dead model ID, request or schema validation, or quota check |
| Anthropic fallback IDs `claude-3-5-sonnet-20241022` and `claude-3-5-haiku-20241022` are dead | Verified in docs | Anthropic's deprecations page lists Sonnet 3.5 retired 28 Oct 2025 and Haiku 3.5 retired 19 Feb 2026. README still says "Claude 3.5 Sonnet & Haiku" |
| Supabase is installed but not connected | Partly verified | `@supabase/supabase-js` is in `package.json`; README says "Supabase PostgreSQL ready", not integrated |
| No automated tests | Verified | `package.json` has only `test:eval`; no Vitest, Jest or Playwright |
| Stack is Next 14, `@anthropic-ai/sdk` 0.33, `@google/generative-ai` | Verified | `package.json`. All three are behind; check current versions |
| Spoofable `x-user-id`, in-memory quota and entitlement Maps, unauthenticated `GET /api/report`, `NEXT_PUBLIC_` kill switch, SSRF redirect gap, simulated sign-in, local-only Pro flag, Wikipedia first-hit "evidence" | **Not verified by me** | Came from a second reviewer's reading of `src`. GitHub blocks automated access to the file browser, so I could not open those files. The agent must confirm each with the greps below before fixing |

Greps for the agent:

```bash
grep -rn "x-user-id" src
grep -rn "NEXT_PUBLIC_" src
grep -rn "new Map(" src/lib
grep -rn "localStorage" src | head -50
grep -rn "claude-3-5\|gemini-" src
grep -rn "dangerouslySetInnerHTML" src
```

---

## 1. The rabbit-hole 500

**Triage (30 minutes, before any refactor)**

1. Open Vercel, Logs, filter `/api/deepen`, time 09:46:54 GMT on 15 Oct 2026. Read the real exception.
2. Check production env vars: `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, and any model-ID variables. Compare names exactly with the code.
3. Replace retired Anthropic IDs. Confirm current IDs in Anthropic's docs; the deprecations page names `claude-sonnet-4-6` and `claude-haiku-4-5-20251001` as replacements, and newer models may be listed. Keep IDs in env vars, not code.
4. Replay the failing request body (3,882 bytes, from `/root/root-noodles`) against a local build and read the stack trace.

**Structural fixes (all in `/api/deepen`, then the same for `/api/scan`)**

- Validate the request with Zod before reserving quota.
- Send `{ parentRootId, target }`, not the whole parent card and depth. The server loads the parent and its true depth.
- One provider adapter shared by scan, deepen, evidence and visual jobs: timeout, bounded retry, next provider on any failure. A non-empty but invalid answer counts as a failure and triggers the next model.
- A response is only "successful" after JSON parse, schema validation and claim-reference integrity all pass. Do not repair by inventing claims.
- Error contract: `{ "error": { "code", "message", "retryable", "requestId" } }`. Codes: `BAD_REQUEST`, `UNAUTHENTICATED`, `QUOTA_EXCEEDED`, `DEPTH_LIMIT`, `PROVIDER_UNAVAILABLE`, `MODEL_OUTPUT_INVALID`, `INTERNAL`. Client shows a retry button only when `retryable` is true.
- Log requestId, provider, model, failure category, latency, never raw inputs.
- `GET /api/health` (admin only) sends a 1-token ping to every configured model and reports which are alive. Run it after every deploy.
- Release quota if the call failed.

**Tests:** success; malformed JSON; schema failure; dead model ID; missing key; timeout; rate limit; max depth; bad body; wrong owner.

---

## 2. How everything fits together

Two lanes, so the user never waits on enrichment.

```text
LANE 1: fast (user is waiting)
  input -> /api/scan
        -> auth (verified session) -> validate body -> reserve quota (atomic)
        -> provider adapter (primary model -> fallback) -> JSON -> Zod -> integrity checks
        -> save root + claims (owned by user) -> return { rootId, card }
  client renders the Roots Card immediately and draws a local "constellation" visual from the card (no network)

LANE 2: enrich (async, never blocks Lane 1)
  job A: evidence      per claim: retrieve -> store excerpt -> verify support -> status
  job B: visual spec   from the saved card (+ photo regions if a photo exists) -> validate -> store -> cache
  job C: link edges    adjudicate cross-scan links
  client polls or subscribes; each result upgrades the UI in place; failures leave Lane 1 intact
```

Rule: **Lane 1 must always produce a usable card. Every Lane 2 failure degrades to a labelled fallback, never to an error screen.**

Rabbit holes run the same pipeline: parent loaded from the database, child saved with `parent_id` and `depth`, then the same Lane 2 jobs.

---

## 3. The Visual Discovery Engine (the product differentiator)

### 3.1 The idea

**Animate the structure, not the picture.** A generated image of noodles cannot reliably animate its inner parts, and a different image for every scan is slow, costly and unaccountable. Instead, every card already contains a cast and a plot:

- Cast: the components (with lens colour, role, hidden fact).
- Plot: the relationships (contains, causes, flows, becomes) and the Root.

The engine turns that structure into motion. Every moving part is a component; every motion expresses a relationship from the card. Consequences:

1. The visual can never assert a fact the card does not contain.
2. It works for any input, including ideas with no physical form.
3. It is cheap, cacheable, accessible and fast.
4. **The visual is the navigation.** Tap a part to read its hidden fact and start a rabbit hole from it.

### 3.2 Archetypes (the "how does it work for every other thing" answer)

The model does not draw freely. It picks an archetype and fills slots from the card.

| Archetype | Use for | Motion | Needs | Ship |
| --- | --- | --- | --- | --- |
| `constellation` | Anything. Universal fallback | Parts drift in around a centre, links draw, the Root pulses last | The card only. Drawn locally, instantly | Beta |
| `hotspots` | The user's own photo | Scan sweep, pins pulse onto each component, tap to highlight | Normalised boxes per component from a vision model | Beta |
| `explode` | Physical objects with parts (food, device, tool, plant) | Parts separate along vectors, labels appear, then reassemble | Art for each part: shapes from a kit or AI-composed primitives | Beta, with 5 to 6 kits |
| `flow` | Processes and supply chains, how it is made | Dots travel along a path through stages | Stages derived from card layers | Beta |
| `loop` | Feedback systems (habits, prices, incentives) | Circular path, dots, plus and minus markers | Edges of type `cause` | v1.1 |
| `word` | Words, names, proverbs, etymology | Word splits into parts, origin chips slide in | Language layer | v1.1 |
| `timeline`, `map` | Origins and trade routes | Era reveal, flows from origin regions | Verified dates and places | v1.2 |

A single classifier call picks the archetype from the card. If confidence is low, use `constellation`.

### 3.3 VisualSpec (separate from the card facts)

```ts
type Primitive =
  | { t: "rect"; x: number; y: number; w: number; h: number; r?: number; fill: Token }
  | { t: "circle"; cx: number; cy: number; r: number; fill: Token }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill: Token }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; stroke: Token; sw?: number }
  | { t: "poly"; points: [number, number][]; fill: Token }
  | { t: "path"; d: string; fill?: Token; stroke?: Token; sw?: number }; // d: only M L C Q T A Z and numbers

// lens tokens colour labels, pins and outlines; material tokens colour the art itself
type Token = Lens | "text" | "muted" | "amber" | "ink" | "grain" | "tomato" | "leaf" | "cream" | "oil" | "glass";

type VisualSpec = {
  version: 1;
  archetype: "constellation" | "hotspots" | "explode" | "flow" | "loop" | "word";
  subject: string;
  alt: string;                          // required
  parts: {
    id: string;
    componentIndex: number;             // MUST point at a real component in the card
    label: string;                      // <= 3 words, derived from the component name
    lens: Lens;
    order: number;                      // reveal order
    box?: { x: number; y: number; w: number; h: number };   // 0..1, hotspots only
    art?: Primitive[];                  // explode only, 0..100 grid, <= 12 primitives per part
    explodeVector?: [number, number];   // explode only
    labelAt?: [number, number];         // explode only, on the 0..100 grid
    pos?: [number, number];             // flow only, on the 0..100 grid
  }[];
  rootNode?: { label: string; pos: [number, number] };   // flow only: the final node (the card title)
  links: { from: string; to: string; kind: "contains" | "causes" | "flows" | "becomes"; label?: string }[];
  motion: { preset: "float" | "steam" | "explode" | "pathflow" | "pulse" | "reveal" | "orbit" | "sweep"; intensity: 1 | 2 | 3 };
  status: "ready" | "fallback";
};
```

Integrity rules, checked server-side before saving:

- Every `componentIndex` exists; labels come from component names; no new text beyond them.
- Colours are tokens only (lens tokens plus a small fixed set of material tokens). No raw SVG strings, no external URLs, no `<foreignObject>`.
- Path data is parsed and rejected if it contains anything but allowed commands and numbers.
- Total primitives at most 60. Coordinates inside the grid.
- If any rule fails, store `status: "fallback"` with a constellation and log the reason.

**Working reference:** `visual-engine-prototype.html` implements the four renderers, the integrity check and the fallback from these specs. Port its renderers into a `VisualStage` React component and its `check()` into a server-side Zod plus integrity function.

### 3.4 Pipeline

1. After the card is saved, a background job sends the card (not the user's image) to a small, fast model with the archetype and primitive rules. Output is validated with Zod and the integrity rules.
2. For user photos, one vision call returns a normalised box per component. Boxes are validated (inside 0..1, non-degenerate). Photos stay private to the owner.
3. The spec is stored in `roots.visual` and, for non-photo subjects, cached in `visual_assets` by `sha256(archetype + normalised title + sorted component names + spec version)`. Photo-derived specs are never shared across users.
4. The client draws the constellation at once. When the spec arrives, it cross-fades into the archetype scene.
5. Failure at any step leaves the constellation in place. The card is never blocked.

### 3.5 Rendering rules

- React elements built from the validated spec. Never inject model output as HTML.
- Framer Motion plus SVG. Animate transform and opacity only. Pause when off-screen (`IntersectionObserver`).
- `prefers-reduced-motion`: show a static composition with a "step through" control.
- Touch: every part is a 44 px minimum target; tapping highlights the part, shows its hidden fact, offers "Dig deeper" that opens a rabbit hole for that component.
- Alt text from `alt`; parts are focusable with labels.
- Never reuse the welcome illustration for other subjects. The welcome sample is a labelled demo.

### 3.6 Quality and safety of visuals

- Build 6 hand-designed kits first (packaged food, bottle or can, phone or gadget, tool, plant, container) so the most common objects look professionally drawn. AI-composed primitives are the long tail.
- CI renders 20 golden specs headlessly and checks: at least 2 parts, no label overlaps (computed from bounding boxes), contrast, bounded size.
- Optional: a vision model grades each rendered PNG for "recognisable and readable"; below threshold falls back to constellation.
- Eval set: reuse the 30-input quality set; each must produce a spec that passes integrity checks.

### 3.7 Phases

| Phase | Scope | Effort |
| --- | --- | --- |
| V0 | Constellation from the card, `VisualStage` component, tap a part for fact plus rabbit hole, reduced motion | 1 day |
| V1 | `hotspots` on photos, `explode` with 6 kits, `flow`, spec job, cache, integrity checks | 2 to 3 days |
| V2 | `loop`, `word`, kit expansion, golden-spec CI | 2 days |
| V3 | Generated illustrations (licensed or generated, cached), layered art, shareable looping clip of the reveal for short-video sharing | After beta |

---

## 4. Identity, database and security

### 4.1 Database (Supabase Postgres is the source of truth; localStorage becomes an offline cache)

| Table | Key columns |
| --- | --- |
| `profiles` | id (= auth.uid), preferences jsonb, plan, created_at |
| `roots` | id, user_id, parent_id, depth, input_kind, title, card jsonb, visual jsonb, prompt_version, model, status, created_at |
| `claims` | id, root_id, local_id, text, claim_type (`fact`, `interpretation`, `open_question`), evidence_status (`supported`, `contradicted`, `insufficient`, `unverified`) |
| `claim_sources` | claim_id, title, url, retrieved_at, excerpt |
| `edges` | id, user_id, from_root, to_root, type, why, limits, created_by |
| `usage` | user_id, day, kind, count, primary key (user_id, day, kind) |
| `analysis_runs` | id, user_id, root_id, job, provider, model, latency_ms, status, error_code, est_cost_usd |
| `mistake_reports` | id, user_id, root_id, claim_id, text, status, created_at |
| `visual_assets` | cache_key, spec jsonb, archetype, hits |
| `shares` | token, snapshot jsonb, created_at |
| `subscriptions`, `billing_events` | Only when billing is built |

- Versioned SQL migrations in the repo.
- RLS on every table and the storage bucket: `user_id = auth.uid()`; `shares` readable by token only.
- Private bucket for photos; signed URLs; retention job.
- Service-role key only in server code.
- Guests get a real Supabase anonymous session. "Save your Tree" links an identity to the same user id; no copy step, no duplicate rows.
- Account deletion removes rows and storage objects.

**Atomic quota (replaces in-memory Maps)**

```sql
-- returns the new count, or no row when the limit is reached
insert into usage (user_id, day, kind, count)
values (:uid, current_date, :kind, 1)
on conflict (user_id, day, kind)
do update set count = usage.count + 1
where usage.count < :limit
returning count;
```

Call it from a server function before the model call. If the model call fails, decrement. Entitlements come from `profiles.plan` / `subscriptions` through one server function, never from the client.

### 4.2 Security work (confirm each with the greps in section 0)

| Risk | Fix |
| --- | --- |
| User identity from a header (`x-user-id`) | Use the verified Supabase session on the server. Delete all header-based identity |
| In-memory quota and entitlements | Database-backed, atomic (above) |
| Unprotected reports or admin | Server-side role check (`profiles.role = 'admin'`) on every admin and report-read route. Browser toggles never grant access |
| Kill switch readable from the client (`NEXT_PUBLIC_`) | Server-only `SCAN_KILL_SWITCH`, checked in route handlers |
| SSRF in link fetch | Validate every redirect hop; block private, loopback, link-local and mapped IPv6; pin the resolved IP; stream with a byte cap and timeout |
| Upload validation | Check magic bytes, not only declared MIME; cap size and dimensions |
| Request abuse on AI routes | Zod body schemas, size limits, per-user and per-IP rate limits, concurrency caps |
| Prompt injection | User content is data; schema-only output; no tools on user content; escape everything; no `dangerouslySetInnerHTML` |
| Fake states in the UI | Remove or label: "synced", "streaming", Pro activation by local flag, simulated Google or email sign-in |

---

## 5. Evidence grounding (real, not decorative)

A related URL is not support. Per claim:

1. **Retrieve** candidate sources for that claim (web search tool or a search API; Wikipedia only as one source among several).
2. **Store** title, URL, retrieval time and the passage used.
3. **Verify** with a small model: does the passage support, contradict or not address the claim? Output `supported`, `contradicted` or `insufficient`.
4. **Display** two separate things: claim type (fact, interpretation, open question) and evidence status. If retrieval fails, show `unverified`, never `supported`.
5. Never repair an invalid card by inventing placeholder claims. Run `validateRootsCardIntegrity()` on every card and child card; reject on failure.

Budget: verify the Root claim and up to 4 others per card, async, Haiku-class model.

---

## 6. Work packages (in order)

| # | Package | Contents | Est. |
| --- | --- | --- | --- |
| WP0 | Stop the bleeding | Logs, env vars, model IDs, error contract, `/api/health` | 0.5 day |
| WP1 | Reliability layer | Provider adapter, validation chain, retries, timeouts, request IDs, tests | 1 day |
| WP2 | Identity and database | Supabase client, migrations, RLS, anonymous auth, owned roots, atomic quota, localStorage as cache | 2 to 3 days |
| WP3 | Security hardening | Section 4.2 table, rate limits, upload and URL checks, admin auth | 1 day |
| WP4 | Evidence pipeline | Section 5, claim and source tables, UI statuses, report queue | 2 days |
| WP5 | Visual engine V0 and V1 | Section 3 | 3 to 4 days |
| WP6 | Honest UI | Remove or wire every fake state; billing OFF; sharing via server snapshots | 1 day |
| WP7 | Tests, CI, observability | Unit, API, Playwright at mobile and desktop widths, CI gate, Sentry, run logs | 2 days |
| WP8 | Beta operations | PWA icons, manifest, service worker, offline saved cards, legal pages checked against real data handling, invite flow, feedback widget | 1.5 days |

About 14 working days for one agent; WP4 and WP5 can run in parallel with WP6 after WP2. Dependencies: WP0 to WP1 to WP2 first; nothing user-facing ships to testers before WP2 and WP3.

---

## 7. Beta acceptance (all must pass on the deployed build)

- New user: onboard, scan text, photo and link, open a card, go two rabbit-hole levels deep, no unhandled error.
- Provider failure or invalid model output returns a typed, retryable response. No broken or fabricated cards.
- Roots, children, edges, settings, reports and progress survive refresh and a sign-in on a second device.
- User B cannot read or change user A's data; spoofing any header changes nothing.
- Daily limits hold under parallel requests and server restarts.
- Evidence status reflects retrieved passages. Retrieval failure shows `unverified`.
- Visual job failure leaves a working constellation. Reduced-motion users get a static scene.
- Every main screen has loading, empty, error and success states at mobile and desktop widths.
- CI runs lint, types, build, schema, integrity, API and browser tests; a failure blocks release.
- Billing is off, and the UI does not claim otherwise.

---

## 8. Agent directive

```text
Deep Roots: production beta completion. Repo bawagideon/deep-roots, baseline 6bac2b9.

Rules
- Inspect the repo first. Keep the visual identity. Confirm every finding in section 0 with the greps before changing code.
- Never claim something passes unless you ran it and read the result. Report each requirement as PASS, PARTIAL, FAIL or BLOCKED with evidence.
- Billing stays disabled. Remove or label any UI state that is not real (synced, streaming, verified, Pro active, simulated sign-in).
- No client-supplied identity, plan, depth or parent card is trusted. The server loads state from the database.
- Model IDs live in env vars and are verified against current provider docs; /api/health pings every model.

Order: WP0 (diagnose and fix the /api/deepen 500; fix dead model IDs; typed errors), WP1, WP2, WP3, then WP4 and WP5 and WP6, then WP7 and WP8.

Lane rules
- Lane 1 (scan or deepen) must always return a usable card. Evidence, visual and link jobs run async and degrade to labelled fallbacks.
- A model answer counts only after parse, Zod and claim-reference integrity pass; otherwise retry the next provider; never invent placeholder claims.

Visual Discovery Engine
- Build VisualSpec per section 3. Animate the card's structure; every part references a real component; colours are tokens; paths are validated; never inject model output as HTML.
- V0 first (constellation, tap a part, reduced motion), then V1 (hotspots, explode kits, flow). Never block the card on visuals. Never reuse the welcome illustration.

Done when: every item in section 7 passes on the deployed build, with a final route inventory, migration steps, env var list, rollback notes and known limitations.
```
