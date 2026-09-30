# CLAUDE.md — MOODEE Collaboration Context

This file is the working context for AI-assisted contributions to **MOODEE**.

Before changing code, read these files first:

1. `README.md` — product overview, current demo, principles, run commands
2. `docs/IMPLEMENTATION_PLAN.md` — latest implementation status and remaining work
3. `docs/ASSET_MAP.md` — asset sources, generated files, placement notes
4. `docs/app-structure.md` — original UX flow and data-model plan

Live demo: https://i0kyung.github.io/moodee/

---

## 1. What MOODEE is

**MOODEE — A cozy world for distracted minds.**

MOODEE is a mobile-first browser experience where users move through a small digital world and choose a place that fits what they need in the moment.

Core product idea:

- help people start and stay with a task through **atmosphere, low friction, and quiet co-presence**
- avoid pressure-heavy patterns such as punishment, red warnings, losing screens, or guilt-based streaks
- make features feel like places you enter, not utility panels you open
- let users be around others without forcing conversation

Current places:

- **Classroom** — focus quietly with others
- **Library** — write, collect, and organize thoughts
- **Museum** — turn moments into memory objects
- **Café** — make a drink, stay with others, and play low-pressure co-op games
- **My Room** — personalize the user's space with collected items

The project began from an **ADHD / focus-friction design lens**, but it is not a medical treatment product. Do not add medical claims, diagnosis language, or claims that MOODEE treats ADHD, depression, anxiety, or other conditions.

---

## 2. Product principles

Preserve these unless the team explicitly changes them:

1. **Calm, not pressure**
   - no punishment loops
   - no harsh alarms or red warning states by default
   - no losing screen in cozy/co-op experiences
   - sound begins off or gently

2. **Places change the mood**
   - interactions should feel grounded in the world
   - prefer: walk to object → action button → activity
   - avoid turning the app into a collection of unrelated menus

3. **Together, quietly**
   - co-presence comes before chat
   - chat is optional and lightweight
   - users should still be able to use core focus features alone

4. **Focus support stays free**
   - cosmetics, personalization, room items, or premium extras can be monetized
   - core focus interaction should not be paywalled

5. **Keep the current visual identity**
   - soft, cozy, game-like, pastel / warm presentation
   - preserve existing artwork unless asked to replace it
   - do not redesign finished screens without a specific request

---

## 3. Technical stack

- React 19
- TypeScript
- Vite
- Framer Motion
- Web Audio API
- browser `localStorage` for demo persistence
- GitHub Pages deployment

Commands:

```bash
npm install
npm run dev
npm run build
npm run test:rules
```

Important deployment detail:

- `vite.config.ts` uses `base: './'` for GitHub Pages/subpath compatibility
- do not change this unless deployment strategy changes

---

## 4. Current app architecture

The app does **not** use React Router.

Navigation is currently controlled by the `screen` state in:

- `src/App.tsx`

Current screen values include:

- `intro`
- `companions`
- `select`
- `home`
- `classroom`
- `cafe`
- `library`
- `museum`
- `my-room`
- `records`
- `membership`

Do not introduce a router just for one feature. If a feature can fit the existing state-machine approach, keep it consistent.

Shared world interaction pattern:

`Top view → move → interaction zone → action → activity screen/layer → return`

Shared world logic lives mainly in:

- `src/world/WorldScene.tsx`
- `src/world/space.module.css`
- `src/lib/walkGrid.ts`

Use existing world/navigation helpers before creating new movement systems.

---

## 5. Current implemented experience

### Onboarding / Home
Implemented:
- intro
- companion count setup
- character selection
- place wheel / home
- loading splash between places

### Classroom
Implemented:
- seat selection
- timer flow
- ambient sound controls
- minimap / HUD
- lightweight local chat
- session completion and reward-related flow

Known remaining work:
- migrate classroom top-view movement to the shared `WorldScene`
- improve shared NPC / companion behavior in Classroom

### Library
Implemented:
- walkable top view
- desk interaction
- open book writing
- save / reopen / delete notes
- classroom thought-drop content can appear here

### Museum
Implemented:
- walkable top view
- capture-a-memory flow
- demo media / camera fallback
- photo → memory icon/object presentation
- save story
- place and revisit recent memory objects

Important:
- this is a **prepared-asset transformation demo**, not real AI 3D generation
- do not describe it in code/UI as real 3D generation unless that feature is actually added

### Café
Implemented:
- walkable top view
- make-a-drink interaction
- layered drink visuals
- carry drink
- sit at a table
- chat / friend presence
- Board Café entry point

Board Café currently includes:
- **Cloud Tiles**
- **Word Relay**
- **Cloud Match** placeholder / coming soon

Relevant files:
- `src/boardcafe/`
- `src/screens/CafeScreen.*`
- `public/assets/boardcafe/`

Cloud Tiles is intentionally cooperative and low-pressure:
- no losing screen
- players build clouds together
- reward cooperation, not competition

### My Room
Implemented:
- walkable room
- place / swap / remove collected items
- wardrobe / Cloudee-related customization hooks
- connection to Museum memory objects

### Shop
Implemented:
- event banners
- 7-day attendance stamp board
- coins
- cosmetics/cards
- Pro presentation

This is a demo. No real payment should be added unless explicitly requested.

---

## 6. Data and persistence

Current persistence is browser-only.

Storage helper:
- `src/lib/storage.ts`

All saved values use the prefix:

`moodie:`

Before adding a new persistence system:

- do not remove localStorage behavior unless asked
- keep the demo working without a backend
- if introducing Supabase/Auth/Realtime later, treat it as a separate integration step

---

## 7. Assets

Do not casually rename or move assets.

Read:

- `docs/ASSET_MAP.md`

Many assets are generated or prepared by:

```bash
npm run assets
```

Source art is outside the deployed `public/assets/` tree and the preparation script may regenerate files.

When replacing an asset:
- check whether it is generated by `scripts/prepare-assets.mjs`
- preserve existing paths when possible
- do not duplicate large image files unnecessarily

---

## 8. How to make changes safely

When working on a requested feature:

1. read the relevant screen/component first
2. make the smallest change that solves the request
3. reuse existing components, styles, storage helpers, world logic, and assets
4. avoid broad refactors during hackathon iteration
5. preserve existing interactions that already work
6. run:
   - `npm run build`
   - `npm run test:rules` when Board Café rules are touched
7. mention changed files and any unfinished items

Do not:
- rewrite the entire app architecture for one feature
- replace the existing art direction without approval
- remove existing screens because a new feature overlaps them
- invent backend APIs that do not exist
- add heavy dependencies when a small local implementation is enough
- make unrelated changes in the same feature branch

---

## 9. Collaboration / branch guidance

For team contributions, prefer one focused branch per feature or fix.

Examples:

- `feature/classroom-worldscene`
- `feature/cafe-adjustments`
- `feature/cloud-match`
- `fix/mobile-overflow`

A good handoff should include:

- what changed
- files changed
- how to test it
- anything still incomplete

Avoid silently changing product copy, target audience, monetization rules, or UX direction while implementing a technical task.

If a request conflicts with the current product direction, ask before changing the behavior.

---

## 10. Current useful contribution areas

Good areas for a collaborator to pick up without rebuilding the whole project:

- migrate Classroom top view to `WorldScene`
- improve companion/NPC placement in Classroom and Museum
- implement the currently locked **Cloud Match** game
- fix mobile layout / overflow / interaction bugs
- improve polish and transitions in existing completed flows
- small accessibility improvements that preserve the cozy visual language

Before starting one of these, check `docs/IMPLEMENTATION_PLAN.md` because the implementation may have changed recently.

---

## 11. Naming

Use these spellings consistently:

- **MOODEE** — product
- **Cloudee** — user/character identity
- **Cloudy** — cloud mascot / Pro-related character
- **Cloud Tiles** — Café co-op tile game
- **Word Relay** — Café word-chain game
- **Cloud Match** — planned/locked Café game

---

## 12. Source of truth

Because this is a fast-moving hackathon repository, some older planning notes may lag behind the actual implementation.

When documents disagree, use this priority:

1. current code on `main`
2. `docs/IMPLEMENTATION_PLAN.md`
3. `README.md`
4. `docs/ASSET_MAP.md`
5. `docs/app-structure.md`

If unsure, do not guess. Make the smallest safe change or ask the team.
