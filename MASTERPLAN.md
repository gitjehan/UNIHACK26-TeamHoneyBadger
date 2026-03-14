# AXIS — MASTER PLAN (UNIHACK 2026)

**AXIS** is a bio-responsive ambient workspace. Your webcam watches your posture, fatigue, and emotion using real-time computer vision — then instead of sending you a notification, it subtly shifts your entire digital environment. Real screen brightness, color temperature, ambient audio, and a living pet companion all respond to how you're sitting and feeling. No popups. No interruptions. Your workspace just adapts.

> **Pitch**: "AXIS is a Mac desktop app that uses your webcam to track your posture, fatigue, and emotion in real-time — then adapts your actual screen brightness, color temperature, and a virtual pet companion to keep you healthy without ever interrupting you."

---

## Context

UNIHACK 2026 — 500+ students, $7k+ prizes.

This plan covers technical architecture, execution order, and build phases.

---

## Current Progress

### Build Phases

| Phase | Name | Status |
|-------|------|--------|
| 0 | Electron Scaffold + Webcam | DONE |
| 1 | ML Spike — Posture Detection + Digital Twin | DONE |
| 2 | macOS Ambient Control | DONE |
| 3 | Dashboard | DONE |
| 4 | Blink Rate + Stress + Focus | DONE |
| 5 | Bio-Pet Lifecycle | DONE |
| 6 | Elasticsearch + Leaderboard | DONE |
| 7 | Session Recap Card | DONE |
| 8 | Polish & Demo Prep | IN PROGRESS |

### Feature Tiers

| Tier | Features | Status |
|------|----------|--------|
| 1 — MUST SHIP | Posture detection, calibration, Pomodoro Timer, ambient screen response, dashboard + metrics | DONE |
| 2 — SHOULD SHIP | Blink/fatigue, stress estimation, focus score, session timeline, Bio-Pet lifecycle, multi-signal ambient, systems panel | DONE |
| 3 — HIGH IMPACT | Session Recap Card, streak + accessories, Lock In Board (leaderboard), Elasticsearch pipeline | DONE |
| 4 — NICE TO HAVE | Ambient audio (Tone.js), Elasticsearch analytics, Kibana viz, percentile on recap | PARTIAL — ambient audio shipped, Kibana/analytics TBD |

---

### Detailed Plans (Phase 8 Fixes & Enhancements)

Each plan below has been diagnosed and scoped. They are ordered by priority for demo readiness.

#### Plan 01 — Fix Posture Tracking Accuracy (`plans/01-posture-tracking-fix.md`) — DONE

**Problem**: Posture scoring felt inconsistent due to compounding issues.

**What was fixed**:
- [x] Reduced `postureSmoothing` from `RollingAverage(60)` to `RollingAverage(24)` (~3s at 8fps)
- [x] Removed double-counted `slumpSeverity * 20` penalty
- [x] Aligned hardcoded angle values in `posture-scorer.ts` with `constants.ts`
- [x] Added visibility filtering to calibration (skips landmarks with `visibility < 0.3`)
- [x] Fixed calibration race condition (skip first 500ms, increased sample interval to 150ms, minimum 12 samples)

**Result**: Score reacts within ~3s, feels accurate and consistent with actual posture.

#### Plan 02 — Pet Lifecycle Persistence & Unlocks (`plans/02-pet-lifecycle-logic.md`) — NOT STARTED

**Problem**: Pet progress is fragile and several unlock conditions are unwired.

**What works**: Egg crack progression, health states (Thriving/Fading/Wilting), evolution stages 0–5, health hysteresis with 3s debounce, behavior AI (walk/run/sleep/groom), floating hearts/Zzz effects.

**What's missing**:
- [ ] Auto-save pet state every 30 seconds (currently only saves on "End Session") — in `App.tsx`
- [ ] Save pet on window close / cleanup so progress survives force-quit — in `App.tsx`
- [ ] Track session count in electron-store; check for hat unlock (3 sessions) on `endSession` — in `App.tsx` + `score-engine.ts`
- [ ] Crown unlock: accept leaderboard rank, unlock if rank === 1 — in `score-engine.ts`
- [ ] Emit distinct event/flag when evolution or accessory unlock happens — in `score-engine.ts`
- [ ] Hatch transition animation: scale-bounce from egg to cat instead of instant snap — in `BioPet.tsx`
- [ ] Visual rendering for all accessories (scarf, hat, glasses, wings, halo, crown) — in `BioPet.tsx`
- [ ] Wire SweatDrop effect to Fading health state — in `BioPet.tsx`

**Expected outcome**: Pet progress auto-saves, all accessories render visually, hatching has a smooth animation.

#### Plan 03 — UI/UX Polish (`plans/03-improve-ui-ux.md`) — NOT STARTED

General polish pass across the app — responsive layout fixes, hover/focus states, live streak display, empty state improvements. Make everything feel intentional and polished.

#### Plan 04 — Gamification & Pet Celebrations (`plans/04-gamification-pet.md`) — NOT STARTED

**What's missing**: No in-session notifications, no celebrations, no streak-based pet reactions.

**Changes planned**:
- [ ] Create `Toast.tsx` component — floating notification that slides in from top-right, auto-dismisses after 4s, with "achievement" (gold) and "info" (neutral) variants
- [ ] Add `notifications` array to score-engine state — push on pet evolution, accessory unlock, streak milestones (10/30/60 min)
- [ ] Add celebration effect on evolution in `BioPet.tsx` — scale bounce + emissive flash (2s)
- [ ] Add streak milestone reactions in `BioPet.tsx` — bounce/glow pulse at 10/30/60 min
- [ ] Read notifications in `App.tsx` and render `<Toast>` for each
- [ ] Pass leaderboard rank to `endSession()` for crown unlock check

**Expected outcome**: Real-time feedback on milestones, pet visibly celebrates, experience feels rewarding.

#### Plan 05 — Brightness & Screen Warmth Smoother (`plans/05-brightness-warmth-changer.md`) — DONE

**Problem**: Ambient screen changes felt abrupt and jerky.

**What was fixed**:
- [x] Smoothed ambient targets with rolling average of last 5 values
- [x] Smoothed fatigueScore with its own rolling average before applying to brightness
- [x] Added dead zone (0.02) to prevent constant transition restarts
- [x] Smooth retargeting: updates target mid-transition instead of restarting from step 0
- [x] Increased transition from 40 to 60 steps (3s instead of 2s)
- [x] Overlapped AMBIENT_MAP buckets (75–100, 45–80, 15–50, 0–20) to eliminate hard boundaries
- [x] Loaded and applied user preferences (`brightnessRange`, `warmthIntensity`) from electron-store

**Result**: Smooth, ambient transitions with no flicker or abrupt jumps.

#### Plan 06 — Pet Evolution Names (Cat-Themed) — NOT STARTED

**Problem**: Evolution stage names (Hatchling, Fledgling) are bird-themed but the pet is a ginger cat. Names should match the animal.

**Current names**: Egg → Hatchling → Fledgling → Companion → Guardian → Ascended

**Proposed cat-themed names**: Egg → Kitten → Mouser → Companion → Guardian → Ascended

**Changes needed**:
- [ ] Update `PET_EVOLUTION` titles in `constants.ts`
- [ ] Update default `stageName` in `score-engine.ts` and `ipc-handlers.ts`
- [ ] Update any hardcoded stage name references in `BioPet.tsx` and `elastic-client.ts`
- [ ] Update MASTERPLAN stage name references

#### Plan 07 — Add Paw Print to Egg (`plans/07-egg-paw-print.md`) — NOT STARTED

**Problem**: The pixel-art egg is plain. Adding a paw print gives it identity and hints that a cat is inside.

**Changes needed**:
- [ ] Add a `eggPawPrint` overlay grid to `sprite-data.ts` (similar to `eggCracks85` / `eggCracks95` — a small paw silhouette in a contrasting color on the egg surface)
- [ ] Render the paw overlay in `PixelSprite.tsx` on top of the egg at all times (before crack overlays)

#### Plan 08 — Welcome / Opening Screen Redesign — NOT STARTED

The current welcome screen looks subpar and generic. Needs a full redesign to set the tone — hero visual, better typography, animations, and personality. First thing judges see.

#### Plan 09 — Leaderboard UI Polish — NOT STARTED

The leaderboard works but looks basic. Needs podium for top 3, pet avatars next to entries, rank badges, better styling. Should feel competitive and exciting.

#### Blink Detection — Current State

Blink detection was unreliable and has been **fixed**. Current implementation:

- **EAR (Eye Aspect Ratio)** calculation using `@vladmandic/human` 468-point face mesh
- Left + right eye EAR averaged, compared against threshold (0.20)
- Blink detection: EAR drops below 0.20 for 1–5 frames then recovers = blink; >5 frames = prolonged closure (fatigue signal)
- Blink rate tracked via rolling 60-second window (blinks per minute)
- Fatigue score derived from: blink rate deviation from baseline (40%), average EAR droopiness (40%), prolonged closure penalty (20%)
- Runs at 5fps on the shared `@vladmandic/human` instance (merged with pose engine)
- **What was fixed**: Detection was previously unreliable due to face mesh initialization timing and EAR threshold sensitivity — now stable

**Remaining blink/fatigue concern**: Fatigue-driven brightness adjustment is noisy (Plan 05 addresses this with rolling-average smoothing).

---

### Completed Optimizations (Phase 8)

- **Pomodoro Timer**: Replaced Digital Twin with Pomodoro Timer in left dashboard column (Focus 25m / Short Break 5m / Long Break 15m, posture nudge at <40 score, round counter, localStorage persistence, tab switching disabled while running, per-mode time preservation)
- **Header alignment**: Moved Axis branding far left; reduced `padding-left` from 72px to 24px
- Refactored dashboard responsiveness: explicit column classes + adaptive grid modes (compact/stacked/short)
- Added compact-window behavior: auto-collapses non-critical panels while preserving manual expansion
- Simplified scroll model: single main content scroller (`app-content`)
- Merged PoseEngine + FaceEngine into single shared `@vladmandic/human` instance (halved model memory)
- Eliminated duplicate offscreen `<video>` element — single video for display + ML
- Removed all `shadowBlur` from Digital Twin canvas (expensive Gaussian blur per draw call)
- Removed unused legacy sprite exports and dead pet-effect logic
- Disabled Three.js shadow maps + reduced pixel ratio in Bio-Pet renderer
- Fixed `useScores` hook not returning unsubscribe (memory leak)
- Reduced face detection from 10fps to 5fps, pose from 10fps to 8fps
- Slowed timeline polling from 1s to 2s
- Removed Systems panel from user-facing dashboard (internal debug info)
- Added `-webkit-app-region: drag` to header (window draggable)
- Fixed app scrolling (`overflow: hidden` was blocking scroll)
- Removed blue speckle dots from Bio-Pet egg

### Design Decision: Digital Twin → Pomodoro Timer

- [x] **Replaced Digital Twin** with a **Pomodoro Timer** in the left column of the dashboard
- The Digital Twin (stick figure canvas) has been removed from the user-facing UI
- The Pomodoro Timer sits above the Bio-Pet in the left column
- Posture score is passed into the timer — a nudge appears during active Focus sessions when posture drops below 40
- Timer supports: Focus (25 min), Short Break (5 min), Long Break (15 min); round counter; Start/Pause/Reset controls; round dot progress indicator

---

### Remaining Work — Prioritized

#### Critical for Demo (must do)

| # | Task | Plan | Files |
|---|------|------|-------|
| 1 | Redesign welcome/opening screen — looks subpar, needs visual impact | Plan 08 | `WelcomeScreen.tsx`, `globals.css` |
| 2 | Auto-save pet state every 30s + on window close | Plan 02 | `App.tsx` |
| 3 | Rename pet evolution stages to cat-themed (Hatchling → Kitten, Fledgling → Mouser) | Plan 06 | `constants.ts`, `score-engine.ts`, `ipc-handlers.ts` |
| 4 | Add paw print to egg sprite | Plan 07 | `sprite-data.ts`, `PixelSprite.tsx` |

#### Important for Polish (should do)

| # | Task | Plan | Files |
|---|------|------|-------|
| 5 | Leaderboard UI polish — podium for top 3, pet avatars, rank badges, better styling | Plan 09 | `LeaderBoard.tsx`, `globals.css` |
| 6 | Hatch transition animation (egg → cat) | Plan 02 | `BioPet.tsx` |
| 7 | Live streak counter in header | Plan 03 | `Header.tsx` |
| 8 | Toast notifications for milestones | Plan 04 | New `Toast.tsx`, `score-engine.ts`, `App.tsx` |
| 9 | Hat unlock (3 sessions) + crown unlock (#1 leaderboard) | Plan 02 | `score-engine.ts`, `App.tsx` |
| 10 | Pet celebration effects on evolution | Plan 04 | `BioPet.tsx` |
| 11 | Demo data seeding (pet at Stage 2+, leaderboard entries) | — | electron-store seed script |

#### Nice to Have (stretch)

| # | Task | Plan | Files |
|---|------|------|-------|
| 12 | Visual rendering for all accessories (scarf, hat, glasses, wings, halo, crown) | Plan 02 | `BioPet.tsx` |
| 13 | Responsive breakpoint improvements | Plan 03 | `globals.css` |
| 14 | Timeline empty state shimmer | Plan 03 | `SessionTimeline.tsx` |
| 15 | Recap canvas font fix | Plan 03 | `SessionRecapCard.tsx` |
| 16 | Kibana dashboard setup | — | Elastic Cloud |
| 17 | Presentation slides + demo script + rehearsal | — | External |

### MVP Completion Assessment (UNIHACK 2026)

| Area | Status | Weight | Done |
|------|--------|--------|------|
| **Core product** (Phases 0–7) | All phases complete | 50% | 100% |
| **Phase 8 polish** | Pomodoro UX, responsiveness, gamma safety, header alignment | 8% | ~90% |
| **Posture accuracy** (Plan 01) | Fixed — smoothing, penalties, calibration | 8% | 100% |
| **Ambient smoothing** (Plan 05) | Fixed — smooth transitions, no flicker | 5% | 100% |
| **Welcome screen redesign** (Plan 08) | Current screen is subpar, needs visual impact | 5% | 0% |
| **Pet names + egg paw** (Plans 06, 07) | Bird names → cat names, paw print on egg | 3% | 0% |
| **Pet persistence & unlocks** (Plan 02) | Auto-save, accessories, hatch animation pending | 5% | 0% |
| **Leaderboard UI polish** (Plan 09) | Basic table → podium, avatars, rank badges | 4% | 0% |
| **Gamification** (Plan 04) | Toasts, celebrations, streak reactions planned | 3% | 0% |
| **UI/UX polish** (Plan 03) | Streak display, responsive tweaks, empty states | 2% | 0% |
| **Demo prep** | Slides, script, data seeding, rehearsal | 7% | 0% |

**Overall MVP progress: ~85%**

The core product is feature-complete and the two biggest quality issues are resolved: **posture tracking** now reacts within 3 seconds with accurate scoring (Plan 01 done), and **ambient screen transitions** are smooth with no flicker or abrupt jumps (Plan 05 done). Blink detection is stable. Remaining work focuses on **visual polish and identity**: the welcome screen needs a redesign (looks generic), pet evolution names need to be cat-themed instead of bird-themed (Hatchling/Fledgling → Kitten/Mouser), the egg needs a paw print, the leaderboard needs visual flair (podium, avatars, rank badges), pet state should auto-save, and gamification notifications need wiring. Demo prep (slides, script, data seeding) is also outstanding.

---

## Technical Architecture

### Why a Desktop App (Not a Web App)

The core promise of AXIS is that your **workspace adapts to you**. A web app can only fake this with CSS filters inside its own tab. An Electron app on macOS can control the **actual screen** — real brightness dimming, real color temperature shifts across your entire display. This is the difference between a demo trick and a real product.

macOS gives us this for free:
- **Brightness**: `brightness` CLI tool (one line, `brew install brightness`) or IOKit calls
- **Color temperature / gamma**: `CGSetDisplayTransferByFormula` via CoreGraphics — no special permissions, no code signing, works immediately
- **Camera**: One-click permission prompt in Electron, same as any Mac app

Since Electron's renderer is Chromium, all browser ML libraries (MediaPipe, Human) work identically. We lose nothing from leaving Next.js and gain real system-level ambient control.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| App Shell | Electron (via Electron Forge) + TypeScript |
| UI Framework | React + Tailwind CSS (in renderer process) |
| Pose Tracking | `@mediapipe/tasks-vision` (Pose Landmarker) — runs in renderer |
| Face/Emotion | `@vladmandic/human` — runs in renderer |
| 3D Visualization | Three.js (renderer process) |
| Brightness Control | `brightness` CLI or IOKit (main process) |
| Color Temperature | CoreGraphics `CGSetDisplayTransferByFormula` via Swift helper or Python ctypes (main process) |
| Data Pipeline | `@elastic/elasticsearch` → Elastic Cloud (main process) |
| Analytics Viz | Kibana (embedded/screenshotted) |
| Charting | Recharts |
| Audio (stretch) | Tone.js or Web Audio API (renderer process) |
| Local Storage | electron-store (persistent across sessions) |
| Build Tool | Electron Forge + Vite |

### Dependencies Checklist

Everything that needs to be installed before development can begin.

#### npm — Production Dependencies

- [ ] `electron` — App shell, main + renderer process runtime
- [ ] `react` — UI rendering in renderer process
- [ ] `react-dom` — React DOM bindings
- [ ] `tailwindcss` — Utility-first CSS framework for all styling
- [ ] `@mediapipe/tasks-vision` — Pose Landmarker (33 body landmarks, 15fps posture loop)
- [ ] `@vladmandic/human` — Face mesh (468 landmarks), emotion/affect detection, blink/EAR (5fps loop)
- [ ] `three` — Bio-Pet 3D rendering (egg, creature, accessories, animations)
- [ ] `@elastic/elasticsearch` — Bulk biometric event indexing + leaderboard queries (main process)
- [ ] `electron-store` — Persistent local storage (calibration, pet state, preferences, sessions, recaps)
- [ ] `recharts` — Session Timeline sparkline charts (Posture, Focus, Stress `AreaChart`)

#### npm — Production Dependencies (Stretch / Tier 4)

- [ ] `tone` — Ambient audio that shifts with wellness state (only if time permits)

#### npm — Dev Dependencies

- [ ] `@electron-forge/cli` — Electron Forge build orchestration
- [ ] `@electron-forge/plugin-vite` — Vite bundler integration for Electron Forge
- [ ] `vite` — Renderer process bundler
- [ ] `typescript` — Type safety across entire codebase
- [ ] `@types/react` — TypeScript types for React
- [ ] `@types/react-dom` — TypeScript types for React DOM
- [ ] `@types/three` — TypeScript types for Three.js
- [ ] `postcss` — Required for Tailwind CSS processing pipeline
- [ ] `autoprefixer` — PostCSS plugin for vendor prefixes (standard Tailwind setup)

#### Homebrew — System Tools

- [ ] `brightness` — macOS screen brightness control from CLI (`brew install brightness`)

#### Xcode Command Line Tools (pre-installed on most Macs)

- [ ] `swiftc` — Swift compiler, needed once to compile `gamma-helper.swift` into a binary (`swiftc gamma-helper.swift -o gamma-helper`)

#### External Services (no install — sign up)

- [ ] Elastic Cloud — Hosted Elasticsearch for biometric telemetry + leaderboard (free 14-day trial, no credit card)
- [ ] Kibana — Comes bundled with Elastic Cloud, used for analytics dashboards

#### Quick Start Commands

```bash
# 1. Scaffold the Electron app
npm init electron-app@latest kinetic -- --template=vite-typescript

# 2. Install production dependencies
npm install react react-dom tailwindcss @mediapipe/tasks-vision @vladmandic/human three @elastic/elasticsearch electron-store recharts

# 3. Install dev dependencies
npm install -D @types/react @types/react-dom @types/three postcss autoprefixer

# 4. Install brightness CLI
brew install brightness

# 5. Compile Swift gamma helper (run once)
swiftc src/main/gamma-helper.swift -o src/main/gamma-helper
```

### App Architecture: Main vs Renderer

```
┌─────────────────────────────────────────────┐
│                MAIN PROCESS                  │
│  (Node.js — system access, no UI)           │
│                                              │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ Brightness   │  │ Gamma / Color Temp   │  │
│  │ Controller   │  │ Controller           │  │
│  │ (brightness  │  │ (CoreGraphics via    │  │
│  │  CLI or      │  │  Swift helper or     │  │
│  │  IOKit)      │  │  python-shell)       │  │
│  └──────┬───────┘  └──────────┬───────────┘  │
│         │                     │              │
│  ┌──────┴─────────────────────┴───────────┐  │
│  │         IPC Message Handler            │  │
│  │  Listens for: posture-update,          │  │
│  │  fatigue-update, ambient-set           │  │
│  └──────┬─────────────────────────────────┘  │
│         │                                    │
│  ┌──────┴─────────────────────────────────┐  │
│  │      Elasticsearch Client              │  │
│  │  Batches biometric events every 5s     │  │
│  │  Handles leaderboard queries           │  │
│  └────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────┘
                   │ IPC (contextBridge)
┌──────────────────┴──────────────────────────┐
│              RENDERER PROCESS                │
│  (Chromium — all UI + ML)                   │
│                                              │
│  ┌────────────┐  ┌────────────────────────┐  │
│  │ Webcam     │  │ ML Pipeline            │  │
│  │ Feed       │→ │ MediaPipe Pose (15fps) │  │
│  │            │  │ Human Face/Emo (5fps)  │  │
│  └────────────┘  └──────────┬─────────────┘  │
│                             │                │
│  ┌──────────────────────────┴─────────────┐  │
│  │         Score Engine                   │  │
│  │  postureScore, fatigueScore,           │  │
│  │  emotionState → lockInScore            │  │
│  │                                        │  │
│  │  Sends scores to main via IPC          │  │
│  └──────────┬─────────────────────────────┘  │
│             │                                │
│  ┌──────────┴──────┐  ┌──────────────────┐   │
│  │ Dashboard UI    │  │ Bio-Pet (Three.js)│   │
│  │ Gauges, charts, │  │ Reacts to scores  │   │
│  │ stats, streak   │  │ Evolves over time │   │
│  └─────────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────┘
```

### Project File Structure

```
kinetic/
├── forge.config.ts                  # Electron Forge configuration
├── package.json
├── tsconfig.json
├── tailwind.config.ts
│
├── src/
│   ├── main/                        # MAIN PROCESS (Node.js)
│   │   ├── main.ts                  # App entry: window creation, IPC registration
│   │   ├── ambient-controller.ts    # Brightness + gamma control with smoothing
│   │   ├── gamma-helper.swift       # Compiled Swift binary for CoreGraphics gamma
│   │   ├── elastic-client.ts        # Elasticsearch bulk indexing + leaderboard queries
│   │   └── ipc-handlers.ts          # All ipcMain.handle/on registrations
│   │
│   ├── preload/
│   │   └── preload.ts               # contextBridge exposing kinetic API to renderer
│   │
│   ├── renderer/                    # RENDERER PROCESS (React + Chromium)
│   │   ├── index.html
│   │   ├── index.tsx                # React root render
│   │   ├── App.tsx                  # Top-level layout, state providers
│   │   │
│   │   ├── ml/                      # ML Pipeline
│   │   │   ├── pose-engine.ts       # MediaPipe / Human pose detection loop (15fps)
│   │   │   ├── face-engine.ts       # Human face mesh + affect loop (5fps)
│   │   │   ├── posture-scorer.ts    # Neck angle, shoulder slant, trunk similarity → score
│   │   │   ├── blink-detector.ts    # EAR calculation, blink counting, fatigue score
│   │   │   ├── stress-estimator.ts  # Emotion + fidget + blink deviation → stress
│   │   │   ├── score-engine.ts      # Central hub: combines all scores, manages state
│   │   │   └── calibration.ts       # 3-second calibration capture + baseline storage
│   │   │
│   │   ├── components/              # React Components
│   │   │   ├── layout/
│   │   │   │   ├── Dashboard.tsx     # Main grid layout
│   │   │   │   ├── Header.tsx        # "Axis" branding + state tabs
│   │   │   │   └── Sidebar.tsx       # Right column (overall, systems, ambient)
│   │   │   │
│   │   │   ├── metrics/
│   │   │   │   ├── MetricCard.tsx    # Reusable: value + unit + status badge
│   │   │   │   ├── OverallGauge.tsx  # SVG circular arc gauge
│   │   │   │   └── StateTabs.tsx     # Upright / Slouching / Fatigued tabs
│   │   │   │
│   │   │   ├── visualisation/
│   │   │   │   ├── WebcamFeed.tsx    # Video element + landmark overlay + FPS counter
│   │   │   │   └── SessionTimeline.tsx # 3 sparkline area charts
│   │   │   │
│   │   │   ├── pomodoro/
│   │   │   │   └── PomodoroTimer.tsx # 25/5/15 min Pomodoro timer, posture nudge, round counter
│   │   │   │
│   │   │   ├── pet/
│   │   │   │   ├── BioPet.tsx        # Main pet container: egg/cat switching, health hysteresis, meta panel
│   │   │   │   ├── CatSprite.tsx     # Ginger cat sprite sheet renderer + AnimatedCat behavior AI
│   │   │   │   ├── PixelSprite.tsx   # SVG pixel-art renderer (PixelSprite, PixelHeart, PixelSweat)
│   │   │   │   ├── PetEffects.tsx    # FloatingHearts, SleepZzz, SweatDrop, PetHealthEffect dispatcher
│   │   │   │   ├── sprite-data.ts    # Egg/cushion grids, crack overlays, cat frame data, iris color map
│   │   │   │   └── pet-animations.css # Health glow, egg wobble, breathing, floating hearts, sleep Zzz
│   │   │   │
│   │   │   ├── recap/
│   │   │   │   ├── SessionRecapCard.tsx  # Wrapped-style recap card renderer
│   │   │   │   ├── RecapCanvas.ts        # Canvas-based PNG export for sharing
│   │   │   │   └── RecapOverlay.tsx      # Modal overlay with share/save buttons
│   │   │   │
│   │   │   ├── panels/
│   │   │   │   ├── SystemsPanel.tsx  # Status dots for each subsystem
│   │   │   │   └── AmbientPanel.tsx  # "Environment stable" + calm/elevated slider
│   │   │   │
│   │   │   ├── leaderboard/
│   │   │   │   └── LeaderBoard.tsx   # Nickname entry + ranked list
│   │   │   │
│   │   │   └── onboarding/
│   │   │       ├── CalibrationScreen.tsx  # "Sit up straight" flow
│   │   │       └── WelcomeScreen.tsx      # First-launch intro
│   │   │
│   │   ├── hooks/
│   │   │   ├── useScores.ts          # Subscribe to score engine updates
│   │   │   ├── useWebcam.ts          # getUserMedia + video ref management
│   │   │   └── useElectronStore.ts   # Read/write to electron-store via IPC
│   │   │
│   │   ├── lib/
│   │   │   ├── math.ts              # clamp, lerp, euclideanDist, cosineSimilarity, stddev
│   │   │   ├── rolling-buffer.ts    # RollingAverage + RollingBuffer classes
│   │   │   ├── constants.ts         # Thresholds, weights, landmark indices, connections
│   │   │   └── types.ts             # All shared TypeScript interfaces
│   │   │
│   │   └── styles/
│   │       └── globals.css           # Tailwind imports + design tokens as CSS vars
│   │
│   └── shared/
│       └── ipc-channels.ts           # Channel name constants shared by main + renderer
│
└── assets/
    ├── icon.png                      # App icon
    └── models/                       # GLTF pet models (if used)
```

### IPC Contract

All channel names defined in `src/shared/ipc-channels.ts`:

```typescript
// src/shared/ipc-channels.ts
export const IPC = {
  // Renderer → Main (fire-and-forget)
  AMBIENT_UPDATE:   'ambient:update',
  BIOMETRIC_EVENT:  'biometric:event',

  // Renderer → Main (request-response)
  LEADERBOARD_GET:    'leaderboard:get',
  LEADERBOARD_UPSERT: 'leaderboard:upsert',
  STORE_GET:          'store:get',
  STORE_SET:          'store:set',
  SESSION_HISTORY:    'analytics:session-history',

  // Recap card
  RECAP_EXPORT:       'recap:export-png',     // renderer sends canvas data → main saves to fs
  RECAP_CLIPBOARD:    'recap:copy-clipboard',  // renderer sends PNG buffer → main writes to clipboard
} as const;
```

```typescript
// Renderer sends every second (fire-and-forget):
window.kinetic.updateAmbient({
  brightness: number,   // 0.0–1.0 (mapped from overall score)
  warmth: number,        // 0.0–1.0 (mapped from posture + fatigue)
});

// Renderer sends every 5 seconds (batched for Elasticsearch):
window.kinetic.sendBiometric({
  timestamp: string,
  sessionId: string,
  posture: { score, neckAngle, shoulderSlant, trunkSimilarity, isSlumping },
  blink:   { rate, avgEAR, prolongedClosures },
  focus:   { score },
  stress:  { score, dominantEmotion, emotionConfidence },
  overall: { score, state },
  ambient: { brightness, warmth, petState },
});

// Renderer requests (async, returns data):
window.kinetic.getLeaderboard()                    → LeaderboardEntry[]
window.kinetic.upsertLeaderboard(entry)            → void
window.kinetic.storeGet(key: string)               → any
window.kinetic.storeSet(key: string, value: any)   → void
```

### Why No Supabase / Extra Database?
- Elasticsearch covers server-side storage (biometrics + leaderboard)
- No user accounts needed — leaderboard is nickname-based
- electron-store handles local state (pet evolution, calibration data, preferences)
- Fewer moving parts = fewer things to break

### Critical Architecture Decision: ML Pipeline

**Test first**: Can `@vladmandic/human` handle both pose AND face/emotion with acceptable accuracy?
- **If yes**: Use Human as single ML backbone (simpler, better performance)
- **If no**: Use MediaPipe for pose + Human for face/emotion, alternating frames (pose on even frames, face on odd)
- **Hard limit**: If combined processing drops below 10fps, disable emotion detection and ship posture + blink rate only

### Performance Strategy
- Pose detection: 15fps (sufficient for posture tracking)
- Emotion detection: 5fps or even 1fps (emotions don't change rapidly)
- Blink rate: Piggyback on face landmarks from emotion detection
- Three.js rendering: 30fps (decoupled from ML inference)
- Brightness/gamma updates: Max 1 per second (smoothed with rolling average, no flickering)
- Elasticsearch indexing: Every 5 seconds, batched via bulk API

### macOS System Control Details

**Brightness** — two options, pick whichever works first:
```bash
# Option A: brightness CLI (brew install brightness)
brightness 0.7  # 0.0 = black, 1.0 = full

# Option B: AppleScript (no install needed)
osascript -e 'tell application "System Events" to key code 145'  # brightness down
```

From Electron main process:
```typescript
import { exec } from 'child_process';
function setBrightness(level: number) {
  exec(`brightness ${level.toFixed(2)}`);
}
```

**Color Temperature (Gamma)** — Swift helper approach:
```swift
// gamma-helper.swift — compile once: swiftc gamma-helper.swift -o gamma-helper
import CoreGraphics

let args = CommandLine.arguments
let redMax   = Float(args[1])!
let greenMax = Float(args[2])!
let blueMax  = Float(args[3])!

CGSetDisplayTransferByFormula(
  CGMainDisplayID(),
  0, 1, redMax,    // red:   min, max, gamma
  0, 1, greenMax,  // green: min, max, gamma
  0, 1, blueMax    // blue:  min, max, gamma
)
```

From Electron main process:
```typescript
function setColorTemp(warmth: number) {
  // warmth 0.0 = neutral, 1.0 = very warm
  const red   = 1.0;
  const green = 1.0 - (warmth * 0.3);  // reduce green
  const blue  = 1.0 - (warmth * 0.4);  // reduce blue more
  exec(`./gamma-helper ${red} ${green} ${blue}`);
}
```

**Ambient mapping** (posture score → system response):
```
Score 80–100 (great):  brightness 0.7–1.0, warmth 0.0 (neutral daylight)
Score 50–80 (okay):    brightness 0.5–0.7, warmth 0.2–0.4 (gentle warm shift)
Score 20–50 (poor):    brightness 0.3–0.5, warmth 0.4–0.7 (noticeable warm)
Score 0–20 (bad):      brightness 0.2–0.3, warmth 0.7–0.9 (strong amber, dim)
```

All transitions smoothed with linear interpolation over 2–3 seconds to prevent jarring jumps.

### Data Model (Elasticsearch)

```typescript
interface BiometricEvent {
  timestamp: string;
  sessionId: string;
  posture: {
    score: number;            // 0-100 composite
    neckAngle: number;        // degrees
    shoulderSlant: number;    // degrees
    trunkSimilarity: number;  // 0-1 cosine similarity
    isSlumping: boolean;
  };
  blink: {
    rate: number;             // blinks per minute
    avgEAR: number;           // rolling average eye aspect ratio
    prolongedClosures: number;
  };
  focus: { score: number };
  stress: {
    score: number;
    dominantEmotion: string;
    emotionConfidence: number;
  };
  overall: { score: number; state: 'upright' | 'slouching' | 'fatigued' };
  ambient: { brightness: number; warmth: number; petState: string };
}
```

---

## Core Functionality — Detailed Specifications

### 1. Posture Detection Engine

**Reference**: Based on findings from "A Deep Dive into MediaPipe Pose for Postural Assessment" (IEEE, 2024) — the paper recommends using **2D MediaPipe models** (not 3D) for frontal-plane posture analysis, as 3D uplifting introduces severe distortions at higher model complexities. We use `modelComplexity: 1` (medium) which balances accuracy and speed.

#### MediaPipe Pose Landmarks Used

From MediaPipe's 33 body landmarks, we use these for seated posture assessment:

| Index | Landmark | Purpose |
|-------|----------|---------|
| 0 | Nose | Head position reference |
| 7 | Left Ear | Head tilt detection |
| 8 | Right Ear | Head tilt detection |
| 11 | Left Shoulder | Shoulder slant, slouch |
| 12 | Right Shoulder | Shoulder slant, slouch |
| 23 | Left Hip | Trunk alignment base |
| 24 | Right Hip | Trunk alignment base |

#### Angle Calculations (Trigonometry)

All angles calculated using `atan2` for quadrant-correct results:

```typescript
function calculateAngle(a: Point, b: Point, c: Point): number {
  // Returns angle at point b formed by line segments ba and bc
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}
```

**Metric 1 — Neck Inclination Angle**:
- Points: Ear (7/8) → Shoulder (11/12) → Hip (23/24)
- Measures how far the head leans forward from the vertical trunk line
- Ideal: ~170–180° (ear directly above shoulder above hip)
- Slouching: <150° (head jutting forward — "tech neck")
- The Electron + MediaPipe posture coach paper confirms <150° as the slouch threshold

```typescript
const neckAngle = calculateAngle(
  landmarks[7],  // left ear
  landmarks[11], // left shoulder
  landmarks[23]  // left hip
);
```

**Metric 2 — Shoulder Slant (Tilt)**:
- Angle of the line between left shoulder (11) and right shoulder (12) relative to horizontal
- Calculated as: `Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x) * (180 / Math.PI)`
- Ideal: ~0° (shoulders level)
- Poor: >5° tilt (displayed in the Digital Twin as "X.X° tilt")

```typescript
const shoulderSlant = Math.abs(
  Math.atan2(
    landmarks[12].y - landmarks[11].y,
    landmarks[12].x - landmarks[11].x
  ) * (180 / Math.PI)
);
```

**Metric 3 — Trunk Lean (Forward Slouch)**:
- Cosine similarity between the user's current shoulder-hip vector and their calibrated "upright" vector
- High similarity (close to 1.0) = maintaining good posture
- Low similarity = slouching or leaning

```typescript
function cosineSimilarity(vecA: [number, number], vecB: [number, number]): number {
  const dot = vecA[0] * vecB[0] + vecA[1] * vecB[1];
  const magA = Math.sqrt(vecA[0] ** 2 + vecA[1] ** 2);
  const magB = Math.sqrt(vecB[0] ** 2 + vecB[1] ** 2);
  return dot / (magA * magB);
}

// Current shoulder→hip vector vs calibrated upright vector
const currentVec: [number, number] = [
  midHip.x - midShoulder.x,
  midHip.y - midShoulder.y
];
const trunkSimilarity = cosineSimilarity(currentVec, calibratedUprightVec);
```

**Metric 4 — Shoulder Symmetry**:
- Compare left vs right shoulder Y positions
- Large vertical difference = one shoulder raised/dropped (asymmetric posture)

#### Composite Posture Score (0–100)

```typescript
function calculatePostureScore(
  neckAngle: number,
  shoulderSlant: number,
  trunkSimilarity: number
): number {
  // Neck: 180° = perfect (100), <140° = terrible (0)
  const neckScore = clamp(((neckAngle - 140) / 40) * 100, 0, 100);

  // Shoulder slant: 0° = perfect (100), >10° = terrible (0)
  const shoulderScore = clamp((1 - shoulderSlant / 10) * 100, 0, 100);

  // Trunk similarity: 1.0 = perfect (100), <0.85 = terrible (0)
  const trunkScore = clamp(((trunkSimilarity - 0.85) / 0.15) * 100, 0, 100);

  // Weighted composite
  return Math.round(
    neckScore * 0.45 +      // neck is the biggest posture indicator
    shoulderScore * 0.20 +   // shoulder tilt matters
    trunkScore * 0.35        // overall trunk alignment
  );
}
```

#### Calibration Flow
1. On first launch, prompt: "Sit up straight and look at the screen"
2. Capture 3 seconds of landmarks (45 frames at 15fps)
3. Average all frames to get the "ideal" baseline
4. Store calibrated vectors + angles in electron-store
5. All scoring is relative to this baseline — personalised per user

### 2. Fatigue / Blink Rate Detection

**Approach**: Use `@vladmandic/human` face mesh (468 landmarks) to detect eye state and calculate blink rate.

#### Eye Aspect Ratio (EAR)

The standard formula from Soukupová & Čech (2016), adapted for MediaPipe face mesh landmarks:

```typescript
// MediaPipe Face Mesh eye landmark indices
const LEFT_EYE = {
  top: [159, 158, 157],    // upper eyelid
  bottom: [145, 144, 153], // lower eyelid
  left: 33,                // inner corner
  right: 133               // outer corner
};

const RIGHT_EYE = {
  top: [386, 385, 384],
  bottom: [374, 373, 380],
  left: 362,
  right: 263
};

function eyeAspectRatio(landmarks: Point[], eye: typeof LEFT_EYE): number {
  // Vertical distances (average of 3 pairs for robustness)
  const verticalDists = eye.top.map((topIdx, i) =>
    euclideanDist(landmarks[topIdx], landmarks[eye.bottom[i]])
  );
  const avgVertical = verticalDists.reduce((a, b) => a + b) / verticalDists.length;

  // Horizontal distance
  const horizontal = euclideanDist(landmarks[eye.left], landmarks[eye.right]);

  return avgVertical / horizontal;
}

// Average both eyes
const ear = (eyeAspectRatio(face, LEFT_EYE) + eyeAspectRatio(face, RIGHT_EYE)) / 2;
```

#### Blink Detection Logic

```
EAR threshold: 0.20 (below this = eyes closed)
Minimum blink duration: 1 frame
Maximum blink duration: 5 frames (longer = prolonged closure, not a blink)
```

- Track EAR each frame
- When EAR drops below 0.20 → start a "potential blink" counter
- When EAR rises back above 0.20:
  - If counter was 1–5 frames → register as a blink
  - If counter was >5 frames → register as prolonged closure (fatigue signal)

#### Blink Rate → Fatigue Score

```
Normal blink rate: 15–20 blinks/min (baseline established during calibration)
```

Fatigue increases when:
- Blink rate drops significantly below baseline (staring / cognitive overload)
- Blink rate rises significantly above baseline (eye strain / dryness)
- Prolonged eye closures increase (drowsiness)
- Average EAR decreases over time (droopy eyelids)

```typescript
function calculateFatigueScore(
  currentBlinkRate: number,    // blinks per minute (rolling 60s window)
  baselineBlinkRate: number,   // from calibration
  avgEAR: number,              // rolling average EAR over 30s
  prolongedClosures: number    // count in last 5 minutes
): number {
  // Blink rate deviation (too high or too low = fatigued)
  const blinkDeviation = Math.abs(currentBlinkRate - baselineBlinkRate) / baselineBlinkRate;
  const blinkScore = clamp((1 - blinkDeviation) * 100, 0, 100);

  // EAR score — lower average EAR = droopier eyes = more fatigued
  // Normal open EAR is ~0.25-0.35, drowsy is ~0.20-0.25
  const earScore = clamp(((avgEAR - 0.18) / 0.15) * 100, 0, 100);

  // Prolonged closures penalty
  const closurePenalty = clamp(prolongedClosures * 15, 0, 50);

  return Math.round(
    Math.max(0, blinkScore * 0.4 + earScore * 0.4 + (100 - closurePenalty) * 0.2)
  );
}
```

### 3. Stress / Affect Estimation

Stress is estimated from a combination of signals (not a single ML "emotion" output):

```typescript
function calculateStressScore(
  emotionState: string,        // from @vladmandic/human affect engine
  emotionConfidence: number,
  postureVariance: number,     // how much posture score fluctuates (fidgeting)
  blinkRateDeviation: number   // from fatigue module
): number {
  // Emotion component: angry, sad, fearful = high stress. happy, neutral = low stress.
  const emotionStress: Record<string, number> = {
    angry: 85, fearful: 80, sad: 70, disgusted: 65,
    surprised: 40, neutral: 15, happy: 10
  };
  const emotionScore = (emotionStress[emotionState] ?? 50) * emotionConfidence;

  // Fidgeting: high posture variance = restlessness = stress
  // Measured as standard deviation of posture scores over last 60 seconds
  const fidgetScore = clamp(postureVariance * 5, 0, 100);

  // Elevated blink rate also correlates with stress
  const blinkStress = clamp(blinkRateDeviation * 50, 0, 100);

  return Math.round(
    emotionScore * 0.4 + fidgetScore * 0.35 + blinkStress * 0.25
  );
}
```

### 4. Focus Score

Inverse relationship with stress and fatigue:

```typescript
function calculateFocusScore(
  postureScore: number,
  fatigueScore: number,   // higher = more fatigued = less focused
  stressScore: number,     // higher = more stressed = less focused
  postureStability: number // low variance over last 2 min = stable = focused
): number {
  return Math.round(
    postureScore * 0.3 +
    (100 - fatigueScore) * 0.25 +
    (100 - stressScore) * 0.20 +
    postureStability * 0.25
  );
}
```

### 5. Overall Score

The composite "Lock In" / Overall score shown in the big circular gauge:

```typescript
function calculateOverallScore(
  postureScore: number,
  focusScore: number,
  stressScore: number
): number {
  return Math.round(
    postureScore * 0.40 +
    focusScore * 0.35 +
    (100 - stressScore) * 0.25
  );
}
```

### 6. Digital Twin (Stick Figure Visualisation)

The Digital Twin is a 2D stick figure rendered on a canvas that mirrors the user's pose landmarks in real-time.

#### What It Shows
- **33 body landmarks** connected by lines (skeleton overlay)
- Color-coded by state: green (upright/good), amber (slouching/fair), red (fatigued/poor)
- **Tilt angle** displayed below the figure (e.g., "0.5° tilt", "2.7° tilt") — derived from shoulder slant
- **Alignment score** displayed as big number (e.g., "88 /100") — this IS the posture score

#### Rendering
- Canvas element in the dashboard, left panel
- Map MediaPipe normalised landmarks (0–1) to canvas pixel coordinates
- Draw circles at each landmark, lines between connected pairs
- Update color based on current posture state:
  - Green (#4A7C59): posture ≥ 70
  - Amber (#C4962C): posture 40–69
  - Red (#C0392B): posture < 40
- Smooth position updates (lerp between frames to avoid jitter)

#### Skeleton Connections
```typescript
const POSE_CONNECTIONS = [
  // Head
  [0, 7], [0, 8],           // nose to ears
  // Torso
  [11, 12],                  // shoulder to shoulder
  [11, 23], [12, 24],        // shoulders to hips
  [23, 24],                  // hip to hip
  // Arms
  [11, 13], [13, 15],        // left arm
  [12, 14], [14, 16],        // right arm
  // Legs (if visible — seated may not show)
  [23, 25], [25, 27],        // left leg
  [24, 26], [26, 28],        // right leg
];
```

### 7. Dashboard Layout

Based on the mockup designs, the dashboard has this grid layout:

```
┌─────────────────────────────────────────────────────────────┐
│  Axis  bio-responsive workspace     [Upright] [Slouching] [Fatigued]  │
├──────────────┬──────────────────────────────┬───────────────┤
│              │  ┌─Posture──┐ ┌─Blink Rate─┐ │   OVERALL    │
│  POMODORO    │  │  88 /100 │ │  17 bpm    │ │              │
│  TIMER       │  │  Good    │ │  Good      │ │    84        │
│              │  └──────────┘ └────────────┘ │   (gauge)    │
│  [Focus][Brk]│  ┌─Focus────┐ ┌─Stress─────┐ │              │
│  ○ 24:37    │  │  82 /100 │ │  18 /100   │ ├──────────────┤
│             │  │  Good    │ │  Good      │ │  SYSTEMS     │
│  ● ● ○ ○   │  └──────────┘ └────────────┘ │  Pose Det  ● │
│  [Start][↺] ├──────────────────────────────┤  Face Mesh ● │
│              │  WEBCAM — MEDIAPIPE HOLISTIC │  Affect    ● │
├──────────────┤  (live feed with overlay)    │  Ambient   ● │
│  BIO-PET     │  30 fps · 543 pts            ├──────────────┤
│              ├──────────────────────────────┤  AMBIENT     │
│  (creature)  │  SESSION TIMELINE            │  RESPONSE    │
│  Thriving    │  Posture ───── 88            │  Environment │
│              │  Focus   ───── 82            │  stable.     │
│              │  Stress  ───── 18            │  [calm ▊ elev]│
└──────────────┴──────────────────────────────┴───────────────┘
```

#### Metric Cards (4 cards, top center)
Each card shows:
- Metric name (Posture, Blink Rate, Focus, Stress)
- Value (number + unit)
- Status badge: "Good" (green), "Fair" (amber), "Poor" (red)

Status thresholds:
| Metric | Good | Fair | Poor |
|--------|------|------|------|
| Posture | ≥70 | 40–69 | <40 |
| Blink Rate | 12–22 bpm | 8–11 or 23–28 bpm | <8 or >28 bpm |
| Focus | ≥70 | 40–69 | <40 |
| Stress | <30 | 30–60 | >60 |

#### State Tabs (top right of header)
Three state indicators: **Upright**, **Slouching**, **Fatigued**
- Only one active at a time, determined by overall score thresholds
- Upright: overall ≥ 65
- Slouching: overall 30–64
- Fatigued: overall < 30

#### Systems Panel
Shows status indicators (green/amber/red dots) for:
- Pose Detection (MediaPipe running?)
- Face Mesh (Human face module running?)
- Affect Engine (emotion detection running?)
- Ambient Ctrl (brightness/gamma responding?)

#### Ambient Response Panel
- Text description of current ambient state ("Environment stable", "Elevated strain. Blue light reduced, UI contrast softened.")
- Visual slider showing calm → elevated range

#### Session Timeline
Three mini sparkline charts showing Posture, Focus, and Stress over the current session. Each with current value label.

### 8. Bio-Pet — Lifecycle System

The pet is what makes people actually care about their posture. Not because a health app guilt-trips them, but because they don't want their creature to get sick. The emotional attachment IS the product.

#### Lifecycle: Egg → Creature → Evolution

Your pet starts as an **egg**. Good posture hatches it. Sustained focus levels it up. Slouching makes it sick.

| Stage | Name | Unlock Condition | Visual |
|-------|------|-----------------|--------|
| 0 | **Egg** | Default start state | Resting egg, subtle glow pulse, cracks appear as upright time accumulates |
| 1 | **Hatchling** | 10 min cumulative upright time | Tiny creature emerges from egg shell, wobbly idle animation |
| 2 | **Fledgling** | 30 min cumulative | Slightly bigger, steadier, gains a small accessory (scarf/hat) |
| 3 | **Companion** | 120 min cumulative | Full-sized, smooth animations, glowing aura, second accessory |
| 4 | **Guardian** | 300 min cumulative | Larger, particle effects, wings or crown, confident posture |
| 5 | **Ascended** | 600 min cumulative | Full glow, trailing particles, halo, all accessories equipped |

- "Cumulative upright time" = total minutes with Overall score ≥ 65 across ALL sessions
- Stored in electron-store, persists across app restarts
- Evolution is permanent — you never de-evolve. But your pet CAN get sick.

#### Health States (Real-Time, Driven by Overall Score)

Within any evolution stage, the pet has 3 health states:

| State | Overall Score | Visual | Description |
|-------|--------------|--------|-------------|
| **Thriving** | ≥65 | Glowing, happy face, green tones, bouncy | "Upright posture, steady blink rate, low stress. Your pet glows and blooms with energy." |
| **Fading** | 30–64 | Neutral/concerned, amber tones, dimmer glow | "Shoulders rounding, blink rate dropping. Your pet loses petals and its glow dims." |
| **Wilting** | <30 | Sad/sick, red tones, drooping, shaking | "Deep slouch, eye fatigue, high cognitive load. Your pet curls inward, urging a reset." |

**Wilting is the "sick" state.** The pet visually droops, shivers, and loses color. At higher evolution levels, the contrast is more dramatic — a Stage 4 Guardian going sick looks *wrong* in a way that a Hatchling doesn't. This creates stronger emotional pressure to fix your posture as the pet gets more impressive.

#### Accessories & Cosmetics

Accessories are unlocked by session milestones and serve as visual trophies:

| Accessory | Unlock Condition |
|-----------|-----------------|
| Scarf | First session > 30 min with avg overall ≥ 60 |
| Hat | 3 sessions completed |
| Glasses | Best streak > 45 min |
| Cape | Reach Stage 3 (Companion) |
| Wings | Reach Stage 4 (Guardian) |
| Halo | Reach Stage 5 (Ascended) |
| Crown | Land #1 on the Lock In Board |

- Accessories persist in electron-store
- Shown on the pet AND on the leaderboard avatar
- Unlocking an accessory triggers a celebration animation + a toast notification

Each pet state card shows: Posture score, Focus score, Stress score.

### 9. Session Recap Card — "Wrapped-Style" Daily Summary

At the end of each session (or when the user clicks "End Session"), AXIS generates a shareable recap card. Think Spotify Wrapped but for your posture. Something people screenshot and post.

#### What the Card Shows

```
┌──────────────────────────────────────┐
│         🌿 AXIS RECAP             │
│         March 13, 2026               │
│                                      │
│    ┌──────────────────────────┐      │
│    │     [Pet at current      │      │
│    │      evolution stage]    │      │
│    │       Stage 3            │      │
│    │      Companion           │      │
│    └──────────────────────────┘      │
│                                      │
│  You sat upright for                 │
│       3.2 hours                      │
│                                      │
│  Neck angle better than              │
│       78% of users                   │
│                                      │
│  Best streak: 47 min                 │
│  Avg posture: 74 / 100              │
│  Blink rate: 17 bpm (healthy)       │
│                                      │
│  Pet evolved to Stage 3! 🎉         │
│  Unlocked: Cape accessory            │
│                                      │
│  ──────────────────────────          │
│  kinetic.app        [Share] [Save]   │
└──────────────────────────────────────┘
```

#### Key Stats on the Card
- **Upright duration**: Total time with Overall ≥ 65, formatted as hours
- **Percentile rank**: "Neck angle better than X% of users" — computed from Elasticsearch leaderboard data. If Elasticsearch is unavailable, skip this line.
- **Best streak**: Longest consecutive run of Overall ≥ 65
- **Average posture score** for the session
- **Blink rate** with a qualitative label (healthy / strained / fatigued)
- **Pet milestone** if one happened this session (evolution, accessory unlock)
- **Pet visual** rendered at its current stage with equipped accessories

#### Implementation

```typescript
interface SessionRecap {
  date: string;
  uprightMinutes: number;
  totalMinutes: number;
  avgPosture: number;
  avgFocus: number;
  avgStress: number;
  avgOverall: number;
  bestStreak: number;            // minutes
  avgBlinkRate: number;
  percentileRank: number | null; // null if Elasticsearch unavailable
  petLevel: number;
  petTitle: string;
  newAccessories: string[];      // accessories unlocked this session
  evolved: boolean;              // did pet evolve this session?
  previousLevel: number | null;  // if evolved, what was the old level?
}
```

#### Rendering the Card
- The card is a React component (`SessionRecapCard.tsx`) that renders onto a `<canvas>` for easy export
- **Share button**: Uses `navigator.clipboard` to copy the canvas as a PNG image (Electron supports this via `nativeImage`)
- **Save button**: Uses Electron's `dialog.showSaveDialog` to save as PNG
- **Auto-generate**: Card is generated on session end and shown as a modal overlay

#### Percentile Calculation
```typescript
// Query Elasticsearch for all users' avg posture scores
// Count how many are below the current user's score
// percentile = (usersBelow / totalUsers) * 100

async function calculatePercentile(userAvgPosture: number): Promise<number | null> {
  const leaderboard = await window.kinetic.getLeaderboard();
  if (leaderboard.length < 3) return null; // not enough data
  const below = leaderboard.filter(e => e.avgOverallScore < userAvgPosture).length;
  return Math.round((below / leaderboard.length) * 100);
}
```

#### Blink Rate Label
```typescript
function blinkRateLabel(rate: number): string {
  if (rate >= 12 && rate <= 22) return 'healthy';
  if (rate >= 8 && rate <= 28) return 'slightly strained';
  return 'fatigued';
}
```

---

## Feature Prioritization

### Tier 1: MUST SHIP — The Demo-able Core
1. Webcam posture detection (neck angle + shoulder slant + trunk lean → composite score 0-100) — DONE (Plan 01 accuracy fix applied)
2. Calibration flow (sit up straight for 3 seconds → personalized baseline) — DONE (Plan 01 race condition fixed)
3. ~~Digital Twin — live stick figure~~ → **Pomodoro Timer** (25/5/15 min cycles, posture-aware nudge, round counter) — DONE
4. **Real ambient screen response**: macOS brightness + color temperature shifts driven by posture score — DONE (Plan 05 smoothing applied)
5. Dashboard with 4 metric cards (Posture, Blink Rate, Focus, Stress) + overall circular gauge — DONE
6. **Blink rate detection** via EAR + fatigue scoring — DONE (fixed, stable at 5fps)

### Tier 2: SHOULD SHIP — Full Product Feel
7. Stress estimation (affect engine + posture variance + blink deviation) — DONE
8. Focus score (composite of posture stability + inverse fatigue + inverse stress) — DONE
9. Session timeline sparkline charts (Posture, Focus, Stress over time) — DONE
10. **Bio-Pet lifecycle**: Pixel-art ginger cat. Egg → hatch → 5 evolution stages. 3 health states (Thriving/Fading/Wilting) with behavior AI (walk, run, sleep, groom). Slouch = pet sleeps. *(Implemented as 2D sprite sheet, not Three.js)* — **needs Plan 02 persistence + unlocks**
11. Multi-signal ambient response (posture + fatigue both drive brightness/warmth) — DONE (Plan 05 smoothing applied)
12. Systems status panel + Ambient Response panel — DONE (systems panel removed from user-facing UI)

### Tier 3: HIGH IMPACT — Shareability & Retention
13. **Session Recap Card** — Spotify Wrapped-style end-of-session summary. Shareable PNG. Pet visual, stats, percentile rank, milestones.
14. Streak counter + pet accessories (unlocked by milestones, visible on pet and leaderboard)
15. **Lock In Board** — competitive leaderboard (Elasticsearch-backed, nickname entry, pet at current evolution + accessories)
16. Elasticsearch data pipeline: biometric events indexed every 5s

### Tier 4: NICE TO HAVE — Extras
17. Elasticsearch analytics dashboard (session history, trends)
18. Kibana visualization
19. Ambient audio shifting with wellness state
20. Percentile rank on recap card (requires Elasticsearch leaderboard data)

### What to CUT if behind:
- Cut bottom-up (20 → 12)
- **NEVER cut**: Posture detection, Pomodoro timer, real brightness/gamma ambient response, dashboard — these ARE the product
- **Priority order for remaining Plans**: Plan 08 (welcome screen) > Plan 06+07 (pet names + egg paw) > Plan 09 (leaderboard) > Plan 02 (pet persistence) > Plan 04 (gamification) > Plan 03 (UI polish)
- Plan 08 (welcome screen) is the first thing judges see — sets the tone for the entire demo
- Plans 06+07 (cat names + paw) are quick wins that make the pet feel intentional, not generic
- Plan 09 (leaderboard) adds competitive visual impact — podium and avatars make it demo-worthy
- Pet accessories rendering (Plan 02) is visual polish — can ship without it. Auto-save is more critical than accessories.
- If Elasticsearch isn't ready, the entire app works without it — recap card works locally, leaderboard falls back to local data
- The recap card is high-priority because it's what gets screenshotted and shared — a built-in growth loop

---

## Execution Order & Build Phases

**For the coding agent**: Execute all phases (0 through 8) sequentially and autonomously. Do NOT stop to ask for confirmation between phases. After each phase, run the corresponding tests from the Testing section, fix any failures, then immediately proceed to the next phase. If you hit a blocker that cannot be resolved, skip it, note what failed, and continue with the next phase. The goal is a fully working app at the end — keep moving.

Build the riskiest, most uncertain pieces first so you fail fast, and layer polish on top.

### Phase 0: Electron Scaffold + Webcam -- DONE
**Goal**: A running Electron app with webcam feed displayed.

- [x] Scaffold with Electron Forge: `npm init electron-app@latest kinetic -- --template=vite-typescript`
- [x] Add React + Tailwind to the renderer
- [x] Set up the main/renderer/preload file structure
- [x] Configure `contextBridge` + `ipcMain`/`ipcRenderer` for secure IPC
- [x] Get webcam feed rendering in a `<video>` element in the renderer
- [x] Verify camera permission prompt works
- [x] Git repo init, push initial commit, everyone clones
- [x] Install ML deps: `@mediapipe/tasks-vision`, `@vladmandic/human`

**Output**: An Electron window showing your live webcam feed. Everyone can run it.

**Who**: 1 person scaffolds, pushes. Everyone else clones and verifies it runs.

### Phase 1: ML Spike — Posture Detection + Digital Twin -- DONE
**Goal**: Webcam → posture score on screen + live stick figure. This is the riskiest piece — if this doesn't work, nothing works.

- [x] **ML library test**: Load `@vladmandic/human` in the renderer with pose config enabled. Draw landmarks on a canvas overlay. Measure FPS. Key questions:
  - Does it detect landmarks 0, 7, 8, 11, 12, 23, 24 (nose, ears, shoulders, hips) accurately?
  - What FPS do we get? (Need ≥10fps minimum)
  - If accuracy is bad → switch to `@mediapipe/tasks-vision` Pose Landmarker
- [x] **Digital Twin renderer**: Canvas component that draws the stick figure:
  - Map normalised landmarks to canvas coordinates
  - Draw POSE_CONNECTIONS lines + circles at joints (see Section 6 in Core Functionality)
  - Color-code: green (good), amber (fair), red (poor)
  - Display tilt angle below the figure
  - Smooth positions with lerp between frames
- [x] **Posture algorithm**: Implement the 3-metric system (see Section 1 in Core Functionality):
  - **Neck Inclination**: `atan2` angle at shoulder formed by ear-shoulder-hip. Threshold: <150° = slouching
  - **Shoulder Slant**: `atan2` of shoulder-to-shoulder line vs horizontal. Display as "X.X° tilt"
  - **Trunk Lean**: Cosine similarity between current shoulder→hip vector and calibrated upright vector
  - **Composite score**: `neckScore * 0.45 + shoulderScore * 0.20 + trunkScore * 0.35`
- [x] **Calibration**: On first launch, prompt "Sit up straight and look at the screen". Capture 3 seconds (45 frames at 15fps). Average landmarks to get baseline vectors + angles. Store in electron-store.
- [x] **Wire to UI**: Show posture score as big number + the Digital Twin stick figure side by side. Score color coded: green ≥70, amber 40–69, red <40.

**Output**: Electron app with live webcam feed, a Digital Twin stick figure that moves with you, and a posture score that drops when you slouch.

**Risk mitigation**: If cosine similarity doesn't work well, fall back to just neck angle + shoulder slant (two metrics). Two signals is enough.

### Phase 2: macOS Ambient Control -- DONE
**Goal**: Posture score drives your actual screen brightness and color temperature. This is what makes AXIS a real product.

- [x] **Brightness helper**:
  - Install `brightness` CLI: `brew install brightness`
  - Write a `setBrightness(level: number)` function in main process that calls `brightness ${level}`
  - Test: can we smoothly step from 1.0 → 0.3 → 1.0?
  - Fallback if `brightness` CLI doesn't work: use AppleScript via `osascript`
- [x] **Gamma / color temp helper**:
  - Write and compile `gamma-helper.swift` (see Technical Architecture section above)
  - Write a `setColorTemp(warmth: number)` function in main process
  - Test: verify warm shift is visible, reversible, and doesn't persist after app quits
  - **Important**: Register an `app.on('will-quit')` handler that resets gamma to (1.0, 1.0, 1.0) so the screen returns to normal when the app closes
- [x] **IPC wiring**: Renderer sends `ambient:update` events with `{ brightness, warmth }` via IPC. Main process receives and calls the helpers. Rate-limit to max 1 update per second.
- [x] **Smoothing + mapping**: Don't send raw scores to brightness. Instead:
  - Keep a rolling average of posture score (last 10 seconds)
  - Map the smoothed score to brightness + warmth (see mapping table in architecture)
  - Interpolate between current and target brightness/warmth over 2–3 seconds (use `setInterval` with small steps, e.g., 50ms intervals over 2 seconds = 40 steps)
  - This prevents flickering and makes the effect feel ambient, not reactive

**Output**: Slouch → your entire Mac screen slowly dims and warms to amber over 2–3 seconds. Sit up → it gradually returns to normal. Across ALL apps, not just the Electron window.

**Critical**: This phase is what separates AXIS from every other wellness app. Spend time getting the feel right.

### Phase 3: Dashboard -- DONE
**Goal**: Build the full dashboard matching the mockup design (see Section 7 in Core Functionality).

- [x] **Layout skeleton**: Implement the grid layout from the mockup:
  - Left column: Digital Twin (already built) + Bio-Pet placeholder
  - Center top: 4 metric cards (Posture, Blink Rate, Focus, Stress) — show posture score live, others as "--" placeholder
  - Center middle: Webcam feed with MediaPipe overlay + FPS/landmark count
  - Center bottom: Session Timeline (3 sparkline charts)
  - Right column: Overall gauge + Systems panel + Ambient Response panel
  - Header: "Axis bio-responsive workspace" + state tabs (Upright / Slouching / Fatigued)
- [x] **Metric cards**: Reusable card component with: metric name, value, unit, status badge (Good/Fair/Poor). Use threshold table from Section 7.
- [x] **Overall circular gauge**: Custom SVG arc gauge showing 0–100. Color transitions: green → amber → red. For now, just mirrors posture score (other inputs come in Phase 4).
- [x] **Session Timeline**: Three Recharts sparkline `AreaChart` components showing Posture, Focus, Stress over session. Rolling buffer of 300 data points (1/sec for 5 min). Use `isAnimationActive={false}` for performance.
- [x] **Systems panel**: Status indicators with green/amber/red dots for: Pose Detection, Face Mesh, Affect Engine, Ambient Ctrl. Wired to actual system state. *(Removed from user-facing dashboard during polish — internal debug info)*
- [x] **Ambient Response panel**: Text description of current ambient state + calm-to-elevated slider visualisation.
- [x] **State tabs**: Wire the Upright/Slouching/Fatigued tabs to overall score thresholds (≥65 / 30–64 / <30). Active tab changes dashboard color theme subtly.

**Output**: The full dashboard from the mockup, with live posture data flowing. Blink/Focus/Stress cards show placeholder until Phase 4.

### Phase 4: Blink Rate + Stress + Focus -- DONE
**Goal**: Complete all 4 metrics. The dashboard goes from 1 live metric to 4.

- [x] **Face mesh activation**: Enable `@vladmandic/human` face module. Run at 5fps in a separate loop from posture (8fps). Verify it detects 468 face landmarks including eye landmarks. *(Now uses shared Human singleton for both pose + face)*
- [x] **EAR + Blink detection**: Implement the EAR formula from Section 2:
  - Calculate EAR for both eyes each frame, average them
  - Detect blinks: EAR < 0.20 for 1–5 frames then recovers
  - Track blinks per minute (rolling 60-second window)
  - Detect prolonged closures (EAR < 0.20 for >5 frames)
  - Display blink rate in bpm on the Blink Rate card
- [x] **Stress estimation**: Implement stress score from Section 3:
  - Emotion component from `@vladmandic/human` affect module (angry/fearful = high stress, happy/neutral = low)
  - Posture variance component (fidgeting detection — stddev of posture score over 60s window)
  - Blink rate deviation component
  - Composite: `emotionScore * 0.4 + fidgetScore * 0.35 + blinkStress * 0.25`
- [x] **Focus score**: Implement from Section 4:
  - `postureScore * 0.3 + (100 - fatigueScore) * 0.25 + (100 - stressScore) * 0.20 + postureStability * 0.25`
  - Posture stability = inverse of posture variance over last 2 minutes
- [x] **Overall score + multi-signal ambient**:
  - Overall = `postureScore * 0.40 + focusScore * 0.35 + (100 - stressScore) * 0.25`
  - Update ambient mapping: posture drives warmth, fatigue (derived from blink) drives brightness dimming
  - Wire all 4 metric cards + overall gauge to live data
  - Wire session timeline charts to live data

**Output**: All 4 metric cards live. Overall gauge accurate. Ambient responds to multiple signals. Dashboard fully functional.

### Phase 5: Bio-Pet Lifecycle -- DONE (with deviations from original plan)

> **Architecture change**: The pet was rebuilt as a **2D pixel-art + sprite sheet system** instead of Three.js. This is faster to render, fits the aesthetic better, and ships more reliably than 3D models.

- [x] **Egg state** (`BioPet.tsx`, `sprite-data.ts`, `PixelSprite.tsx`)
  - Pixel-art SVG egg rendered via `PixelSprite` (rect-based SVG, `imageRendering: pixelated`)
  - Rests on a pixel-art cushion beneath it
  - Crack overlays at ≥85% (`eggCracks85`) and ≥95% (`eggCracks95`) egg crack progress — rendered as SVG overlay on top of the egg
  - Glow effect on the egg shell when cracking (CSS: `egg-shell-glow--cracking`, `egg-shell-glow--hatching`)
  - Wobble animation that fires periodically — frequency increases as crack progress rises (every 10s at 0%, every 4.5s at 50%, every 1.8s at 85%, every 0.8s at 95%)
  - Progress persists in electron-store — egg resumes with cracks on relaunch
  - Dev toggle button (egg ↔ cat preview) visible during stage 0
- [x] **Base creature** (`CatSprite.tsx`, ginger-cat.png sprite sheet)
  - **Ginger cat sprite sheet** (352×1696 px, 32×32 frames, 11 cols × 53 rows) — a real pixel-art cat asset
  - `CatSprite`: renders a single frame using CSS background-position trick
  - `AnimatedCat`: full behavior simulation with a random action scheduler:
    - **Thriving**: idle sitting/standing, yawning, grooming (wash), scratching, meowing, walking and running (with boundary bounce), rare naps
    - **Fading**: mostly idle lying/crouching, occasional yawns, less frequent movement
    - **Wilting**: locked into sleep animations (curl, flat, belly-up) held for 30–90 seconds at a time
    - Walk speed varies (walk vs run), direction reverses at ±35px boundaries
    - Breathing CSS animation during non-sleep states
- [x] **Health states** with hysteresis (`BioPet.tsx`)
  - **Thriving** (Overall ≥ 65): active animations, floating pixel hearts (`FloatingHearts`), green glow
  - **Fading** (30–64): slower/lazier animations, amber glow, no overlay effect
  - **Wilting** (< 30): sleep-only animations, floating sleep Zzz's (`SleepZzz`), red glow
  - **3-second hysteresis** before health state commits — prevents flickering on brief score dips
  - CSS glow ring around pet scene changes color with health state
- [x] **Pet effects** (`PetEffects.tsx`, `PixelSprite.tsx`)
  - `FloatingHearts`: 3 pixel-art hearts with staggered CSS float animations (Thriving)
  - `SleepZzz`: 3 diagonal floating 'z' characters (Wilting)
  - `SweatDrop`: pixel-art sweat drop component (built, reserved for Fading enhancement)
  - `PixelHeart` / `PixelSweat`: SVG pixel art sub-components
- [x] **Meta panel** beneath the pet scene
  - Stage number + stage name label
  - Health pill (colored dot + "Thriving" / "Fading" / "Wilting")
  - Evolution progress bar (color follows health state)
  - Stat chips: Posture, Focus, Stress, Time locked in
- [x] **Evolution stage tracking** — stages 0–5, driven by `totalLockedInMinutes`
  - Progress bar shows % toward next stage
  - Stage names: Egg → Hatchling → Fledgling → Companion → Guardian → Ascended
- [x] **Streak system** — tracked in score-engine, displayed in meta panel as locked-in minutes

### Pet — Still Pending (from Plan 2)

- [ ] **Auto-save pet state every 30 seconds** (currently only saves on "End Session")
- [ ] **Save pet on window close / cleanup** so progress survives force-quit
- [ ] **Hat unlock** — "3 sessions completed" condition not yet wired
- [ ] **Crown unlock** — "#1 on leaderboard" condition not yet wired
- [ ] **Hatch transition animation** — currently snaps instantly from egg to cat; needs a scale-bounce transition
- [ ] **Accessories** — scarf, hat, glasses, wings, halo, crown have no visual implementation yet (unlock logic exists but no rendering)
- [ ] **SweatDrop** wired to Fading state (component built, not connected)

**Output**: A ginger cat that starts as a cracking pixel-art egg, hatches into a behaviorally rich cat, and gets sick (sleeps, stops moving) when posture is poor. The emotional attachment is real — the cat is genuinely charming.

### Phase 6: Elasticsearch + Leaderboard -- DONE
**Goal**: Biometric data pipeline + competitive leaderboard. Easiest to bolt on last.

- [x] **Elastic Cloud setup**:
  - Create free Elastic Cloud trial (14-day, no credit card)
  - Get cloud endpoint URL + API key
  - Create index `kinetic-biometrics` with BiometricEvent mapping
  - Create index `kinetic-leaderboard` with LeaderboardEntry mapping
  - Store credentials in environment variables (loaded in main process)
- [x] **Data pipeline**:
  - Main process: accumulate BiometricEvent objects from renderer via IPC
  - Every 5 seconds, bulk-index the batch to Elasticsearch: `POST /_bulk`
  - This runs entirely in the main process — no API route needed since it's a desktop app and the API key stays in the main process
- [x] **Leaderboard**:
  - Nickname entry on first launch (simple text input, stored in electron-store)
  - Every 60 seconds (and on session end / app quit), upsert leaderboard entry:
    - nickname, sessionId, avgLockInScore, bestStreak, totalLockedInMinutes, pet level
  - Leaderboard page in the app: query top 20 entries sorted by `avgLockInScore` desc
  - Show: rank, nickname, pet avatar (at current level), best streak, avg score
  - Pre-seed 3–4 entries so the board isn't empty on first load
- [ ] **Kibana dashboard**: *(stretch — not yet done)*
  - Create a Kibana dashboard in Elastic Cloud:
    - Time-series line chart of posture score over a session
    - Pie chart of emotion distribution
    - Average stats per session
  - Screenshot or link to it from within the app

**Output**: All biometric data flowing to Elasticsearch. Functional leaderboard. Kibana analytics dashboard.

### Phase 7: Session Recap Card -- DONE
**Goal**: A Spotify Wrapped-style shareable card generated at end of each session.

- [x] **Session data collection**: Track session-level aggregates in memory throughout the session:
  - Total session duration
  - Total upright minutes (Overall ≥ 65)
  - Average posture, focus, stress, overall scores
  - Best streak length
  - Average blink rate
  - Pet milestones this session (evolution? new accessory?)
  - Store the previous pet level at session start so we can detect evolution
- [x] **Recap card component**: `RecapOverlay.tsx`
  - Styled card (480×640px) matching the earth-tone design system
  - Content: date, pet visual (rendered from current Three.js scene → snapshot to canvas), upright hours, percentile rank (if Elasticsearch available), best streak, avg posture, blink rate label, pet milestones
  - Render onto an offscreen `<canvas>` for image export
  - Shown as a modal overlay when user clicks "End Session" or after a configurable session duration
- [x] **Share / Save buttons**:
  - **Copy to clipboard**: `nativeImage.createFromDataURL(canvas.toDataURL())` → `clipboard.writeImage()`
  - **Save as PNG**: `dialog.showSaveDialog({ defaultPath: 'axis-recap.png' })` → write buffer to file
  - Both exposed via IPC from main process
- [x] **Percentile calculation**: If Elasticsearch has leaderboard data, compute "better than X% of users" by comparing current user's avg posture to all leaderboard entries. If < 3 entries or Elasticsearch unavailable, omit this line from the card.

**Output**: At end of session, a beautiful shareable card pops up. User can copy it to clipboard or save as PNG. It shows their pet, their stats, and any milestones. Designed to be screenshotted and posted.

### Phase 8: Polish & Demo Prep -- IN PROGRESS
**Goal**: Make it demo-ready and beautiful. Execute Plans 01–05, then prepare for demo.

- [x] **UI polish**:
  - Landing / onboarding screen explaining AXIS on first launch
  - Loading states for webcam/ML initialization (progress bar while models load)
  - Error handling: webcam denied, ML failed to load, Elasticsearch unreachable (graceful degradation — app works without Elastic)
  - App icon, window title, menu bar cleanup
  - Dark theme (ambient brightness effects look much better on dark UI)
- [x] **Gamma reset safety**: Gamma always resets to default on normal quit, force quit, and crash (signal handlers registered)
- [x] **Pomodoro Timer**: Replaced Digital Twin with Pomodoro Timer (Focus/Short Break/Long Break, posture nudge, round counter, localStorage persistence, tab-switch protection, per-mode time preservation)
- [x] **Blink detection fixed**: EAR-based blink detection now stable and reliable
- [x] **Plan 01 — Posture tracking accuracy**: Fixed smoothing lag (7.5s → 3s), removed double-counted slouch penalty, aligned constants, fixed calibration race condition + visibility filtering
- [x] **Plan 05 — Ambient smoothing**: Eliminated bucket-edge jumps, fixed transition restarts, smoothed fatigue noise, applied user preferences, overlapped AMBIENT_MAP buckets, increased transition to 3s
- [ ] **Plan 08 — Welcome screen redesign**: Current opening screen is subpar — needs hero visual, better typography, entrance animations, more inviting Start button
- [ ] **Plan 06 — Pet evolution names**: Rename bird-themed stages (Hatchling, Fledgling) to cat-themed (Kitten, Mouser)
- [ ] **Plan 07 — Egg paw print**: Add paw print overlay to the pixel-art egg sprite
- [ ] **Plan 09 — Leaderboard UI polish**: Add podium for top 3, pet avatars, rank badges, better styling
- [ ] **Plan 02 — Pet persistence & unlocks**: Auto-save every 30s, save on window close, wire hat/crown unlocks, hatch transition animation, render all accessories, wire SweatDrop to Fading
- [ ] **Plan 04 — Gamification**: Toast notification component, pet celebration effects, streak milestone reactions, in-session feedback
- [ ] **Plan 03 — UI/UX polish**: Live streak counter in header, responsive breakpoints, hover states, timeline empty state shimmer, recap font fix
- [ ] **Demo script**: Plan the exact demo flow: *(not yet done)*
  1. Launch AXIS, show onboarding — egg is visible in pet panel (5 sec)
  2. Grant webcam, run calibration (10 sec)
  3. Sit up straight — score goes green, egg starts cracking, screen at normal brightness (10 sec)
  4. Show the egg hatching into the creature (pre-load cumulative time so it hatches during demo) (10 sec)
  5. Slouch — screen dims and warms to amber smoothly, pet gets **sick** (sleeps, stops moving, red glow), score drops (15 sec)
  6. Sit back up — screen recovers gradually, pet recovers, score climbs (10 sec)
  7. Show the dashboard with all 4 metrics live + session timeline + Pomodoro timer running (10 sec)
  8. Trigger session end — show the Wrapped-style recap card with stats + pet (10 sec)
  9. Show the leaderboard with pet avatars (5 sec)
- [ ] **Demo prep**: Pre-seed electron-store so the pet is at Stage 2+ with an accessory, and pre-seed 3–4 leaderboard entries. *(not yet done)*
- [ ] **Bug fixes & edge cases**: Test with different lighting, different people, different postures. *(not yet done)*
- [ ] **Presentation slides**: 3–5 slides max. Problem → Solution → Demo → Tech. *(not yet done)*

---

## Parallel Work Streams

Not everything is sequential. Here's how to split work across 4 team members:

### Stream 1: Foundation
| Person | Task |
|--------|------|
| **Dev 1 (ML Lead)** | Phase 0 scaffold → Phase 1: ML spike (posture algorithm: neck angle, shoulder slant, trunk cosine similarity + calibration + Digital Twin canvas) |
| **Dev 2 (Systems)** | Phase 0 help → Phase 2: brightness CLI + gamma Swift helper (compile, test, IPC wiring, smoothing) |
| **Dev 3 (Creative)** | Research Three.js pet approaches, build egg with glow pulse + crack progression, hatch animation, base creature with breathing + 3 health states using mock scores |
| **Dev 4 (Frontend)** | Build full dashboard layout from mockup: 4 metric cards, overall gauge, systems panel, ambient response panel, session timeline — all with mock data |

### Stream 2: Core Features
| Person | Task |
|--------|------|
| **Dev 1** | Phase 4: Face mesh → EAR blink detection → stress estimation → focus score → wire all 4 metrics live |
| **Dev 2** | Phase 2 finish (feel tuning) → wire multi-signal ambient (posture + fatigue → brightness/warmth) |
| **Dev 3** | Phase 5: Pet posture mirroring + sick state visual + state transitions driven by overall score |
| **Dev 4** | Phase 3: Wire live ML data into dashboard, state tabs (Upright/Slouching/Fatigued), session timeline charts |

### Stream 3: Integration & Polish
| Person | Task |
|--------|------|
| **Dev 1** | Phase 6: Elasticsearch setup + biometric data pipeline |
| **Dev 2** | Phase 6: Leaderboard UI + IPC handlers |
| **Dev 3** | Phase 5: Pet evolution stages + accessories + streak system + electron-store persistence |
| **Dev 4** | Dashboard polish: webcam overlay with FPS/landmark count, overall UI refinement |

### Stream 4: Final Polish
| Person | Task |
|--------|------|
| **Dev 1** | Kibana dashboard + Elasticsearch analytics + percentile calculation for recap card |
| **Dev 2** | Gamma reset safety, error handling, edge cases |
| **Dev 3** | Phase 7: Session Recap Card (component, canvas rendering, share/save buttons) |
| **Dev 4** | Demo script, demo data seeding, presentation slides, rehearsal coordination |

---

## Competitive / Multiplayer: Lock In Board

The **Lock In Board** is a competitive leaderboard that turns posture wellness into a shared experience.

### Why This Matters
- Solo wellness tools get abandoned. Competition creates accountability.
- A leaderboard is inherently demo-able — show entries climbing in real-time.
- Adds a fun competitive angle without detracting from the core ambient concept.

### Overall / Lock In Score (0-100)
Composite score driving the leaderboard (same as the Overall gauge on the dashboard):
```
overallScore = (postureScore * 0.40) + (focusScore * 0.35) + ((100 - stressScore) * 0.25)
```

### Lock In Board (Leaderboard)
- Nickname-based entry (text input on first launch, no account needed)
- Elasticsearch index: `kinetic-leaderboard`
- Sorted by highest average Lock In score per session
- Each entry shows the user's pet at its current evolution stage
- Shows: rank, nickname, pet avatar (at current level), best streak (min), avg score
- Pre-seed with 3-4 entries so the board isn't empty on first load

### Streak System
- Track consecutive minutes with Lock In score > 70
- Display as: **"Locked in for 47 min"**
- 30-second grace period (score can dip below 70 briefly without breaking streak)
- Streak milestones trigger pet reactions

### Leaderboard Data Model (Elasticsearch)
```typescript
interface LeaderboardEntry {
  nickname: string;
  sessionId: string;
  avgLockInScore: number;
  bestStreak: number; // minutes
  totalLockedInMinutes: number;
  level: number;
  levelTitle: string;
  timestamp: string;
}
```

---

## Testing — On-Machine Verification

**For the coding agent**: After implementing each phase, you MUST write and run automated tests that verify the implementation works on the real machine. Write these as executable test scripts (using Playwright for Electron E2E, or plain Node.js scripts for system-level checks). Run them yourself and fix any failures before moving to the next phase. No mocks — all tests hit the real webcam, real system APIs, and real Electron app. If a test requires a person in front of the camera, log clear instructions for what to do and assert on the ML output.

### 1. ML Pipeline Verification

- Launch renderer process, load both ML models (`@vladmandic/human` or `@mediapipe/tasks-vision` for pose, `@vladmandic/human` for face)
- Feed a real webcam frame through pose detection → assert the returned landmarks array has 33 points with all coordinates in the 0–1 range
- Feed a real webcam frame through face detection → assert 468 face mesh landmarks returned
- Verify landmark indices 0, 7, 8, 11, 12, 23, 24 (nose, ears, shoulders, hips) all have `visibility > 0.5` when a person is sitting in front of the camera
- Run continuous inference for 30 seconds → assert average FPS stays above 10fps for pose, above 3fps for face

### 2. Posture Scoring (Real Webcam)

- Complete calibration flow (sit upright for 3 seconds) → assert `CalibrationData` is stored in electron-store with reasonable values (neck angle 160–180°, shoulder slant < 3°, trunk similarity > 0.95)
- Sit upright after calibration → assert posture score > 70 within 5 seconds
- Deliberately slouch forward → assert posture score drops below 50 within 5 seconds
- Tilt shoulders visibly → assert `shoulderSlant` value increases above 5°
- Return to upright → assert score recovers above 70 within 10 seconds

### 3. Blink & Fatigue Detection

- Sit normally for 60 seconds → assert blink rate is between 8–30 bpm (sane range)
- Deliberately hold eyes closed for 3 seconds → assert a prolonged closure is registered
- Assert `avgEAR` is between 0.15–0.40 during normal usage (sanity check on eye landmark detection)

### 4. Ambient Control (Real System Calls)

- Run `brightness 0.5` from main process → run `brightness -l` → assert reported brightness is approximately 0.5 (within ±0.05)
- Run `brightness 1.0` → assert brightness restores to ~1.0
- Run `./gamma-helper 1.0 0.7 0.6` → assert process exits with code 0 (no crash)
- Run `./gamma-helper 1.0 1.0 1.0` → assert gamma resets cleanly
- Kill the Electron app with SIGTERM → run `brightness -l` → assert brightness is back to 1.0 (verifies the reset handler works)

### 5. IPC Round-Trip

- Launch full Electron app
- From renderer, call `window.kinetic.storeSet('test-key', 'test-value')` → then `window.kinetic.storeGet('test-key')` → assert returns `'test-value'`
- From renderer, call `window.kinetic.updateAmbient({ brightness: 0.6, warmth: 0.3 })` → wait 3 seconds → run `brightness -l` from a shell → assert brightness is approximately 0.6

### 6. Pet State Machine

- Set electron-store pet state to stage 0 (Egg), `totalLockedInMinutes: 0`
- Run app with good posture (Overall ≥ 65) for 10+ minutes → assert pet stage transitions from 0 to 1 (Hatchling)
- While sitting upright, assert pet health state is `'Thriving'`
- Slouch until Overall drops below 30 → assert pet health transitions to `'Wilting'`
- Sit back up → assert pet health recovers to `'Thriving'` or `'Fading'`
- Close and reopen app → assert pet stage and `totalLockedInMinutes` persist from electron-store

### 7. Dashboard Rendering

- Launch app, complete calibration → assert all 4 metric cards are visible and updating (values are not stuck at 0 or "--")
- Assert the Digital Twin canvas is drawing (check canvas has non-zero image data)
- Assert the Overall gauge reflects a score between 0–100
- Assert Session Timeline charts have data points accumulating over 30 seconds
- Assert Systems Panel shows Pose Detection as `'active'` (green dot)

### 8. Full End-to-End Flow

Run the complete user journey as a single test:

1. Launch AXIS → assert window opens, welcome/calibration screen appears
2. Complete calibration → assert calibration data saved, dashboard appears
3. Sit upright for 30 seconds → assert posture score > 70, pet is Thriving, ambient brightness near 1.0
4. Slouch for 15 seconds → assert posture score < 50, pet transitions to Fading or Wilting, screen brightness dims noticeably (read back via `brightness -l`)
5. Sit back up for 15 seconds → assert score recovers, pet recovers, brightness returns toward 1.0
6. Trigger session end → assert recap card modal appears with non-zero stats
7. Quit app → assert gamma and brightness reset to defaults

---

## Key Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| ML models too slow in Electron renderer | No real-time feedback = no product | Test in Phase 1 immediately. Fallback: reduce to posture-only, drop emotion. Hard limit: must hit 10fps. Electron's Chromium should perform same as Chrome. |
| Posture algorithm inaccurate | Scores feel random, kills trust | Calibration baseline makes it relative to each person. Smooth with rolling average. Test on multiple people early. |
| `brightness` CLI doesn't work on team member's Mac | No brightness control | Fallback: AppleScript brightness keys, or IOKit direct calls. Test on every team member's machine in Phase 2. |
| CoreGraphics gamma doesn't reset on crash | Screen stuck amber after force quit | Register `process.on('SIGTERM')`, `app.on('will-quit')`, AND `process.on('uncaughtException')` handlers that all reset gamma to (1.0, 1.0, 1.0). |
| Three.js pet too complex to build in time | No pet | Start with a glowing orb/blob that breathes and changes color. Upgrade to animal shape only if time allows. An orb with good animations > a bad animal model. |
| Elasticsearch unreachable / setup fails | No leaderboard or analytics | Build it last. Core product works 100% without it. Leaderboard falls back to electron-store (local only). |
| Demo environment has bad lighting | ML accuracy drops | Test in the demo room. Adjust confidence thresholds. Have a backup screen recording of it working. |

---

## Implementation Details

### Utility Functions (`src/renderer/lib/math.ts`)

Standard math helpers used throughout: `clamp`, `lerp`, `euclideanDist`, `cosineSimilarity`, `stddev`.

### Rolling Buffer (`src/renderer/lib/rolling-buffer.ts`)

Two classes used for score smoothing and time-series tracking:
- `RollingAverage(windowSize)` — push numbers, get running average. Exposes `.stddev` for variance detection (fidgeting). Window sizes: posture smoothing = 150 (10s at 15fps), EAR = 30 (6s at 5fps), posture history = 60 (variance).
- `RollingBuffer<T>(maxSize)` — generic ring buffer. Used for blink timestamps (100), session timeline data points (300 = 5 min at 1/sec per metric).

### Constants (`src/renderer/lib/constants.ts`)

Single source of truth for all thresholds, weights, and configuration:

```typescript
// --- Posture ---
export const POSTURE_WEIGHTS = { neck: 0.45, shoulder: 0.20, trunk: 0.35 };
export const NECK_ANGLE_RANGE = { perfect: 180, terrible: 140 }; // degrees
export const SHOULDER_SLANT_MAX = 10; // degrees — above this = score 0
export const TRUNK_SIMILARITY_RANGE = { perfect: 1.0, terrible: 0.85 };
export const SLOUCH_THRESHOLD = 150; // neck angle below this = isSlumping

// --- Blink / Fatigue ---
export const EAR_BLINK_THRESHOLD = 0.20;
export const BLINK_MIN_FRAMES = 1;
export const BLINK_MAX_FRAMES = 5; // longer = prolonged closure
export const NORMAL_BLINK_RATE = { min: 15, max: 20 }; // blinks per minute
export const EAR_NORMAL_RANGE = { drowsy: 0.18, alert: 0.33 };

// --- Stress ---
export const EMOTION_STRESS_MAP: Record<string, number> = {
  angry: 85, fearful: 80, sad: 70, disgusted: 65,
  surprised: 40, neutral: 15, happy: 10,
};
export const STRESS_WEIGHTS = { emotion: 0.4, fidget: 0.35, blink: 0.25 };

// --- Focus ---
export const FOCUS_WEIGHTS = { posture: 0.3, inverseFatigue: 0.25, inverseStress: 0.20, stability: 0.25 };

// --- Overall ---
export const OVERALL_WEIGHTS = { posture: 0.40, focus: 0.35, inverseStress: 0.25 };
export const STATE_THRESHOLDS = { upright: 65, slouching: 30 }; // ≥65 upright, 30-64 slouching, <30 fatigued

// --- Metric Card Status ---
export const STATUS_THRESHOLDS = {
  posture:   { good: 70, fair: 40 },
  blinkRate: { goodMin: 12, goodMax: 22, fairMin: 8, fairMax: 28 },
  focus:     { good: 70, fair: 40 },
  stress:    { good: 30, fair: 60 }, // inverted: low stress = good
};

// --- Ambient ---
export const AMBIENT_UPDATE_INTERVAL = 1000; // ms between brightness/gamma updates
export const AMBIENT_TRANSITION_DURATION = 2000; // ms to interpolate between states
export const AMBIENT_MAP = [
  { scoreMin: 80, scoreMax: 100, brightness: [0.7, 1.0], warmth: [0.0, 0.0] },
  { scoreMin: 50, scoreMax: 80,  brightness: [0.5, 0.7], warmth: [0.2, 0.4] },
  { scoreMin: 20, scoreMax: 50,  brightness: [0.3, 0.5], warmth: [0.4, 0.7] },
  { scoreMin: 0,  scoreMax: 20,  brightness: [0.2, 0.3], warmth: [0.7, 0.9] },
];

// --- ML Performance ---
export const POSE_FPS = 15;
export const FACE_FPS = 5;
export const POSE_LOOP_INTERVAL = Math.round(1000 / POSE_FPS);   // ~67ms
export const FACE_LOOP_INTERVAL = Math.round(1000 / FACE_FPS);   // 200ms

// --- MediaPipe Pose Landmarks ---
export const LANDMARKS = {
  NOSE: 0,
  LEFT_EAR: 7, RIGHT_EAR: 8,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
};

export const POSE_CONNECTIONS: [number, number][] = [
  [0, 7], [0, 8],
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15], [12, 14], [14, 16],
  [23, 25], [25, 27], [24, 26], [26, 28],
];

// --- Face Mesh Eye Landmarks ---
export const LEFT_EYE = {
  top: [159, 158, 157], bottom: [145, 144, 153],
  left: 33, right: 133,
};
export const RIGHT_EYE = {
  top: [386, 385, 384], bottom: [374, 373, 380],
  left: 362, right: 263,
};

// --- Pet Health States (real-time) ---
export const PET_HEALTH = {
  THRIVING: { minScore: 65, color: '#4A7C59', label: 'Thriving' },
  FADING:   { minScore: 30, color: '#C4962C', label: 'Fading' },
  WILTING:  { minScore: 0,  color: '#C0392B', label: 'Wilting' },  // "sick" state
};

// --- Pet Evolution Stages (permanent, cumulative) ---
export const PET_EVOLUTION = [
  { stage: 0, title: 'Egg',        minMinutes: 0,   description: 'Resting. Good posture will hatch it.' },
  { stage: 1, title: 'Hatchling',  minMinutes: 10,  description: 'Just born! Wobbly but curious.' },
  { stage: 2, title: 'Fledgling',  minMinutes: 30,  description: 'Growing steadier. Gained a scarf!' },
  { stage: 3, title: 'Companion',  minMinutes: 120, description: 'Full-sized. Loyal and glowing.' },
  { stage: 4, title: 'Guardian',   minMinutes: 300, description: 'Powerful. Wings unfurled.' },
  { stage: 5, title: 'Ascended',   minMinutes: 600, description: 'Transcendent. Full radiance.' },
];

// --- Pet Accessories (unlocked by milestones) ---
export const PET_ACCESSORIES = [
  { id: 'scarf',   label: 'Scarf',   condition: 'First session > 30 min with avg overall ≥ 60' },
  { id: 'hat',     label: 'Hat',     condition: '3 sessions completed' },
  { id: 'glasses', label: 'Glasses', condition: 'Best streak > 45 min' },
  { id: 'cape',    label: 'Cape',    condition: 'Reach Stage 3 (Companion)' },
  { id: 'wings',   label: 'Wings',   condition: 'Reach Stage 4 (Guardian)' },
  { id: 'halo',    label: 'Halo',    condition: 'Reach Stage 5 (Ascended)' },
  { id: 'crown',   label: 'Crown',   condition: '#1 on the Lock In Board' },
];

// --- Elasticsearch ---
export const ELASTIC_BATCH_INTERVAL = 5000; // ms
export const LEADERBOARD_UPSERT_INTERVAL = 60000; // ms
```

### Types (`src/renderer/lib/types.ts`)

```typescript
export interface Point {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface PostureData {
  score: number;
  neckAngle: number;
  shoulderSlant: number;
  trunkSimilarity: number;
  isSlumping: boolean;
}

export interface BlinkData {
  rate: number;          // blinks per minute
  avgEAR: number;
  prolongedClosures: number;
}

export interface StressData {
  score: number;
  dominantEmotion: string;
  emotionConfidence: number;
}

export interface ScoreSnapshot {
  timestamp: number;
  posture: PostureData;
  blink: BlinkData;
  focus: { score: number };
  stress: StressData;
  overall: { score: number; state: 'upright' | 'slouching' | 'fatigued' };
}

export type PetHealthState = 'Thriving' | 'Fading' | 'Wilting';

export interface PetState {
  stage: number;           // 0 = Egg, 1-5 = evolution stages
  stageName: string;       // 'Egg' | 'Blob' | 'Sprout' | 'Critter' | 'Beast' | 'Guardian'
  health: PetHealthState;
  totalLockedInMinutes: number;
  eggCrackProgress: number;  // 0-100, only used during stage 0
  accessories: string[];     // IDs of unlocked accessories
  lastEvolutionCheck: number;
  sickSince: number | null;  // timestamp when pet entered Wilting, null if healthy
}

export interface SessionRecap {
  sessionId: string;
  date: string;
  durationMinutes: number;
  avgPosture: number;
  avgFocus: number;
  avgStress: number;
  avgOverall: number;
  bestStreak: number;
  totalUprightMinutes: number;
  petStageAtEnd: number;
  petHealthAtEnd: PetHealthState;
  accessoriesUnlocked: string[];   // accessories earned this session
  highlights: RecapHighlight[];
}

export interface RecapHighlight {
  label: string;            // e.g. "Longest Focus Streak"
  value: string;            // e.g. "47 min"
  percentile?: number;      // e.g. 78 → "better than 78% of users"
}

export interface CalibrationData {
  uprightNeckAngle: number;
  uprightShoulderSlant: number;
  uprightTrunkVector: [number, number];
  baselineBlinkRate: number;
  baselineEAR: number;
  timestamp: number;
}

export interface LeaderboardEntry {
  nickname: string;
  sessionId: string;
  avgOverallScore: number;
  bestStreak: number;
  totalLockedInMinutes: number;
  level: number;
  levelTitle: string;
  timestamp: string;
}

export type SystemStatus = 'active' | 'degraded' | 'inactive';

export interface SystemsState {
  poseDetection: SystemStatus;
  faceMesh: SystemStatus;
  affectEngine: SystemStatus;
  ambientCtrl: SystemStatus;
}
```

### State Management — Score Engine (`src/renderer/ml/score-engine.ts`)

The Score Engine is the central hub — a singleton with a simple event emitter pattern (no Redux/Zustand needed). It subscribes to ML outputs and emits unified `ScoreSnapshot` objects.

Architecture:
- **Inputs**: `updatePosture(landmarks)` called by pose-engine at ~15fps, `updateFace(faceLandmarks, emotion)` called by face-engine at ~5fps
- **Internal state**: Rolling buffers for posture smoothing (150 samples = 10s at 15fps), blink timestamps (60s window), EAR buffer (30 samples), posture history (60 samples for variance/fidgeting)
- **On each update**: Recalculates all composite scores using the formulas defined in Core Functionality (fatigue, stress, focus, overall), builds a `ScoreSnapshot`, and emits to all listeners
- **Calibration**: Must call `setCalibration(data)` before posture scoring works. Posture updates are no-ops without calibration.
- Subscribe via `scoreEngine.subscribe(callback)` which returns an unsubscribe function

### React Data Flow

```
scoreEngine (singleton, event emitter)
   ↓ subscribe()
useScores() hook (useState + useEffect, subscribes to scoreEngine)
   ↓ returns ScoreSnapshot
<Dashboard />
   ├── <MetricCard metric="posture" />
   ├── <MetricCard metric="blinkRate" />
   ├── <MetricCard metric="focus" />
   ├── <MetricCard metric="stress" />
   ├── <OverallGauge />
   ├── <DigitalTwin />
   ├── <BioPet />
   ├── <SessionTimeline />
   ├── <SystemsPanel />
   └── <AmbientPanel />
```

### ML Pipeline Orchestration

Two independent loops running at different frame rates. They do NOT block each other.

- **pose-engine.ts**: Loads pose model (try `@vladmandic/human` first, fallback to `@mediapipe/tasks-vision`). Runs detection loop at `POSE_LOOP_INTERVAL` (~67ms = 15fps). On each frame, calls `scoreEngine.updatePosture(landmarks)`.
- **face-engine.ts**: Loads `@vladmandic/human` with face + emotion config. Runs at `FACE_LOOP_INTERVAL` (200ms = 5fps). Extracts 468 face mesh landmarks + dominant emotion, calls `scoreEngine.updateFace(mesh, emotion)`.
- Both use `requestAnimationFrame` with timestamp-based throttling (preferred over `setTimeout` to avoid queue buildup when inference is slow).

### Ambient Controller (`src/main/ambient-controller.ts`)

Singleton running in the main process. Receives target `{ brightness, warmth }` from renderer via IPC and smoothly interpolates from current to target values over `AMBIENT_TRANSITION_DURATION` (2s).

Key behavior:
- `setTarget(brightness, warmth)` — sets new target, starts interpolation if not already running
- Interpolation: capture `startBrightness` / `startWarmth` at the beginning, lerp from start→target using `t = step/totalSteps` over ~40 steps (50ms each). **Important**: lerp from the captured start values, not from the continuously-updated current values, to get linear (not exponential) easing.
- `applyBrightness(level)` — calls `brightness` CLI
- `applyGamma(warmth)` — calls `./gamma-helper` with RGB values derived from warmth (see warmth→RGB mapping in macOS System Control Details)
- `reset()` — resets brightness to 1.0 and gamma to (1.0, 1.0, 1.0). **Must** be called on every exit path (see main.ts).
- If a new target arrives during interpolation, restart interpolation from current position toward new target.

### Main Process Entry (`src/main/main.ts`)

Key responsibilities:
- Request camera permission via `systemPreferences.askForMediaAccess('camera')` before creating window
- Create `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, `titleBarStyle: 'hiddenInset'`
- Window: 1280×800, minWidth 1024, minHeight 700, background `#FAF8F5`
- Register all IPC handlers from `ipc-channels.ts` (ambient → ambientController, biometric → elasticClient, store → electron-store, leaderboard → elasticClient)

**Critical — gamma reset safety**: Register `ambientController.reset()` on ALL of these:
- `app.on('will-quit')`, `app.on('before-quit')`
- `process.on('SIGTERM')`, `process.on('SIGINT')`
- `process.on('uncaughtException')`

This ensures the screen always returns to normal brightness/color even on crash.

### Preload Bridge (`src/preload/preload.ts`)

Use `contextBridge.exposeInMainWorld('kinetic', { ... })` to expose all IPC channels defined in `ipc-channels.ts` to the renderer. Fire-and-forget channels use `ipcRenderer.send()`, request-response channels use `ipcRenderer.invoke()`.

### electron-store Schema

What persists across app restarts:

```typescript
// Managed via IPC.STORE_GET / IPC.STORE_SET from renderer

interface StoreSchema {
  // Calibration
  calibration: CalibrationData | null;

  // Pet (full lifecycle state)
  pet: {
    stage: number;                // 0 = Egg, 1-5 = evolution stages
    stageName: string;            // current stage display name
    health: 'Thriving' | 'Fading' | 'Wilting';
    totalLockedInMinutes: number;
    eggCrackProgress: number;     // 0-100, used during stage 0 only
    accessories: string[];        // IDs of unlocked accessories
    lastEvolutionCheck: number;   // timestamp
    sickSince: number | null;     // timestamp when pet entered Wilting, null if healthy
  };

  // User
  nickname: string | null;

  // Preferences
  preferences: {
    ambientEnabled: boolean;
    brightnessRange: { min: number; max: number }; // user can limit how dim it gets
    warmthIntensity: number; // 0-1 multiplier on warmth effect
  };

  // Session history (last 30 sessions, for local analytics if Elastic is down)
  sessions: Array<{
    id: string;
    startTime: number;
    endTime: number;
    avgPosture: number;
    avgFocus: number;
    avgStress: number;
    avgOverall: number;
    bestStreak: number;
    totalMinutes: number;
  }>;

  // Session recap cards (last 30, for re-viewing/sharing past recaps)
  recaps: SessionRecap[];
}
```

### Design System / Color Tokens

Based on the mockup's earth-tone palette. Defined as CSS custom properties in `globals.css` and referenced throughout with Tailwind.

```css
/* src/renderer/styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Background */
  --bg-primary: #FAF8F5;         /* warm cream — app background */
  --bg-card: #FFFFFF;             /* white — card surfaces */
  --bg-card-hover: #F5F3F0;      /* subtle hover */

  /* Text */
  --text-primary: #2C2C2C;       /* near-black */
  --text-secondary: #6B6B6B;     /* muted gray */
  --text-tertiary: #9B9B9B;      /* light labels */

  /* Status — Good */
  --green-primary: #4A7C59;      /* score text, digital twin lines */
  --green-bg: #E8F0EA;           /* badge background */
  --green-badge: #4A7C59;        /* "Good" badge */

  /* Status — Fair */
  --amber-primary: #C4962C;      /* score text, digital twin lines */
  --amber-bg: #FFF3DC;           /* badge background */
  --amber-badge: #B8860B;        /* "Fair" badge */

  /* Status — Poor */
  --red-primary: #C0392B;        /* score text, digital twin lines */
  --red-bg: #FDE8E5;             /* badge background */
  --red-badge: #C0392B;          /* "Poor" badge */

  /* Accents */
  --accent-green: #4A7C59;       /* overall gauge stroke (good) */
  --accent-amber: #C4962C;       /* overall gauge stroke (fair) */
  --accent-red: #C0392B;         /* overall gauge stroke (poor) */

  /* Charts */
  --chart-posture: #4A7C59;
  --chart-focus: #4A7C59;
  --chart-stress: #C0392B;
  --chart-fill-opacity: 0.15;

  /* Borders */
  --border-card: #E8E5E0;        /* subtle card borders */
  --border-section: #D4D0CA;     /* section dividers */

  /* Shadows */
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.04);

  /* Font */
  --font-mono: 'SF Mono', 'Menlo', monospace;
  --font-sans: 'SF Pro Display', '-apple-system', system-ui, sans-serif;
}
```

```typescript
// tailwind.config.ts — extend theme with CSS variables
export default {
  theme: {
    extend: {
      colors: {
        bg: { primary: 'var(--bg-primary)', card: 'var(--bg-card)' },
        status: {
          good: 'var(--green-primary)',
          fair: 'var(--amber-primary)',
          poor: 'var(--red-primary)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
};
```

### Webcam Feed Overlay (`src/renderer/components/visualisation/WebcamFeed.tsx`)

Renders the webcam feed with a canvas overlay showing landmark dots (green/amber/red based on posture score) and metadata footer ("30 fps · 543 pts" + "● REC" indicator). Video element should be mirrored (`scaleX(-1)`).
