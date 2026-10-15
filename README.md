# Deep Roots 🌿

> **Everything has roots.** Snap, paste, or type anything. See what it is made of, where it came from, and what it connects to.

Deep Roots transforms ordinary things into an interconnected, persistent map of human knowledge and hidden systems.

---

## 📱 Product Experience & Screens

1. **Welcome Screen (`/welcome`)**: Initial onboarding featuring the product promise, interactive 3-of-6 Lens picker, and sample preview card.
2. **Home Screen (`/`)**: Daily dynamic greeting, streak counter, **Root of the Day** featured card, 6 Lens exploration progress rings, and recent discovery feed.
3. **Universal Scan (`/scan`)**: Multi-modal input with tabs for **Photo**, **Type**, and **Link**, viewfinder frame, client-side canvas image compression & EXIF stripping, and quick discovery chips.
4. **Analyzing Screen (`/scan/[id]`)**: Streaming progress visualization with skeletons for the hidden Root and components as they decompose in real-time.
5. **Roots Card (`/root/[id]`)**:
   - Dynamic **The Root** amber discovery panel.
   - Component decomposition with designated roles, hidden facts, and lens tags.
   - **Evidence & Claims Ledger**: Established, interpretation, and open question classifications with real source citations.
   - Connected concepts and Rabbit Hole triggers.
6. **Rabbit Hole Deepening**: Sheet & child card navigation allowing users to explore up to depth 3 with full breadcrumbs and state preservation.
7. **Root Tree (`/tree`)**: Interactive radial SVG knowledge graph and list view toggle with typed edges (`parent`, `shared_concept`, `cause`, `contrast`, `unexpected`).
8. **Progress (`/me`)**: Streak tracking with 7-day strip, counts for roots/rabbit holes/links, lens levels, achievement badges, and privacy/deletion controls.
9. **Share Card**: Branded, high-contrast discovery snapshot preview with quick link copying.

---

## 🛠 Tech Stack

- **Framework**: Next.js 14 App Router + TypeScript
- **Styling**: Tailwind CSS + Custom Design Tokens matching Figma mockups
- **Design System**: Obsidian Dark (`#0E1411`), Surface (`#151D18`), Amber (`#FFC857`), and 6 Lens Tokens:
  - Language: `#7FB8FF`
  - Culture: `#FF9B7A`
  - Mind & Body: `#D4A5FF`
  - Money: `#9BE564`
  - Tech: `#5FE0E8`
  - Origins: `#FF86B8`
- **AI Intelligence**: Gemini 3.8 Flash / Claude 5.5 Sonnet & Haiku with strict Zod runtime schema validation.
- **Persistence**: Dual-layer offline-first local state + Supabase PostgreSQL ready.

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables (.env.local)
GEMINI_API_KEY=your_gemini_key
# or ANTHROPIC_API_KEY=your_anthropic_key

# 3. Start development server
npm run dev

# 4. Production build
npm run build
```
