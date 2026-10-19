# Deep Roots v4: Clerk, Flow, Motion and Launch

Read with the Beta Completion spec. This file replaces earlier assumptions about Supabase Auth and anonymous sessions.

---

## 0. Your questions, answered

**Is Clerk what gives each user their own private data?** Half of it. Clerk is identity: sign-up, sign-in, sessions, sign-out, social login, the user menu and account settings. It does not isolate data. Privacy comes from the database: every row carries the Clerk user ID and the database refuses to return anyone else's rows. We use Supabase Postgres with Row Level Security keyed to Clerk's user ID. Clerk proves who you are; RLS makes "no user can see another's data" true even if our app code has a bug.

**Does sign-out redirect to login?** Yes. Clerk's `afterSignOutUrl` sends the user to the page you choose; `clerkMiddleware` sends signed-out visitors away from protected routes. We send sign-out to `/welcome`, and `/welcome` has a Sign in button, so the user lands on a clean entry page.

**Go with Clerk?** Yes. One caveat: Clerk's "Go to prod" step needs a domain you own (a `*.vercel.app` address is not enough) and your own Google sign-in credentials. Buy the domain before launch week. Check Clerk's current free-tier limits and pricing before you plan for virality.

---

## 1. Auth and data isolation

### 1.1 How the pieces connect

```text
Browser (Clerk session cookie)
  -> Next.js middleware (clerkMiddleware): blocks signed-out users from protected routes
  -> Route handler: const { userId } = await auth()   // verified identity, never a header
  -> Supabase client built with the Clerk session token (auth().getToken())
  -> Postgres RLS: (select auth.jwt()->>'sub') = user_id
```

Setup, in order:

1. In the Clerk dashboard, use the Next.js "Agent setup" prompt shown on your Overview page. Give that prompt to your coding agent together with this spec.
2. In Clerk, open the Supabase integration and activate it. In Supabase, add Clerk under Authentication, third-party auth. This is the current native integration; the older "Supabase JWT template" was deprecated by Clerk on 1 April 2025, so do not use it.
3. Use Supabase's own third-party auth route; do not share the Supabase JWT secret with Clerk.

### 1.2 Database rules (replace the earlier `auth.uid()` and `uuid` assumptions)

Clerk IDs look like `user_2abc...`, which are text, not UUIDs, and `auth.uid()` will not work. Use:

```sql
create table roots (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default auth.jwt()->>'sub',
  parent_id uuid references roots(id) on delete cascade,
  depth int not null default 0,
  title text not null,
  card jsonb not null,
  visual jsonb,
  created_at timestamptz not null default now()
);
alter table roots enable row level security;

create policy "own rows" on roots
  for all to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);
```

Apply the same `user_id text` plus policy pattern to `claims`, `claim_sources`, `edges`, `usage`, `analysis_runs`, `mistake_reports`, `profiles` and every storage path (`{user_id}/...`).

- `shares` is the only world-readable table. It stores a published snapshot (title, Root, a few components, no photo, no notes) and is selectable by token.
- The service-role key is used only by webhooks and background jobs, never in a user request.
- Admin access: set `publicMetadata.role = "admin"` on your Clerk user and check it server-side from the session claims. Never from a browser toggle.
- Test it: sign in as two users and prove user B gets zero rows and cannot write user A's rows, including through direct Supabase calls.

### 1.3 Webhooks

`POST /api/webhooks/clerk` (public route, signature verified):

- `user.created`: create the `profiles` row with default preferences.
- `user.updated`: sync display name and avatar.
- `user.deleted`: delete every row and storage object for that `user_id`. This is how "Delete my account" really deletes data.

### 1.4 Guest first scan (no signup wall, but no free-for-all)

Clerk does not provide anonymous sessions the way Supabase does, so guests work like this:

1. `/try` is public. One guest scan, processed by `/api/guest-scan`, protected by Cloudflare Turnstile, an IP rate limit and a global daily guest budget.
2. The card is returned to the browser and kept in IndexedDB. Nothing is saved server-side for guests.
3. "Save your Tree" opens Clerk sign-up. After sign-in, the app posts the stored card to `/api/claim-guest-root`, which validates it with the same schema and saves it under the new `user_id`.
4. The user lands on Home with a "Your first root is planted" moment (see Home animations).

### 1.5 Sign-out must be clean

- `afterSignOutUrl="/welcome"` on `ClerkProvider`.
- On sign-out: clear IndexedDB, Cache Storage entries holding user data, in-memory stores and any local preferences tied to that user. A shared phone must never show the previous user's roots.
- The service worker never caches authenticated API responses, `/sign-in`, `/sign-up` or Clerk paths.

### 1.6 Clerk theming

Style Clerk's `<SignIn/>`, `<SignUp/>` and `<UserButton/>` with the `appearance` prop so they match the dark amber design: background `#0E1411`, surfaces `#151D18`, primary `#FFC857` with dark text, Bricolage Grotesque headings, rounded 16 px buttons. Enable Google sign-in plus email code (passwordless) for the least friction on phones.

---

## 2. Route map and flows

### 2.1 Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/welcome` | Public | Landing and onboarding hero. Signed-in users are redirected to `/` |
| `/try` | Public (guest) | One free scan, result card, "Save your Tree" |
| `/sign-in/[[...sign-in]]` | Public | Clerk sign-in |
| `/sign-up/[[...sign-up]]` | Public | Clerk sign-up |
| `/onboarding` | Signed in, first run | Pick 3 lenses, depth and language, then straight to the first scan |
| `/` | Signed in | Home: Root of the Day, rings, streak, recent roots |
| `/scan` | Signed in | Capture: photo, type, link, paste, drop |
| `/scan/[id]` | Signed in | Analyzing and streaming reveal |
| `/root/[id]` | Owner | Roots Card, evidence, rabbit holes |
| `/tree` | Signed in | Root Tree: graph, list, time-lapse |
| `/me` | Signed in | Progress: streak, rings, badges, canopy |
| `/profile` | Signed in | Profile (Clerk `UserProfile` embedded for account, security and sign-out) |
| `/settings`, `/preferences` | Signed in | Settings and preferences |
| `/upgrade` | Signed in | Paywall |
| `/r/[slug]` | Public | Published snapshot of a root: SEO page with dynamic share image, "Guess the Root" mode, "Scan yours" CTA |
| `/invite/[code]` | Public | Referral landing |
| `/terms`, `/privacy`, `/ai-disclosure` | Public | Legal |
| `/admin` | Admin role | Usage, cost, reports, flags |
| `/offline` | Public | Offline fallback page |

### 2.2 Flows

**New visitor to first root**

```text
Ad / shared link -> /r/[slug] or /welcome
  -> "Try it now" -> /try -> guest scan -> Roots Card (limited)
  -> "Save your Tree" -> /sign-up (Clerk) -> /onboarding (3 lenses, 2 taps)
  -> / (first root planted animation) -> first rabbit hole prompt -> second scan
  -> after 2nd saved root: install prompt, then notification pre-prompt
```

**Returning user**

```text
Open app (PWA) -> / or /scan (preference "open to camera")
  -> notification tap -> /root/[daily] (deep link)
  -> if session expired: /sign-in with redirect back to the exact page
```

**Sign out**

```text
/profile -> Sign out -> roots retract animation -> local data cleared -> /welcome
```

**Paywall**

```text
limit hit or Pro lock -> sheet -> /upgrade -> checkout -> return -> bloom -> back to where they were
```

**Share**

```text
Roots Card -> Share -> choose format (foil card, reveal video, guess-the-root link)
  -> OS share sheet -> friend opens /r/[slug] -> guess -> reveal -> /try
```

### 2.3 Middleware sketch

Public matcher: `/welcome`, `/try`, `/sign-in(.*)`, `/sign-up(.*)`, `/r/(.*)`, `/invite/(.*)`, `/terms`, `/privacy`, `/ai-disclosure`, `/offline`, `/api/guest-scan`, `/api/webhooks/(.*)`, manifest, icons and the service worker file. Everything else calls `auth.protect()`. Signed-in users hitting `/welcome` redirect to `/`.

---

## 3. Device and PWA experience

### 3.1 One product, five layouts

| Device | Layout | Interaction notes |
| --- | --- | --- |
| Phone | Bottom tab bar (Home, Scan, Tree), full-screen cards, thumb-zone actions, bottom sheets | Swipe back, pull to refresh, long-press scan for radial menu, haptics on Android |
| Large phone and small tablet | Same as phone, wider cards, two-column component grid | Landscape keeps the tab bar on the left |
| Tablet | Navigation rail on the left; Root Card with the visual on the left and details on the right | Pointer and touch both work; hover states are never required |
| Desktop | Sidebar, top command bar, split view: list or Tree on the left, open card on the right | Keyboard shortcuts, drag and drop, paste screenshots, `Cmd/Ctrl+K` command palette, right-click menu on roots |
| Foldable and ultrawide | Max content width 1200; two-pane when the viewport is 700 px or wider | Respect safe areas and fold posture where available |

On desktop, show "Open on your phone" with a QR code in the scan area; capture there is by upload, paste, drag, or webcam.

### 3.2 PWA specifics

- Manifest: name, short_name, icons 192, 512 and maskable, `display: standalone`, `theme_color #0E1411`, `start_url: /?source=pwa`, shortcuts (Scan, Daily Root, Tree), `share_target` (images and text into `/scan`), screenshots for the install dialog.
- Service worker: cache the app shell and static assets; stale-while-revalidate for saved roots in IndexedDB; offline page with the saved Tree readable; queue nothing silently; never cache authenticated API responses.
- Install: Android install prompt after the second saved root; iOS how-to sheet (Share, Add to Home Screen). Detect `display-mode: standalone`.
- App badge for the unseen Daily Root where supported.
- Update flow: when a new version is ready show "New roots available. Refresh" toast, never reload mid-scan.
- Safe areas: `env(safe-area-inset-*)` on tab bar, sheets and full-screen scenes. Remove `user-scalable=no`.
- Back button and swipe gestures behave natively; sheets close on back.

### 3.3 Perfect UX rules

- First card in under 30 seconds from opening a shared link; first content streams within about 3 seconds of sending.
- Every tap gets visible feedback within 100 ms; any wait over 400 ms gets a purposeful animation, never a bare spinner.
- One primary action per screen. Thumb reach for anything frequent.
- Everything has loading, empty, error, offline and success states, each with a designed animation (see section 5).
- Accessibility: contrast checked, 44 px targets, focus rings, screen-reader labels on every part of the visual engine, `prefers-reduced-motion` honoured everywhere, text scalable, no information by colour alone (lens names always shown).
- Keyboard: `/` focus input, `S` scan, `T` Tree, `G` then `H` Home, `?` shortcut sheet, `Esc` closes sheets.
- Language and tone preferences apply to the generated text and the interface labels where translated.

---

## 4. Motion language: "light underground"

The brand idea: **light travels along roots.** The app is the dark soil; amber is the light of discovery; lens colours are the threads it lights up. Every animation obeys four rules.

1. **Grow from the touch.** Things unfold from where the user tapped, not from nowhere.
2. **Light follows the line.** Connections draw themselves and a pulse of amber travels along them.
3. **Depth is real.** Going into a rabbit hole moves you down through layers; going back surfaces you.
4. **Discovery has weight.** The big moments (Root reveal, level up, link found) get a pause, a glow and a haptic. Everything else stays quick.

### 4.1 Motion tokens

| Token | Value | Use |
| --- | --- | --- |
| `--dur-tap` | 120 ms | Press feedback |
| `--dur-ui` | 240 ms | Chips, toggles, tabs |
| `--dur-scene` | 420 ms | Screen and sheet transitions |
| `--dur-reveal` | 700 to 1200 ms | Root reveal, level up, bloom |
| `--dur-ambient` | 3 to 8 s | Breathing, drift, sap flow |
| `--ease-grow` | `cubic-bezier(.16, 1, .3, 1)` | Things growing in |
| `--ease-settle` | spring, stiffness 260, damping 24 | Drags, sheets, snaps |
| `--ease-soft` | `cubic-bezier(.4, 0, .2, 1)` | Fades and colour |
| Stagger | 40 to 70 ms per item, cap 8 items | Lists and chips |

### 4.2 Technique and performance rules

- Framer Motion (already installed) for UI and layout; SVG path animation for roots; one `<canvas>` layer for particles; View Transitions API for screen changes where supported, with Framer Motion layout animations as the fallback; CSS scroll-driven animation where supported, with an `IntersectionObserver` fallback. Use Rive or Lottie only for the few hand-authored hero pieces (seed, canopy, bloom).
- Animate `transform` and `opacity` only. No layout-thrashing properties. Particle systems capped (about 60 on phones, 150 on desktop), paused when the tab is hidden or the element is off-screen.
- Low-end devices: read `navigator.hardwareConcurrency` and `deviceMemory` where available and drop to the "light" tier (no particles, no blur, fewer ambient loops). A "Battery saver" or "Reduce motion" setting forces it.
- `prefers-reduced-motion`: replace movement with fades, hold the glow, show static compositions with step-through controls. Never remove information.
- Budget: scene transitions finish in under 450 ms; ambient loops use under 2% CPU on a mid-range phone; test on a low-end Android phone.

---

## 5. Animation catalogue by screen

Format: **Name**, trigger, what happens. Every screen has a signature moment, a feedback animation, an ambient life and a state animation (loading, empty, error).

### Global (on every screen)

- **Sprout Tab:** the active tab marker is a small sprout that slides to the new tab on a spring and grows a leaf when it lands.
- **Soil Slide:** moving between sibling screens slides at 30% parallax so the background moves slower than the content.
- **Dive and Surface:** going deeper (card to rabbit hole) zooms into the tapped element while background layers drift up and darken one step; going back reverses it.
- **Mycelium Shimmer:** all skeletons are thin lines of light drifting along root-like paths, not grey bars.
- **Press Bloom:** every button on press gets a soft amber bloom from the finger position and a 2% scale-down; on release it springs back.
- **Leaf Toast:** toasts unfold from the bottom like a leaf, hold, then fold away.
- **Root Cursor (desktop):** a faint amber trail follows the pointer and fades like a root tip; buttons are magnetic within 12 px.
- **Ambient Drift:** a very slow layer of dust motes behind everything; speed responds to scroll velocity.
- **Haptic Map:** see section 6.

### Welcome (`/welcome`)

- **Seed Drop:** on load a glowing seed falls from the top, lands on the headline's baseline, and thin roots grow outward behind the page with a path-draw.
- **Word Grow:** in "Everything has roots." the word "roots" gets root strands that grow downward from its letters.
- **Soil Parallax:** background strata layers shift with the pointer on desktop and with device tilt on phones (iOS asks permission on a tap; if declined, a slow auto-drift).
- **Sample Card Cycle:** the demo card plays the Visual Engine explode-and-reassemble loop, and the Root panel breathes a soft glow. It cycles through 3 subjects every 6 seconds with a root-thread wipe between them.
- **Lens Bloom:** choosing a lens makes the chip bloom with a ripple, its colour thread grows toward the button, and unselected chips dim.
- **Button Fill Ring:** "Start digging" is surrounded by a ring that fills as you pick each of the 3 lenses; at 3 it flares once and the button lifts.
- **Try-It Pulse:** the "Try it now" button emits a slow, quiet ring every 4 seconds.

### Sign in / Sign up (Clerk)

- **Doorway Light:** a thin amber line of light sits at the form's top edge and brightens when a field gains focus.
- **Root Network Backdrop:** a faint root graph behind the form; when the user types, pulses ripple through it in response.
- **Unlock Bloom:** on success, roots spread from the button until they fill the screen, then a circular reveal opens Home from the button position.
- **Error Shiver:** a wrong code shakes the field once with a small amber-red flash and a haptic tap.
- **Roots Retract (sign-out):** the Tree animates back into a seed which sinks and fades as the Welcome page rises; a line reads "Your roots are safe."

### Onboarding

- **Depth Slider:** the reading-depth slider has strata lines; dragging sinks or raises a small drill marker with a detent haptic at each level.
- **Language Morph:** changing language morphs the sample text letter by letter into the new language.
- **First Scan Guide:** a gentle amber arrow pulses toward the Scan button until the first capture.

### Home (`/`)

- **Daily Spring:** the Root of the Day card rises from below on a spring with a few soil-crumb particles falling off its top edge.
- **Ring Chime:** the six Lens rings fill in sequence; a ring that just changed glows once and ticks (haptic).
- **Ember Breathing:** the streak flame breathes slowly. On the first card of a new day it flares and the 7-day strip dot blooms.
- **First Root Planted:** after sign-up, the guest card flies into the recent list as a seed and sprouts a root line connecting it to the list.
- **Stagger Sprout:** recent roots grow in one after another, each with a short root line from the previous one.
- **Root Pull:** pull to refresh draws a taproot downward; release and light flows back up it into the page.
- **Radial Unfurl:** long-press the Scan button and four options (Photo, Type, Link, Paste) unfurl like petals.
- **Empty Soil:** with no roots, a seed pulses in a bare field with the line "Plant your first root."

### Scan (`/scan`)

- **Lock-On Brackets:** the viewfinder brackets spring inward when a subject is chosen or detected, then glow in the dominant lens colour.
- **Shutter Iris:** the shutter closes like an iris with a quick amber flash and a haptic tick.
- **Capture Fly:** the captured photo shrinks and flies to its place on the Analyzing screen (shared-element transition).
- **Ink Spread (Type tab):** typed words flow in with a soft ink spread; the keyboard-top hint chips float.
- **Link Unfurl:** a pasted URL unfurls into a small preview (site name, title) with a thread drawing to the scan button.
- **Drop Zone Glow (desktop):** dragging a file over the page makes the edges glow amber and a "Drop to dig" message rises.
- **Limit Warning Ring:** when 1 scan is left, the counter ring turns amber and pulses once.

### Analyzing (`/scan/[id]`)

- **Sonar Sweep:** amber rings pulse outward from the photo's centre while the model works.
- **Parts Surface:** each component appears as a bubble rising from below the photo, then slides into its slot in the list as it is confirmed, with a haptic tick per part.
- **Root Hunt:** the Root panel's dashed border marches around a shimmering box until the answer arrives.
- **Narrated Progress:** rotating micro-copy ("Splitting it into parts", "Tracing where it came from", "Looking for the hidden layer") cross-fades every 1.5 seconds.
- **Evidence Ticks:** as sources are checked, a check draws itself beside each claim; failed checks show a calm "unverified" dash, never a red alarm.
- **Slow Network Mode:** after 6 seconds, the narration switches to "Still digging" with a gentler pulse and a Cancel option.

### Roots Card (`/root/[id]`)

- **Unearth Reveal (signature):** the Root panel is covered by a layer of soil particles that lifts away from the centre, amber light expands from behind the text, and the headline appears word by word. A haptic thud lands at the glow's peak. About 1.1 s.
- **Hero Explode Scroll:** the Visual Engine scene at the top is scroll-linked: as each component card enters the viewport, its part separates and highlights while the others dim.
- **Part Tap Lens:** tapping a part of the visual zooms a magnifier ring onto it, shows its hidden fact, and offers "Dig deeper".
- **Claim Stamp:** evidence badges stamp onto each claim with a small squash and settle; "Interpretation" badges tilt slightly.
- **Source Slide:** source chips slide in from the right one by one when the evidence pass completes.
- **Lens Meter Fill:** the "lenses touched" row fills only the lenses that apply; unused lenses stay dark. Nothing is padded.
- **Seed Arc (save):** "Add to my Tree" launches a glowing seed in an arc from the card to the Tree tab, where the tab sprout grows a new leaf. The streak and ring updates follow.
- **Rabbit Hole Dive:** tapping a rabbit hole question zooms into it while the screen depth bar on the left edge steps down one stratum and the background shifts a shade greener-darker.
- **Link Thread:** after saving, connected-concept chips draw threads toward the Tree icon and the ones that matched an existing root pulse.
- **Unexpected Link Spark:** when the app finds a surprising connection, an arc of light jumps between the two cards with a spark and a banner slides down.
- **Report Ripple:** "Report a mistake" sends a small ripple and a thank-you leaf toast; no confetti.

### Rabbit hole (child card)

- **Strata Breadcrumb:** the breadcrumb is a vertical root path on the left; the current node is lit and parents sit above in fading light.
- **Surface Return:** the back gesture reverses the dive: layers fall back down and the parent card brightens.
- **Depth Limit Bump:** at max depth the card does a soft bump and shows a short note about Pro depth, never a hard block.

### Root Tree (`/tree`)

- **Living Graph:** nodes breathe slowly; new and recent nodes glow stronger.
- **Sap Flow:** threads of amber light drift along edges from recently added nodes, speed tied to how recently each edge was created.
- **Germinate:** a new node grows from its parent along a drawn path with a small pop at the tip.
- **Focus Pull:** tap a node and the camera zooms to it, unrelated nodes blur and dim, connected edges brighten and labels appear.
- **Semantic Zoom:** pinch to zoom; labels and detail appear at zoom thresholds so the graph stays readable.
- **Season Wash:** filtering by a lens washes the whole graph in that colour while other nodes fade to grey.
- **Time-Lapse:** a scrubber replays the Tree's growth in order, nodes germinating one by one. A Record button exports it as a short vertical video for sharing.
- **Ghost Nodes:** faint dashed nodes hint at suggested next explorations; tapping one starts a rabbit hole.
- **Empty Tree:** a lone seed with a single glowing thread reaching toward the Scan button.

### Progress (`/me`)

- **Canopy:** a stylised tree illustration with one branch per lens grows leaves as each lens is explored; the shape is unique to each user and is the basis of the shareable poster.
- **Level-Up Burst:** a lens level-up makes its branch pulse, shed a few leaf particles and play the foil badge flip.
- **Streak Bloom:** days in the strip open like flowers when completed; the current day is a bud that opens on the first card.
- **Badge Foil Flip:** unlocked badges flip with a holographic sheen that follows pointer or tilt.
- **Counter Roll:** stat numbers roll like an odometer when they change.
- **Freeze Frost:** using the weekly streak freeze shows a quick frost spread over the day dot.

### Settings and Preferences

- **Seed Toggle:** switches are seeds; when on, the seed sprouts a leaf and the track fills amber; off, the leaf folds.
- **Detent Haptics:** sliders and segmented controls click into place with a light haptic.
- **Time Wheel:** the Daily Root time picker is a wheel with a sun-moon sweep behind it.
- **Delete Data Confirm:** the destructive action requires a press-and-hold; a root wilts as the ring fills.
- **Saved Leaf:** every changed setting shows a tiny leaf "Saved" tick; no save buttons.

### Paywall and limits

- **Gold Vein:** a vein of amber light draws down through dark rock; as it passes each Pro feature, that feature lights up.
- **Plan Tilt:** the plan cards tilt slightly toward the pointer or device tilt; the selected plan gains a soft glow.
- **Shimmer Sweep:** the primary button has a slow single sweep every 5 seconds.
- **Bloom Burst (success):** on subscription, an amber bloom fills the screen from the button, resolves into the canopy glowing, and returns the user to where they were.
- **Sunrise Reset (limit sheet):** the daily limit ring depletes like a setting sun; the countdown shows the sun rising at reset, with a "remind me" button.
- **Honest design:** no fake countdowns, no shaking buttons, no guilt copy.

### Profile

- **Lens Halo:** the avatar has a thin ring of the user's top lens colours rotating very slowly.
- **Poster Preview:** the "My Root Tree" poster tilts with a foil sheen and exports as an image.
- **Sign-out:** Roots Retract (see Sign in).

### Share and public pages (`/r/[slug]`)

- **Foil Tilt Card:** the share card has a holographic amber sheen that follows pointer or device tilt.
- **Guess the Root:** a friend sees the object and three possible hidden roots; choosing one triggers a lock animation, then Unearth Reveal with a "you got it / not quite" result and the "Scan yours" button.
- **Reveal Reel:** the exported 9:16 video plays Seed Drop, the object exploding into parts, the Unearth Reveal, then a clean brand end card.
- **Scan Yours CTA:** a pulsing viewfinder icon invites a first scan.

### Admin

- **Quiet Mode:** minimal motion, data only; counters tick but nothing decorative.

---

## 6. Sound and haptics

- **Haptics:** use the Vibration API on Android browsers that support it; iOS Safari does not provide this, so rely on visual feedback there. Short taps (10 ms) for ticks, a two-pulse pattern for the Root reveal, a longer pulse for level-ups. Setting: Haptics on or off.
- **Sound:** off by default; an opt-in "Sound" setting. A tiny set of soft sounds (wood tap, low thud on Root reveal, a soft chime on ring completion) via Web Audio, each under 1 second and loaded lazily. Never autoplay. Respect the silent switch and system volume.
- Both are treated as enhancements; no information is communicated by sound or vibration alone.

---

## 7. Making it spread: the virality system

The shareable unit is the **discovery**, not the app. The scan itself is short-video content: you point at something ordinary and a hidden layer is revealed.

### 7.1 Shareable artifacts (every one carries the brand and a link back)

| Artifact | Format | Why it spreads |
| --- | --- | --- |
| Reveal Reel | 9:16 video, 6 to 10 s | Native to TikTok, Reels, Shorts and WhatsApp Status; the Unearth Reveal is the hook |
| Foil Card | 4:5 image with sheen preview | Chat and feed friendly; shows one surprising Root |
| Guess the Root | Link | Interactive; friend plays before seeing any ad, then scans their own |
| Tree Time-Lapse | 9:16 video | "Look what I've learned this month" identity content |
| My Root Tree poster | Image | Personal, flattering, unique to each user |
| Weekly Recap | Image or story | Habit and bragging together |
| Compare Trees (opt-in) | Link | Two people see shared concepts and surprising overlaps; invites a friend by design |

Always shared through the Web Share API with files on mobile, with a download-and-copy-link fallback on desktop. Private photos and notes never appear in shared artifacts; sharing is always an explicit tap.

### 7.2 Loops

1. **Reveal loop:** scan, Root reveal, share Reveal Reel, viewer opens `/r/[slug]`, plays Guess the Root, scans their own.
2. **Challenge loop:** weekly prompt ("Scan the oldest thing in your kitchen") with a hashtag; best roots featured on the account; featured users are notified and share the feature.
3. **Invite loop:** invite code gives both people extra daily scans or Pro days; milestone rewards at 3 and 10 successful invites.
4. **SEO loop:** every published snapshot is an indexable page ("Why instant noodles were invented") with structured data and a dynamic share image, which compounds over time.
5. **Classroom loop:** teacher mode (later): a class code, shared challenge, no personal data exposed. Schools and study communities are a high-trust channel.
6. **Creator loop:** an affiliate link and a creator kit (templates, demo footage, sound) for curiosity, science, food and "life hack" creators.

### 7.3 Viral mechanics to build

- Dynamic Open Graph image and title per snapshot (`next/og`), so WhatsApp, X and iMessage previews show the Root headline. Preview text is the hook, not the app name.
- `/r/[slug]` loads fast (static render), requires no sign-in, and shows "Scan yours" within the first screen.
- Referral attribution on every share link (`?ref=`), tracked from share to visit to guest scan to sign-up.
- A "Share" prompt only at moments of delight (after the Root reveal and after a link is found), never as a nag.
- Waitlist and invite codes during beta to create scarcity and to protect cost.
- Cost protection before any push: per-user quotas, guest budget caps, a queue with friendly waiting state, alerts on provider spend, and a kill switch. Virality that exhausts the AI budget ends the campaign.

### 7.4 Advertising

**Positioning:** "Scan anything. Find its hidden roots." Alternate lines: "Everything has roots." and "What's the root of that?"

**Ad format (15 to 25 s, vertical):** 0 to 2 s hook line on screen; 2 to 7 s point the phone at an ordinary object; 7 to 15 s the Unearth Reveal and the object exploding into parts; 15 to 20 s one surprising fact; last 3 s the end card with "Scan yours".

**Hooks to test**

1. "I scanned my lunch and found out it was invented to fight hunger."
2. "Your phone has a hidden story. Point and see."
3. "Everything in your house has a secret past."
4. "Guess the root: can you beat my friends?"
5. "This 10 second scan taught me more than a class."
6. "What's the root of that word? Scan it."
7. "I've scanned 30 things this month. This is my Tree."
8. "Teachers, give your class this challenge."

**Channels, in order:** organic short video (TikTok, Reels, Shorts) with 2 to 3 posts a day from the brand account during launch; creator seeding (micro-creators in curiosity, science, food, student life); WhatsApp channels and communities; Reddit curiosity communities, respecting each community's rules; student groups and campus pages; Product Hunt and a Show HN post once the beta is stable; small paid tests (Spark Ads or equivalent) only after the funnel is instrumented and cost per first scan is known.

**Landing page (`/welcome`):** a hero loop of the Reveal Reel, a one-line promise, a "Try it now" button leading to a guest scan, three proof moments (scan, reveal, Tree), a share-card gallery, FAQ on accuracy and privacy, and clear AI disclosure. Add a press kit (logo, screenshots, 30 s demo, founder note).

**Credibility is the growth engine and the risk.** A wrong fact that goes viral damages the brand. Keep the evidence badges visible in every shared artifact, add a "Corrections" page, and pause sharing for any claim that has an open report.

### 7.5 Launch timeline

| When | Work |
| --- | --- |
| T-21 days | Buy domain, Clerk production instance with Google credentials, legal pages reviewed, analytics and error monitoring live |
| T-14 | Private beta with 30 to 50 users and a few creators; collect 20 best Reveal Reels; fix the top 10 issues |
| T-7 | Landing page, waitlist, press kit, ad creatives ready; cost alarms and kill switch tested; load test the scan path |
| T-0 | Product Hunt and Show HN, creator posts, WhatsApp seeding; waitlist released in batches |
| T+1 to 7 | Daily Root post, feature user roots, answer every comment, fix bugs fast |
| T+14 | Turn on the paywall for new users behind a flag; compare two price points |
| T+30 | Review retention, share rate and cost per card; decide on referrals, classroom mode and paid ads |

### 7.6 What to measure

Share rate per root, share-to-visit, visit-to-guest-scan, guest-to-sign-up, K-factor (invites or shares per user times conversion), time to first card, day 1 and day 7 return, scans per active day, free-to-paid conversion, cost per card, report-a-mistake rate. Set targets only after the first two weeks of real data.

---

## 8. Build packages and acceptance

| # | Package | Contents |
| --- | --- | --- |
| C1 | Clerk and data | Clerk install, middleware, themed sign-in and sign-up, Supabase third-party auth, RLS with text `user_id`, webhooks, clean sign-out and local data wipe |
| C2 | Guest and onboarding | `/try`, Turnstile, claim-guest-root, onboarding, first-root-planted flow |
| C3 | Layout system | Phone, tablet and desktop layouts, command palette, shortcuts, QR handoff |
| C4 | PWA | Manifest, service worker, offline page, install flows, share target, badges |
| C5 | Motion foundation | Tokens, global animations, reduced-motion and low-power tiers, particle layer |
| C6 | Signature moments | Unearth Reveal, Seed Arc, Dive and Surface, Sap Flow, Foil Tilt, Gold Vein, Canopy |
| C7 | Screen animations | Everything in section 5 in priority order: Roots Card, Scan and Analyzing, Home, Tree, Welcome, Progress, rest |
| C8 | Share system | Foil card, Reveal Reel export, Guess the Root, `/r/[slug]`, dynamic OG images, referrals |
| C9 | Launch kit | Landing page, press kit, analytics events, cost protection, waitlist and invite codes |

**Acceptance**

- Two accounts cannot see each other's data by any route, including direct database calls.
- Sign-out lands on `/welcome` and leaves no user data in the browser.
- The installed PWA works on Android and iPhone; Tree is readable offline.
- Every screen in section 5 has its named animations, a reduced-motion version and a low-power version.
- A first-time visitor from a shared link reaches a guest card in under 30 seconds.
- A reveal video exports on both Android and iPhone and plays in WhatsApp.
- A load test of the scan path with the guest budget cap shows graceful waiting, not errors.

---

## 9. Agent directive

```text
Deep Roots v4. Read the Beta Completion spec, this spec and the mockups first. Inspect the repo; keep what works.

Auth: use Clerk (@clerk/nextjs, clerkMiddleware, ClerkProvider with afterSignOutUrl="/welcome"). Use the Clerk "Agent setup" prompt for the Next.js install steps; upgrade Next.js to a version the current Clerk SDK supports. Connect Clerk to Supabase with the native third-party auth integration (not the deprecated JWT template). Every table has user_id text default auth.jwt()->>'sub' and an RLS policy comparing (select auth.jwt()->>'sub') to user_id. Service-role key only in webhooks and jobs. Verify Clerk webhooks (user.created, user.updated, user.deleted) and purge all data on user.deleted.

Guests: /try with Turnstile, IP limits and a global budget; one guest scan stored in IndexedDB only; claim it after sign-up.

Sign-out must clear IndexedDB, caches and in-memory stores. The service worker never caches authenticated responses or Clerk paths.

Motion: implement the tokens in section 4 and the catalogue in section 5. Animate transform and opacity only; honour prefers-reduced-motion and a low-power tier; cap particles; pause off-screen. No animation may hide content or block input.

Share and viral features per section 7. Cost protection (quotas, queue, spend alerts, kill switch) ships before any promotion.

Report each requirement PASS, PARTIAL, FAIL or BLOCKED with evidence. Do not claim anything works unless you ran it.
```
