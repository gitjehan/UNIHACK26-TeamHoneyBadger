# KINETIC — UNIHACK 2026

**KINETIC** is a bio-responsive ambient workspace. Your webcam watches your posture, fatigue, and emotion using real-time computer vision — then instead of sending you a notification, it subtly shifts your entire digital environment. Screen warmth, brightness, ambient audio, and a living pet companion all respond to how you're sitting and feeling. No popups. No interruptions. Your workspace just adapts.

> **Pitch**: "KINETIC is a desktop app that uses your webcam to track your posture, fatigue, and emotion in real-time — then adapts your screen warmth, brightness, and a virtual pet companion to keep you healthy without ever interrupting you."

---

## Context

UNIHACK 2026 — 48-hour hackathon, 500+ students, $7k+ prizes.

**Team**: 4-5 members, first hackathon. Eligible for First Timers Prize.

This plan covers strategic analysis, technical architecture, and execution strategy.

---

## Idea Analysis: How KINETIC Aligns with UNIHACK Judging

### Judging Criteria Mapping

| Criterion | How KINETIC Scores | Strength |
|-----------|-------------------|----------|
| **Originality/Creativity** | No existing product uses ambient UI as biofeedback. Every competitor (SitApp, Zen, UPRIGHT GO) uses notifications. This is a genuinely new paradigm. | **Very Strong** |
| **Technical Difficulty** | Multiple real-time ML models (pose, emotion, blink rate) running simultaneously in-browser + Elasticsearch telemetry + Three.js visualization | **Strong** |
| **Polish/Design/Execution** | The ambient response IS the design — screen color shifting, Bio-Pet reacting. Inherently visual and demo-able. | **Strong** |
| **Wow Factor** | A live demo where the presenter slouches and the entire screen responds in real-time is an undeniable "show your friends" moment | **Very Strong** |

### Key Pitch Line
> "Every wellness app interrupts you to tell you something's wrong. KINET IC is different —your workspace IS the feedback. No notifications. No interruptions. Just your world, adapting to you."

---

## Past Winner Pattern Analysis

### UNIHACK 2025 Winners
- **1st: Growth Garden** — AI + gamification + personal wellness. Judges praised "thoughtful design and meaningful purpose."
- **2nd: Shuffl** — Hardware/software integration + accessibility. Tested with visually impaired users.
- **3rd: Weave** — Computer vision + practical utility.
- **Most Creative: EYEVISION** — AI vision for accessibility.
- **People's Choice: ShelfAware** — Universally relatable problem (food expiry).
- **Best Design + Social Impact: Cryptarity** — Double-prize win showing well-rounded projects sweep.

### UNIHACK 2024 Winners
- Dominated by health/wellness/food themes (W.I.M.P., PillPal, MyFridge, BiteBalance)
- People's Choice: BiteBalance (AI + nutrition)

### Patterns That Favor KINETIC
1. **AI is universal among winners** — KINETIC uses AI as its core
2. **Health/wellness is a recurring winning theme** — Growth Garden, BiteBalance, PillPal all won
3. **Gamification scores high on Wow Factor** — Growth Garden's virtual garden; KINETIC's Bio-Pet
4. **Double-prize wins are possible** — Cryptarity won 2 prizes in 2025
5. **Practical, relatable problems win People's Choice** — Everyone has bad desk posture


---

## Prize Targeting Strategy

### Primary Target: 1st Place ($5,000)
KINETIC's ambient biofeedback concept is genuinely novel with strong technical depth.

### Secondary Target: Best Use of Elastic ($100 Prezzee Card)
Low-competition sponsor prize. KINETIC's continuous biometric telemetry is a natural fit for Elasticsearch time-series indexing. Most teams bolt Elastic on as a search bar — KINETIC uses it as the data backbone.

### Opt-In For (zero extra work):
- **AI Solutions (Quantium)** — AI is the core
- **Most Creative Idea** — ambient paradigm is novel
- **Best Design** — ambient UI is inherently beautiful
- **Most Fun** — Bio-Pet gamification
- **People's Choice** — universally relatable (desk posture)

### Also Target: First Timers Prize (Deltahub Stand)
This is your first hackathon — opt in! Crevo won this in 2025 with a technically impressive ML pipeline, so aim high.

### Skip:
- EU Shared Future (theme doesn't fit naturally)
- Social Impact (stretching the narrative weakens the main pitch)

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

## Competitive / Multiplayer: Lock In Board

KINETIC needs a multiplayer angle to give it stickiness beyond solo use. The **Lock In Board** is a competitive leaderboard that turns posture wellness into a shared experience.

### Why This Matters
- Solo wellness tools get abandoned. Competition creates accountability.
- A leaderboard is inherently demo-able — show entries climbing in real-time during the pitch.
- Adds a "Most Fun" angle for judging without detracting from the core ambient concept.

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
- Pre-seed with 3-4 entries so the board isn't empty during demo
- **Demo power move**: show the leaderboard, then show a live entry climbing in real-time as the presenter sits up straight

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