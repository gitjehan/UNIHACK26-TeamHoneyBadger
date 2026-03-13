# KINETIC — MASTER PLAN (UNIHACK 2026)

**KINETIC** is a bio-responsive ambient workspace. Your webcam watches your posture, fatigue, and emotion using real-time computer vision — then instead of sending you a notification, it subtly shifts your entire digital environment. Screen warmth, brightness, ambient audio, and a living pet companion all respond to how you're sitting and feeling. No popups. No interruptions. Your workspace just adapts.

> **Pitch**: "KINETIC is a desktop app that uses your webcam to track your posture, fatigue, and emotion in real-time — then adapts your screen warmth, brightness, and a virtual pet companion to keep you healthy without ever interrupting you."

---

## Context

UNIHACK 2026 — 48-hour hackathon, 500+ students, $7k+ prizes.

**Team**: 4-5 members, first hackathon. Eligible for First Timers Prize.

This plan covers technical architecture, execution order, and timeline.

---

## Technical Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 + TypeScript + Tailwind CSS |
| Pose Tracking | `@mediapipe/tasks-vision` (Pose Landmarker) |
| Face/Emotion | `@vladmandic/human` (maintained fork replacing archived face-api.js) |
| 3D Visualization | Three.js |
| Data Pipeline | `@elastic/elasticsearch` → Elastic Cloud |
| Analytics Viz | Kibana (embedded/screenshotted) |
| Charting | Recharts or Chart.js |
| Ambient Effects | CSS custom properties + `filter` + smooth transitions |
| Audio (stretch) | Tone.js or Web Audio API |
| Deployment | Vercel |
| Build Tool | Vite (via Next.js) |

### Why No Supabase / Extra Database?
- Elasticsearch already covers server-side storage (biometrics + leaderboard)
- No user accounts needed — leaderboard is nickname-based
- localStorage handles client-side state (pet evolution, personal stats)
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
- Elasticsearch indexing: Every 5 seconds, batched via bulk API

### Data Model (Elasticsearch)

```typescript
interface BiometricEvent {
  timestamp: string;
  sessionId: string;
  posture: { score: number; shoulderAngle: number; neckLean: number; isSlumping: boolean };
  emotion: { dominant: string; confidence: number };
  fatigue: { blinkRate: number; score: number; eyeAspectRatio: number };
  ambient: { screenWarmth: number; brightness: number; petState: string };
}
```

---

## Feature Prioritization

### Tier 1: MUST SHIP — The Demo-able Core
1. Webcam posture detection with real-time score (0-100)
2. **Ambient screen response**: CSS filter changes (warmth, brightness, saturation) driven by posture
3. Real-time dashboard: posture gauge + 5-min rolling chart
4. Elasticsearch data pipeline: biometric events indexed every 5s

### Tier 2: SHOULD SHIP — Full Product Feel
5. Emotion detection displayed in dashboard
6. Blink rate / fatigue score from eye landmarks
7. **Pet**: Three.js creature with 5 emotional states, eye contact, breathing, ear physics, posture mirroring
8. Multi-signal ambient response (posture + emotion + fatigue all affect environment)
9. Lock In score (composite) + streak counter with pet reactions + pet evolution (localStorage)

### Tier 3: NICE TO HAVE — Prize Multipliers
10. **Lock In Board** — competitive leaderboard (Elasticsearch-backed, nickname entry, pet avatars)
11. Ambient audio shifting with wellness state
12. Elasticsearch analytics dashboard (session history, trends, insights)
13. Kibana visualization for Elastic prize
14. Onboarding calibration flow

### What to CUT if behind:
- Cut bottom-up (14 → 9)
- **NEVER cut**: Posture detection, ambient screen response, real-time dashboard — these ARE the product
- Reframe "predict fatigue 15 min ahead" as "fatigue trend monitoring" (true prediction is infeasible at this scope)

---

## Execution Order & Build Phases

This is the critical section. The order matters — build the riskiest, most uncertain pieces first so you fail fast, and layer polish on top.

### Phase 0: Project Setup (Hour 0–1)
**Goal**: Everyone can run the app locally.

- [ ] `npx create-next-app@latest kinetic --typescript --tailwind --app`
- [ ] Set up Git repo, push initial commit, everyone clones
- [ ] Install core dependencies: `@mediapipe/tasks-vision`, `@vladmandic/human`, `three`, `recharts`
- [ ] Create basic page layout with placeholder sections (webcam feed, dashboard panel, ambient overlay)
- [ ] Verify webcam access works in browser (`navigator.mediaDevices.getUserMedia`)

**Who**: 1 person sets up, everyone else reads the plan and understands the architecture.

### Phase 1: ML Spike — Posture Detection (Hour 1–6)
**Goal**: Webcam → posture score number on screen. This is the riskiest piece — if this doesn't work, nothing works.

- [ ] **ML library test** (Hour 1–2): Try `@vladmandic/human` with pose + face config. Measure FPS. If pose accuracy is bad, switch to MediaPipe Pose Landmarker.
- [ ] **Posture algorithm** (Hour 2–4): Take shoulder landmarks + nose/ear landmarks → calculate:
  - Shoulder symmetry (are shoulders level?)
  - Forward head position (how far is nose ahead of shoulders?)
  - Slouch angle (vertical alignment of spine landmarks)
  - Combine into a 0–100 posture score
- [ ] **Calibration snapshot** (Hour 4–5): On first load, prompt user to sit up straight for 3 seconds. Store their "ideal" landmark positions. Score is relative to their baseline, not absolute.
- [ ] **Wire to UI** (Hour 5–6): Display live posture score as a big number + color indicator (green/yellow/red)

**Output**: A page showing your webcam feed and a live posture score that changes when you slouch.

**Risk mitigation**: If the ML libraries are too slow or inaccurate, simplify the posture algorithm to just shoulder angle + head forward lean. Two signals is enough.

### Phase 2: Ambient Screen Response (Hour 6–10)
**Goal**: The screen visually reacts to your posture. This is the wow factor.

- [ ] **CSS ambient layer** (Hour 6–7): Create a full-screen overlay `div` with CSS `filter` and `background`. Wire it to posture score:
  - Good posture (70–100): Cool blue-white tones, normal brightness
  - Medium posture (40–70): Warm shift (increase CSS `sepia` + `hue-rotate`), slight dim
  - Bad posture (0–40): Strong warm/orange tint, noticeable dim, slight vignette
- [ ] **Smooth transitions** (Hour 7–8): Use CSS `transition: filter 2s ease` so changes feel ambient, not jarring. Add a rolling average (last 10 seconds) so the screen doesn't flicker from frame-to-frame noise.
- [ ] **Tune the feel** (Hour 8–10): This is subjective. Spend time getting the ambient shift to feel *subtle but noticeable*. The transition speed and intensity thresholds matter more than the algorithm.

**Output**: Slouch in your chair → screen slowly shifts warm and dims. Sit up → screen cools back to normal. No popups, no alerts.

### Phase 3: Real-Time Dashboard (Hour 10–16)
**Goal**: Professional-looking dashboard alongside the ambient experience.

- [ ] **Layout** (Hour 10–11): Split screen — left side is the ambient workspace area, right side is a dashboard panel (collapsible). Or: dashboard as a floating overlay.
- [ ] **Posture gauge** (Hour 11–13): Circular gauge component (Recharts or custom SVG) showing current posture score. Color matches ambient state.
- [ ] **Rolling chart** (Hour 13–15): Line chart showing posture score over the last 5 minutes. Update every second. Use Recharts `LineChart` with a fixed-length data array (300 points for 5 min at 1/sec).
- [ ] **Stats cards** (Hour 15–16): Current session duration, average posture score, time spent in "good" vs "bad" posture. All calculated client-side from the rolling data buffer.

**Output**: A polished dashboard that updates in real-time alongside the ambient screen effects.

### Phase 4: Emotion + Fatigue Detection (Hour 16–22)
**Goal**: Add face/emotion and blink tracking to make it multi-signal.

- [ ] **Emotion detection** (Hour 16–18): Use `@vladmandic/human` face module → extract dominant emotion (happy, sad, angry, surprised, neutral). Display as an emoji or label on the dashboard. Run at 1–5fps (separate loop from posture).
- [ ] **Blink rate / fatigue** (Hour 18–20): From eye landmarks, calculate Eye Aspect Ratio (EAR). Detect blinks (EAR drops below threshold momentarily). Track blinks per minute. High blink rate or prolonged low EAR = fatigue. Score 0–100.
- [ ] **Multi-signal ambient** (Hour 20–22): Now the ambient response considers all three signals:
  - Posture drives warmth/brightness (already done)
  - Fatigue adds a subtle pulsing dim effect (like the screen is "tired" with you)
  - Emotion is displayed but doesn't drive ambient (emotions are too noisy to control the environment)
- [ ] **Dashboard update**: Add emotion indicator + fatigue gauge + blink rate to the dashboard.

**Output**: Dashboard now shows posture + emotion + fatigue. Screen ambient responds to posture and fatigue.

### Phase 5: Bio-Pet (Hour 22–32)
**Goal**: A Three.js creature that mirrors your state. This is the gamification hook.

- [ ] **Basic pet model** (Hour 22–25): Simple low-poly creature (blob/cat/fox shape) rendered with Three.js. Start with a basic geometry + shader or use a free GLTF model. Must have:
  - Idle breathing animation (scale oscillation)
  - Eye tracking (eyes follow a point, can be tied to user's head position)
- [ ] **Pet emotional states** (Hour 25–28): 5 states driven by Lock In score:
  - **Thriving** (80–100): Bouncy, glowing, particles
  - **Content** (60–80): Calm breathing, soft glow
  - **Neutral** (40–60): Normal idle
  - **Tired** (20–40): Droopy, slower animation, yawning
  - **Distressed** (0–20): Shaking, dull colors, curled up
- [ ] **Posture mirroring** (Hour 28–30): Pet slouches when you slouch. Subtle but noticeable lean/droop tied to posture score.
- [ ] **Lock In score + streaks** (Hour 30–32):
  - `lockInScore = (postureScore * 0.5) + (focusScore * 0.3) + ((100 - fatigueScore) * 0.2)`
  - Streak counter: consecutive minutes with score > 70
  - 30-second grace period before streak breaks
  - Pet reacts to streak milestones (happy bounce at 10 min, celebration at 30 min)
- [ ] **Pet evolution** (Hour 32): 5 levels stored in localStorage:
  - Level 1: Hatchling (0 min) → Level 2: Fledgling (30 min) → Level 3: Companion (120 min) → Level 4: Guardian (300 min) → Level 5: Ascended (600 min)
  - Evolution is based on cumulative "locked in" minutes across all sessions

**Output**: A living pet on screen that reacts to how you're sitting, evolves over time, and adds emotional investment to the posture tracking.

### Phase 6: Elasticsearch Integration (Hour 32–38)
**Goal**: Biometric data pipeline + leaderboard. Do this LAST — it's the easiest part and the least risky.

- [ ] **Elastic Cloud setup** (Hour 32–33): Create free Elastic Cloud trial. Get endpoint + API key. Create index `kinetic-biometrics` with the BiometricEvent mapping.
- [ ] **Data pipeline** (Hour 33–35): Every 5 seconds, batch the last 5 seconds of biometric data and POST to Elasticsearch via a Next.js API route (to keep the API key server-side). This is a simple `POST /_bulk` call.
- [ ] **Leaderboard** (Hour 35–37):
  - Create index `kinetic-leaderboard`
  - Nickname entry on first visit (stored in localStorage)
  - On session end (or every 60 seconds), upsert leaderboard entry with: nickname, avg Lock In score, best streak, pet level
  - Leaderboard page: query top 20 entries sorted by `avgLockInScore` desc
  - Pre-seed 3–4 fake entries so it's not empty during demo
- [ ] **Kibana dashboard** (Hour 37–38): Create a Kibana dashboard with:
  - Time-series chart of posture score
  - Pie chart of emotion distribution
  - Average session stats
  - Screenshot or embed in the app for the Elastic prize

**Output**: All biometric data flowing to Elasticsearch. Leaderboard functional. Kibana dashboard for Elastic prize.

### Phase 7: Polish & Demo Prep (Hour 38–48)
**Goal**: Make it demo-ready and beautiful.

- [ ] **UI polish** (Hour 38–42):
  - Landing page / hero section explaining KINETIC
  - Smooth transitions everywhere
  - Loading states for webcam/ML initialization
  - Error states (webcam denied, ML failed to load)
  - Mobile-responsive (desktop-first, but should look decent on mobile)
  - Dark mode (the ambient effects look better on dark backgrounds)
- [ ] **Demo script** (Hour 42–44): Plan the exact 3-minute demo flow:
  1. Open KINETIC, show the landing page (5 sec)
  2. Grant webcam, show calibration (10 sec)
  3. Sit up straight — show green score, happy pet, cool screen (15 sec)
  4. Slouch — screen warms, pet droops, score drops (15 sec)
  5. Show the dashboard with real-time charts (10 sec)
  6. Show the leaderboard with entries (10 sec)
  7. Show Kibana analytics (5 sec)
  8. End with the pitch line
- [ ] **Bug fixes & edge cases** (Hour 44–46): Test on multiple browsers, different lighting conditions, different people.
- [ ] **Presentation slides** (Hour 46–48): 3–5 slides max. Problem → Solution → Demo → Tech → Impact.

---

## Parallel Work Streams

Not everything is sequential. Here's how to split work across 4 team members:

### Hour 0–10 (Foundation)
| Person | Task |
|--------|------|
| **Dev 1 (ML Lead)** | Phase 0 setup → Phase 1 ML spike (posture detection) |
| **Dev 2 (Frontend)** | Phase 0 setup → Build dashboard layout, gauge component, chart component with mock data |
| **Dev 3 (Creative)** | Research Three.js pet models, start building basic pet with idle animation using mock score data |
| **Dev 4 (Design)** | Design the ambient color system, build the CSS overlay layer, test transition speeds with mock scores |

### Hour 10–22 (Core Features)
| Person | Task |
|--------|------|
| **Dev 1** | Phase 4 — Emotion + fatigue detection |
| **Dev 2** | Phase 3 — Wire real posture data into dashboard (replacing mocks) |
| **Dev 3** | Phase 5 — Pet emotional states + posture mirroring |
| **Dev 4** | Phase 2 — Wire real posture data into ambient overlay + tune the feel |

### Hour 22–38 (Integration & Backend)
| Person | Task |
|--------|------|
| **Dev 1** | Phase 6 — Elasticsearch setup + data pipeline |
| **Dev 2** | Phase 6 — Leaderboard UI + API routes |
| **Dev 3** | Phase 5 — Pet evolution + streak reactions + Lock In score |
| **Dev 4** | Multi-signal integration — wire emotion + fatigue into dashboard + ambient |

### Hour 38–48 (Polish)
| Person | Task |
|--------|------|
| **Dev 1** | Kibana dashboard + Elasticsearch analytics |
| **Dev 2** | UI polish, error states, loading states |
| **Dev 3** | Pet polish, landing page visuals |
| **Dev 4** | Demo script, presentation slides, rehearsal |

---

## Competitive / Multiplayer: Lock In Board

KINETIC needs a multiplayer angle to give it stickiness beyond solo use. The **Lock In Board** is a competitive leaderboard that turns posture wellness into a shared experience.

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
- Nickname-based entry (text input on first visit, no account needed)
- Elasticsearch index: `kinetic-leaderboard`
- Sorted by highest average Lock In score per session
- **Each entry shows the user's pet at its current evolution stage** — visual contrast between a wobbly Hatchling and a glowing Ascended sells the system instantly
- Shows: rank, nickname, pet avatar (at current level), best streak (min), avg score
- Pre-seed with 3-4 entries so the board isn't empty on first load

### Streak System
- Track consecutive minutes with Lock In score > 70
- Display as: **"Locked in for 47 min"**
- 30-second grace period (score can dip below 70 briefly without breaking streak)
- Streak milestones trigger pet reactions (see Pet section)

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
| ML models too slow in-browser | No real-time feedback = no product | Test in Phase 1 hour 1–2. Fallback: reduce to posture-only, drop emotion. Hard limit: must hit 10fps. |
| Posture algorithm inaccurate | Scores feel random, kills trust | Use calibration baseline. Smooth with rolling average. Test on multiple people early. |
| Three.js pet too complex to build | No pet = weaker experience | Start with a simple glowing orb/blob that breathes and reacts. Upgrade to animal shape only if time allows. |
| Elasticsearch integration fails | No leaderboard or analytics | Build it last. The core product works 100% without it. Leaderboard can fall back to localStorage (single-device only). |
| Webcam permission denied | App doesn't work | Show a clear error state with instructions. Test on multiple browsers. |
| Demo environment has bad lighting | ML accuracy drops during live demo | Test in the demo room lighting. Adjust ML confidence thresholds. Have a backup recording. |

