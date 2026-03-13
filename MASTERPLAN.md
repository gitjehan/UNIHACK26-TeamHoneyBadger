# KINETIC — MASTER PLAN (UNIHACK 2026)

**KINETIC** is a bio-responsive ambient workspace. Your webcam watches your posture, fatigue, and emotion using real-time computer vision — then instead of sending you a notification, it subtly shifts your entire digital environment. Real screen brightness, color temperature, ambient audio, and a living pet companion all respond to how you're sitting and feeling. No popups. No interruptions. Your workspace just adapts.

> **Pitch**: "KINETIC is a Mac desktop app that uses your webcam to track your posture, fatigue, and emotion in real-time — then adapts your actual screen brightness, color temperature, and a virtual pet companion to keep you healthy without ever interrupting you."

---

## Context

UNIHACK 2026 — 48-hour hackathon, 500+ students, $7k+ prizes.

**Team**: 4-5 members, first hackathon.

This plan covers technical architecture, execution order, and timeline.

---

## Technical Architecture

### Why a Desktop App (Not a Web App)

The core promise of KINETIC is that your **workspace adapts to you**. A web app can only fake this with CSS filters inside its own tab. An Electron app on macOS can control the **actual screen** — real brightness dimming, real color temperature shifts across your entire display. This is the difference between a demo trick and a real product.

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

### IPC Contract (Renderer → Main)

```typescript
// Renderer sends to main:
ipcRenderer.send('ambient:update', {
  brightness: number;      // 0.0 – 1.0
  warmth: number;          // 0.0 – 1.0 (maps to gamma shift)
});

ipcRenderer.send('biometric:event', {
  timestamp: string;
  posture: { score: number; shoulderAngle: number; neckLean: number; isSlumping: boolean };
  emotion: { dominant: string; confidence: number };
  fatigue: { blinkRate: number; score: number; eyeAspectRatio: number };
  ambient: { brightness: number; warmth: number; petState: string };
});

// Renderer requests from main:
ipcRenderer.invoke('leaderboard:get')    → LeaderboardEntry[]
ipcRenderer.invoke('leaderboard:upsert', entry: LeaderboardEntry) → void
ipcRenderer.invoke('analytics:session-history') → BiometricEvent[]
```

### Why No Supabase / Extra Database?
- Elasticsearch covers server-side storage (biometrics + leaderboard)
- No user accounts needed — leaderboard is nickname-based
- electron-store handles local state (pet evolution, calibration data, preferences)
- Fewer moving parts = fewer things to break in 48 hours

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
  posture: { score: number; shoulderAngle: number; neckLean: number; isSlumping: boolean };
  emotion: { dominant: string; confidence: number };
  fatigue: { blinkRate: number; score: number; eyeAspectRatio: number };
  ambient: { brightness: number; warmth: number; petState: string };
}
```

---

## Feature Prioritization

### Tier 1: MUST SHIP — The Demo-able Core
1. Webcam posture detection with real-time score (0-100)
2. **Real ambient screen response**: macOS brightness + color temperature shifts driven by posture score
3. Real-time dashboard: posture gauge + rolling chart
4. Elasticsearch data pipeline: biometric events indexed every 5s

### Tier 2: SHOULD SHIP — Full Product Feel
5. Emotion detection displayed in dashboard
6. Blink rate / fatigue score from eye landmarks
7. **Pet**: Three.js creature with emotional states, posture mirroring, breathing
8. Multi-signal ambient response (posture + fatigue both drive brightness/warmth)
9. Lock In score (composite) + streak counter + pet evolution (electron-store)

### Tier 3: NICE TO HAVE — Extras
10. **Lock In Board** — competitive leaderboard (Elasticsearch-backed, nickname entry, pet avatars)
11. Ambient audio shifting with wellness state
12. Elasticsearch analytics dashboard (session history, trends)
13. Kibana visualization
14. Onboarding calibration flow with guided tutorial

### What to CUT if behind:
- Cut bottom-up (14 → 9)
- **NEVER cut**: Posture detection, real brightness/gamma ambient response, real-time dashboard — these ARE the product
- If pet takes too long, ship a simple glowing orb that breathes and changes color. Don't need a full 3D animal.

---

## Execution Order & Build Phases

Build the riskiest, most uncertain pieces first so you fail fast, and layer polish on top.

### Phase 0: Electron Scaffold + Webcam (Hour 0–2)
**Goal**: A running Electron app with webcam feed displayed.

- [ ] Scaffold with Electron Forge: `npm init electron-app@latest kinetic -- --template=vite-typescript`
- [ ] Add React + Tailwind to the renderer
- [ ] Set up the main/renderer/preload file structure
- [ ] Configure `contextBridge` + `ipcMain`/`ipcRenderer` for secure IPC
- [ ] Get webcam feed rendering in a `<video>` element in the renderer
- [ ] Verify camera permission prompt works
- [ ] Git repo init, push initial commit, everyone clones
- [ ] Install ML deps: `@mediapipe/tasks-vision`, `@vladmandic/human`

**Output**: An Electron window showing your live webcam feed. Everyone can run it.

**Who**: 1 person scaffolds, pushes. Everyone else clones and verifies it runs.

### Phase 1: ML Spike — Posture Detection (Hour 2–8)
**Goal**: Webcam → posture score number on screen. This is the riskiest piece — if this doesn't work, nothing works.

- [ ] **ML library test** (Hour 2–4): Load `@vladmandic/human` in the renderer with pose config enabled. Draw landmarks on a canvas overlay. Measure FPS. Key questions:
  - Does it detect shoulder, nose, ear landmarks accurately?
  - What FPS do we get? (Need ≥10fps minimum)
  - If accuracy is bad → switch to `@mediapipe/tasks-vision` Pose Landmarker
- [ ] **Posture algorithm** (Hour 4–6): From landmarks, calculate:
  - **Shoulder symmetry**: Angle between left and right shoulder landmarks relative to horizontal. Tilted = bad.
  - **Forward head position**: Horizontal distance between nose and midpoint of shoulders. Further forward = worse.
  - **Vertical slouch**: Ratio of (nose Y - shoulder Y) compared to calibration baseline. Smaller ratio = slouching.
  - **Combine**: Weighted average into a 0–100 score. Weights TBD during testing, start with equal thirds.
- [ ] **Calibration** (Hour 6–7): On first launch, prompt user to sit up straight for 3 seconds. Average the landmark positions as baseline. Store in electron-store. Score is % deviation from baseline — so everyone's "good posture" is personalized.
- [ ] **Wire to UI** (Hour 7–8): Big number on screen showing live posture score. Color coded: green ≥70, yellow 40–70, red <40. Update every frame.

**Output**: Electron app showing webcam feed + a live posture score that visibly drops when you slouch.

**Risk mitigation**: If ML is too slow or inaccurate, simplify to just shoulder angle + head forward lean (two signals instead of three). Two signals is enough to demo.

### Phase 2: macOS Ambient Control (Hour 8–12)
**Goal**: Posture score drives your actual screen brightness and color temperature. This is what makes KINETIC a real product.

- [ ] **Brightness helper** (Hour 8–9):
  - Install `brightness` CLI: `brew install brightness`
  - Write a `setBrightness(level: number)` function in main process that calls `brightness ${level}`
  - Test: can we smoothly step from 1.0 → 0.3 → 1.0?
  - Fallback if `brightness` CLI doesn't work: use AppleScript via `osascript`
- [ ] **Gamma / color temp helper** (Hour 9–10):
  - Write and compile `gamma-helper.swift` (see Technical Architecture section above)
  - Write a `setColorTemp(warmth: number)` function in main process
  - Test: verify warm shift is visible, reversible, and doesn't persist after app quits
  - **Important**: Register an `app.on('will-quit')` handler that resets gamma to (1.0, 1.0, 1.0) so the screen returns to normal when the app closes
- [ ] **IPC wiring** (Hour 10–11): Renderer sends `ambient:update` events with `{ brightness, warmth }` via IPC. Main process receives and calls the helpers. Rate-limit to max 1 update per second.
- [ ] **Smoothing + mapping** (Hour 11–12): Don't send raw scores to brightness. Instead:
  - Keep a rolling average of posture score (last 10 seconds)
  - Map the smoothed score to brightness + warmth (see mapping table in architecture)
  - Interpolate between current and target brightness/warmth over 2–3 seconds (use `setInterval` with small steps, e.g., 50ms intervals over 2 seconds = 40 steps)
  - This prevents flickering and makes the effect feel ambient, not reactive

**Output**: Slouch → your entire Mac screen slowly dims and warms to amber over 2–3 seconds. Sit up → it gradually returns to normal. Across ALL apps, not just the Electron window.

**Critical**: This phase is what separates KINETIC from every other wellness app. Spend time getting the feel right.

### Phase 3: Real-Time Dashboard (Hour 12–18)
**Goal**: Professional-looking dashboard inside the Electron app.

- [ ] **Layout** (Hour 12–13): The Electron window is the KINETIC dashboard. Sections:
  - Top: posture score (big number) + emotion indicator + fatigue level
  - Middle: rolling time-series chart
  - Bottom: session stats (duration, avg score, time in good/bad posture)
  - Side or floating: pet area (placeholder for now)
  - Webcam feed: small thumbnail in corner (or toggleable)
- [ ] **Posture gauge** (Hour 13–15): Circular gauge component using Recharts `RadialBarChart` or custom SVG. Animated, color-coded. The centerpiece of the dashboard.
- [ ] **Rolling chart** (Hour 15–17): Line chart showing posture score over the last 5 minutes. Buffer of 300 data points (1 per second). Use Recharts `LineChart` with `isAnimationActive={false}` for performance. Color the line based on thresholds (green/yellow/red zones).
- [ ] **Stats cards** (Hour 17–18): Simple cards showing:
  - Session duration (mm:ss)
  - Average posture score
  - Time in good posture (≥70) vs bad (<40)
  - Current streak (minutes with score ≥70)

**Output**: A polished dashboard that updates in real-time. Ambient brightness/warmth changes happening on the actual screen behind and around the app.

### Phase 4: Emotion + Fatigue Detection (Hour 18–24)
**Goal**: Add face analysis to make it multi-signal.

- [ ] **Emotion detection** (Hour 18–20): Enable `@vladmandic/human` face module alongside pose. Extract dominant emotion (happy, sad, angry, surprised, neutral, fear, disgust → simplify to 5 emotions). Run face inference at 1–5fps in a separate `setInterval` loop from posture (don't block posture at 15fps).
- [ ] **Blink rate / fatigue** (Hour 20–22): From `@vladmandic/human` face landmarks:
  - Calculate Eye Aspect Ratio (EAR) = vertical eye distance / horizontal eye distance
  - A blink = EAR drops below ~0.2 for 1–3 frames, then returns
  - Track blinks per minute (rolling 60-second window)
  - Fatigue score: combine blink rate + average EAR (prolonged low EAR = droopy eyes = tired)
  - Normal blink rate: 15–20/min. High blink rate (>25/min) or low EAR = fatigue increasing
- [ ] **Multi-signal ambient** (Hour 22–23): Update the ambient mapping to use multiple signals:
  - Posture score: primary driver (50% weight on brightness, 70% weight on warmth)
  - Fatigue score: secondary driver (50% weight on brightness — tired = dimmer screen, 30% weight on warmth)
  - Emotion: does NOT drive ambient (too noisy). Displayed on dashboard only.
- [ ] **Dashboard update** (Hour 23–24): Add to the dashboard:
  - Emotion indicator (emoji or label showing current dominant emotion)
  - Fatigue gauge (same style as posture gauge)
  - Blink rate counter

**Output**: Dashboard now shows posture + emotion + fatigue. Screen brightness/warmth responds to both posture and fatigue.

### Phase 5: Bio-Pet (Hour 24–34)
**Goal**: A Three.js creature that mirrors your state and evolves over time.

- [ ] **Basic pet rendering** (Hour 24–27): Render a simple creature in a designated area of the dashboard using Three.js. Start simple:
  - Option A: Low-poly geometric creature (sphere body, smaller sphere head, dot eyes) — buildable from Three.js primitives in a few hours
  - Option B: Free GLTF model from Sketchfab/Poly Pizza — looks better but integration takes longer
  - Must have: idle breathing animation (smooth scale oscillation on Y axis)
  - Nice to have: eyes that follow mouse or head position from webcam
- [ ] **Pet emotional states** (Hour 27–30): 5 states driven by Lock In score:
  - **Thriving** (80–100): Bouncy movement, particle effects or glow, vibrant colors
  - **Content** (60–80): Gentle breathing, soft glow, relaxed posture
  - **Neutral** (40–60): Standard idle animation
  - **Tired** (20–40): Slower animations, muted colors, drooping posture, occasional yawn animation
  - **Distressed** (0–20): Shivering/shaking, dark colors, curled up
  - Transitions between states should be gradual (lerp over 3–5 seconds)
- [ ] **Posture mirroring** (Hour 30–31): Pet's body tilt matches your posture. If you lean left, pet leans left. If you slouch forward, pet droops forward. Subtle but noticeable.
- [ ] **Lock In score + streaks** (Hour 31–33):
  - `lockInScore = (postureScore * 0.5) + (focusScore * 0.3) + ((100 - fatigueScore) * 0.2)`
  - focusScore: derived from how stable your posture is (low variance = focused) + emotion (neutral/happy = focused, angry/sad = unfocused)
  - Streak: consecutive minutes with Lock In score > 70
  - 30-second grace period (score can dip below 70 briefly without breaking streak)
  - Pet reacts to milestones: bounce at 10 min, little celebration at 30 min, special animation at 60 min
  - Display streak prominently: **"Locked in for 47 min"**
- [ ] **Pet evolution** (Hour 33–34): 5 levels stored in electron-store:
  - Level 1: Hatchling (0 cumulative locked-in min)
  - Level 2: Fledgling (30 min)
  - Level 3: Companion (120 min)
  - Level 4: Guardian (300 min)
  - Level 5: Ascended (600 min)
  - Each level changes the pet's appearance (size increase, color shift, added features like wings/glow/crown)
  - Evolution persists across app restarts via electron-store

**Output**: A living pet on screen that reacts to how you're sitting, has visible emotional states, and evolves the more you use KINETIC.

### Phase 6: Elasticsearch + Leaderboard (Hour 34–40)
**Goal**: Biometric data pipeline + competitive leaderboard. Easiest to bolt on last.

- [ ] **Elastic Cloud setup** (Hour 34–35):
  - Create free Elastic Cloud trial (14-day, no credit card)
  - Get cloud endpoint URL + API key
  - Create index `kinetic-biometrics` with BiometricEvent mapping
  - Create index `kinetic-leaderboard` with LeaderboardEntry mapping
  - Store credentials in environment variables (loaded in main process)
- [ ] **Data pipeline** (Hour 35–37):
  - Main process: accumulate BiometricEvent objects from renderer via IPC
  - Every 5 seconds, bulk-index the batch to Elasticsearch: `POST /_bulk`
  - This runs entirely in the main process — no API route needed since it's a desktop app and the API key stays in the main process
- [ ] **Leaderboard** (Hour 37–39):
  - Nickname entry on first launch (simple text input, stored in electron-store)
  - Every 60 seconds (and on session end / app quit), upsert leaderboard entry:
    - nickname, sessionId, avgLockInScore, bestStreak, totalLockedInMinutes, pet level
  - Leaderboard page in the app: query top 20 entries sorted by `avgLockInScore` desc
  - Show: rank, nickname, pet avatar (at current level), best streak, avg score
  - Pre-seed 3–4 entries so the board isn't empty on first load
- [ ] **Kibana dashboard** (Hour 39–40):
  - Create a Kibana dashboard in Elastic Cloud:
    - Time-series line chart of posture score over a session
    - Pie chart of emotion distribution
    - Average stats per session
  - Screenshot or link to it from within the app

**Output**: All biometric data flowing to Elasticsearch. Functional leaderboard. Kibana analytics dashboard.

### Phase 7: Polish & Demo Prep (Hour 40–48)
**Goal**: Make it demo-ready and beautiful.

- [ ] **UI polish** (Hour 40–44):
  - Landing / onboarding screen explaining KINETIC on first launch
  - Smooth transitions and animations everywhere
  - Loading states for webcam/ML initialization (progress bar while models load)
  - Error handling: webcam denied, ML failed to load, Elasticsearch unreachable (graceful degradation — app works without Elastic)
  - App icon, window title, menu bar cleanup
  - Dark theme (ambient brightness effects look much better on dark UI)
  - Tray icon with quick stats (stretch goal)
- [ ] **Gamma reset safety** (Hour 44): Double-check that gamma always resets to default on:
  - Normal app quit
  - Force quit / crash (register signal handlers)
  - This is critical — you don't want to demo and have the screen stuck amber
- [ ] **Demo script** (Hour 44–46): Plan the exact demo flow:
  1. Launch KINETIC, show onboarding (5 sec)
  2. Grant webcam, run calibration (10 sec)
  3. Sit up straight — show good score, happy pet, screen at normal brightness (15 sec)
  4. Slouch — actual screen dims and warms to amber, pet droops, score drops (15 sec)
  5. Sit back up — screen recovers, pet perks up (10 sec)
  6. Show the dashboard with real-time charts (10 sec)
  7. Show the leaderboard (10 sec)
  8. Show Kibana analytics (5 sec)
- [ ] **Bug fixes & edge cases** (Hour 46–47): Test with different lighting, different people, different postures. Make sure gamma resets work.
- [ ] **Presentation slides** (Hour 47–48): 3–5 slides max. Problem → Solution → Demo → Tech.

---

## Parallel Work Streams

Not everything is sequential. Here's how to split work across 4 team members:

### Hour 0–12 (Foundation)
| Person | Task |
|--------|------|
| **Dev 1 (ML Lead)** | Phase 0 scaffold → Phase 1 ML spike (posture detection + calibration) |
| **Dev 2 (Systems)** | Phase 0 help → Phase 2 brightness CLI + gamma helper (Swift compile, test, IPC wiring) |
| **Dev 3 (Creative)** | Research Three.js pet approaches, start building basic pet with breathing + states using mock score data |
| **Dev 4 (Frontend)** | Build dashboard layout, gauge component, chart component, stats cards — all with mock data |

### Hour 12–24 (Core Features)
| Person | Task |
|--------|------|
| **Dev 1** | Phase 4 — Emotion + fatigue detection (face module, blink rate, EAR) |
| **Dev 2** | Phase 2 finish (smoothing, interpolation, feel tuning) → help Dev 4 wire real data |
| **Dev 3** | Phase 5 — Pet emotional states + posture mirroring |
| **Dev 4** | Phase 3 — Wire real ML data into dashboard (replace mocks with live IPC data) |

### Hour 24–40 (Integration & Polish)
| Person | Task |
|--------|------|
| **Dev 1** | Phase 6 — Elasticsearch setup + data pipeline |
| **Dev 2** | Phase 6 — Leaderboard UI + IPC handlers + multi-signal ambient wiring |
| **Dev 3** | Phase 5 — Pet evolution, streak system, Lock In score, celebrations |
| **Dev 4** | Dashboard polish, add emotion/fatigue displays, overall UI refinement |

### Hour 40–48 (Final Polish)
| Person | Task |
|--------|------|
| **Dev 1** | Kibana dashboard + Elasticsearch analytics |
| **Dev 2** | Gamma reset safety, error handling, edge cases |
| **Dev 3** | Pet polish, landing page / onboarding screen |
| **Dev 4** | Demo script, presentation slides, rehearsal coordination |

---

## Competitive / Multiplayer: Lock In Board

The **Lock In Board** is a competitive leaderboard that turns posture wellness into a shared experience.

### Why This Matters
- Solo wellness tools get abandoned. Competition creates accountability.
- A leaderboard is inherently demo-able — show entries climbing in real-time.
- Adds a fun competitive angle without detracting from the core ambient concept.

### Lock In Score (0-100)
Composite score driving all gamification:
```
lockInScore = (postureScore * 0.5) + (focusScore * 0.3) + ((100 - fatigueScore) * 0.2)
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

## Key Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| ML models too slow in Electron renderer | No real-time feedback = no product | Test in Phase 1 hour 2–4. Fallback: reduce to posture-only, drop emotion. Hard limit: must hit 10fps. Electron's Chromium should perform same as Chrome. |
| Posture algorithm inaccurate | Scores feel random, kills trust | Calibration baseline makes it relative to each person. Smooth with rolling average. Test on multiple people early. |
| `brightness` CLI doesn't work on team member's Mac | No brightness control | Fallback: AppleScript brightness keys, or IOKit direct calls. Test on every team member's machine in Phase 2. |
| CoreGraphics gamma doesn't reset on crash | Screen stuck amber after force quit | Register `process.on('SIGTERM')`, `app.on('will-quit')`, AND `process.on('uncaughtException')` handlers that all reset gamma to (1.0, 1.0, 1.0). |
| Three.js pet too complex to build in time | No pet | Start with a glowing orb/blob that breathes and changes color. Upgrade to animal shape only if time allows. An orb with good animations > a bad animal model. |
| Elasticsearch unreachable / setup fails | No leaderboard or analytics | Build it last. Core product works 100% without it. Leaderboard falls back to electron-store (local only). |
| Demo environment has bad lighting | ML accuracy drops | Test in the demo room. Adjust confidence thresholds. Have a backup screen recording of it working. |

---

## Key Implementation Details

### Electron Security (contextBridge)

Never expose `ipcRenderer` directly to the renderer. Use `contextBridge`:

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('kinetic', {
  updateAmbient: (data: { brightness: number; warmth: number }) =>
    ipcRenderer.send('ambient:update', data),
  sendBiometric: (event: BiometricEvent) =>
    ipcRenderer.send('biometric:event', event),
  getLeaderboard: () => ipcRenderer.invoke('leaderboard:get'),
  upsertLeaderboard: (entry: LeaderboardEntry) =>
    ipcRenderer.invoke('leaderboard:upsert', entry),
});
```

### Webcam in Electron

Electron handles camera permissions via `systemPreferences.askForMediaAccess('camera')` on macOS. Must be called from main process before renderer tries to access webcam.

```typescript
// main.ts (on app ready)
import { systemPreferences } from 'electron';
await systemPreferences.askForMediaAccess('camera');
```

Then in renderer, standard `navigator.mediaDevices.getUserMedia({ video: true })` works.

### Rolling Average for Smoothing

```typescript
class RollingAverage {
  private buffer: number[] = [];
  constructor(private windowSize: number) {}

  push(value: number): number {
    this.buffer.push(value);
    if (this.buffer.length > this.windowSize) this.buffer.shift();
    return this.buffer.reduce((a, b) => a + b, 0) / this.buffer.length;
  }
}

// Usage: 10-second window at 15fps = 150 samples
const postureSmoothed = new RollingAverage(150);
// On each ML frame:
const smoothedScore = postureSmoothed.push(rawPostureScore);
```
