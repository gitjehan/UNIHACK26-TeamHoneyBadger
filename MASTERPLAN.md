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
│  Kinetic  bio-responsive workspace     [Upright] [Slouching] [Fatigued]  │
├──────────────┬──────────────────────────────┬───────────────┤
│              │  ┌─Posture──┐ ┌─Blink Rate─┐ │   OVERALL    │
│  DIGITAL     │  │  88 /100 │ │  17 bpm    │ │              │
│  TWIN        │  │  Good    │ │  Good      │ │    84        │
│              │  └──────────┘ └────────────┘ │   (gauge)    │
│  (stick      │  ┌─Focus────┐ ┌─Stress─────┐ │              │
│   figure)    │  │  82 /100 │ │  18 /100   │ ├──────────────┤
│              │  │  Good    │ │  Good      │ │  SYSTEMS     │
│  0.5° tilt   │  └──────────┘ └────────────┘ │  Pose Det  ● │
│              ├──────────────────────────────┤  Face Mesh ● │
│  ALIGNMENT   │  WEBCAM — MEDIAPIPE HOLISTIC │  Affect    ● │
│    88 /100   │  (live feed with overlay)    │  Ambient   ● │
│              │  30 fps · 543 pts            ├──────────────┤
├──────────────┼──────────────────────────────┤  AMBIENT     │
│  BIO-PET     │  SESSION TIMELINE            │  RESPONSE    │
│              │  Posture ───── 88            │  Environment │
│  (creature)  │  Focus   ───── 82            │  stable.     │
│  Thriving    │  Stress  ───── 18            │  [calm ▊ elev]│
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

### 8. Bio-Pet States

Based on the mockup, the pet has 3 primary states (not 5 — simpler for implementation):

| State | Overall Score | Visual | Description |
|-------|--------------|--------|-------------|
| **Thriving** | ≥65 | Glowing, happy face, green tones | "Upright posture, steady blink rate, low stress. Your pet glows and blooms with energy." |
| **Fading** | 30–64 | Neutral/sad face, amber tones, dimmer | "Shoulders rounding, blink rate dropping. Your pet loses petals and its glow dims." |
| **Wilting** | <30 | Distressed face, red tones, curled in | "Deep slouch, eye fatigue, high cognitive load. Your pet curls inward, urging a reset." |

Each pet state card shows: Posture score, Focus score, Stress score.

---

## Feature Prioritization

### Tier 1: MUST SHIP — The Demo-able Core
1. Webcam posture detection (neck angle + shoulder slant + trunk lean → composite score 0-100)
2. Calibration flow (sit up straight for 3 seconds → personalized baseline)
3. Digital Twin — live stick figure with color-coded landmarks and tilt angle display
4. **Real ambient screen response**: macOS brightness + color temperature shifts driven by posture score
5. Dashboard with 4 metric cards (Posture, Blink Rate, Focus, Stress) + overall circular gauge

### Tier 2: SHOULD SHIP — Full Product Feel
6. Blink rate detection via EAR + fatigue scoring
7. Stress estimation (affect engine + posture variance + blink deviation)
8. Focus score (composite of posture stability + inverse fatigue + inverse stress)
9. Session timeline sparkline charts (Posture, Focus, Stress over time)
10. **Bio-Pet**: Three.js creature with 3 states (Thriving / Fading / Wilting), posture mirroring
11. Multi-signal ambient response (posture + fatigue both drive brightness/warmth)
12. Systems status panel + Ambient Response panel

### Tier 3: NICE TO HAVE — Extras
13. Streak counter + pet evolution (electron-store persistence across sessions)
14. **Lock In Board** — competitive leaderboard (Elasticsearch-backed, nickname entry, pet avatars)
15. Elasticsearch data pipeline: biometric events indexed every 5s
16. Elasticsearch analytics dashboard (session history, trends)
17. Kibana visualization
18. Ambient audio shifting with wellness state

### What to CUT if behind:
- Cut bottom-up (18 → 12)
- **NEVER cut**: Posture detection, digital twin, real brightness/gamma ambient response, dashboard — these ARE the product
- If pet takes too long, ship a simple glowing orb that breathes and changes color
- If Elasticsearch isn't ready, the entire app works without it — it's all local

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

### Phase 1: ML Spike — Posture Detection + Digital Twin (Hour 2–8)
**Goal**: Webcam → posture score on screen + live stick figure. This is the riskiest piece — if this doesn't work, nothing works.

- [ ] **ML library test** (Hour 2–3): Load `@vladmandic/human` in the renderer with pose config enabled. Draw landmarks on a canvas overlay. Measure FPS. Key questions:
  - Does it detect landmarks 0, 7, 8, 11, 12, 23, 24 (nose, ears, shoulders, hips) accurately?
  - What FPS do we get? (Need ≥10fps minimum)
  - If accuracy is bad → switch to `@mediapipe/tasks-vision` Pose Landmarker
- [ ] **Digital Twin renderer** (Hour 3–4): Canvas component that draws the stick figure:
  - Map normalised landmarks to canvas coordinates
  - Draw POSE_CONNECTIONS lines + circles at joints (see Section 6 in Core Functionality)
  - Color-code: green (good), amber (fair), red (poor)
  - Display tilt angle below the figure
  - Smooth positions with lerp between frames
- [ ] **Posture algorithm** (Hour 4–6): Implement the 3-metric system (see Section 1 in Core Functionality):
  - **Neck Inclination**: `atan2` angle at shoulder formed by ear-shoulder-hip. Threshold: <150° = slouching
  - **Shoulder Slant**: `atan2` of shoulder-to-shoulder line vs horizontal. Display as "X.X° tilt"
  - **Trunk Lean**: Cosine similarity between current shoulder→hip vector and calibrated upright vector
  - **Composite score**: `neckScore * 0.45 + shoulderScore * 0.20 + trunkScore * 0.35`
- [ ] **Calibration** (Hour 6–7): On first launch, prompt "Sit up straight and look at the screen". Capture 3 seconds (45 frames at 15fps). Average landmarks to get baseline vectors + angles. Store in electron-store.
- [ ] **Wire to UI** (Hour 7–8): Show posture score as big number + the Digital Twin stick figure side by side. Score color coded: green ≥70, amber 40–69, red <40.

**Output**: Electron app with live webcam feed, a Digital Twin stick figure that moves with you, and a posture score that drops when you slouch.

**Risk mitigation**: If cosine similarity doesn't work well, fall back to just neck angle + shoulder slant (two metrics). Two signals is enough.

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

### Phase 3: Dashboard (Hour 12–18)
**Goal**: Build the full dashboard matching the mockup design (see Section 7 in Core Functionality).

- [ ] **Layout skeleton** (Hour 12–13): Implement the grid layout from the mockup:
  - Left column: Digital Twin (already built) + Bio-Pet placeholder
  - Center top: 4 metric cards (Posture, Blink Rate, Focus, Stress) — show posture score live, others as "--" placeholder
  - Center middle: Webcam feed with MediaPipe overlay + FPS/landmark count
  - Center bottom: Session Timeline (3 sparkline charts)
  - Right column: Overall gauge + Systems panel + Ambient Response panel
  - Header: "Kinetic bio-responsive workspace" + state tabs (Upright / Slouching / Fatigued)
- [ ] **Metric cards** (Hour 13–14): Reusable card component with: metric name, value, unit, status badge (Good/Fair/Poor). Use threshold table from Section 7.
- [ ] **Overall circular gauge** (Hour 14–15): Custom SVG arc gauge showing 0–100. Color transitions: green → amber → red. For now, just mirrors posture score (other inputs come in Phase 4).
- [ ] **Session Timeline** (Hour 15–16): Three Recharts sparkline `AreaChart` components showing Posture, Focus, Stress over session. Rolling buffer of 300 data points (1/sec for 5 min). Use `isAnimationActive={false}` for performance.
- [ ] **Systems panel** (Hour 16–17): Status indicators with green/amber/red dots for: Pose Detection, Face Mesh, Affect Engine, Ambient Ctrl. Wired to actual system state.
- [ ] **Ambient Response panel** (Hour 17–18): Text description of current ambient state + calm-to-elevated slider visualisation.
- [ ] **State tabs** (Hour 18): Wire the Upright/Slouching/Fatigued tabs to overall score thresholds (≥65 / 30–64 / <30). Active tab changes dashboard color theme subtly.

**Output**: The full dashboard from the mockup, with live posture data flowing. Blink/Focus/Stress cards show placeholder until Phase 4.

### Phase 4: Blink Rate + Stress + Focus (Hour 18–24)
**Goal**: Complete all 4 metrics. The dashboard goes from 1 live metric to 4.

- [ ] **Face mesh activation** (Hour 18–19): Enable `@vladmandic/human` face module. Run at 5fps in a separate loop from posture (15fps). Verify it detects 468 face landmarks including eye landmarks.
- [ ] **EAR + Blink detection** (Hour 19–21): Implement the EAR formula from Section 2:
  - Calculate EAR for both eyes each frame, average them
  - Detect blinks: EAR < 0.20 for 1–5 frames then recovers
  - Track blinks per minute (rolling 60-second window)
  - Detect prolonged closures (EAR < 0.20 for >5 frames)
  - Display blink rate in bpm on the Blink Rate card
- [ ] **Stress estimation** (Hour 21–22): Implement stress score from Section 3:
  - Emotion component from `@vladmandic/human` affect module (angry/fearful = high stress, happy/neutral = low)
  - Posture variance component (fidgeting detection — stddev of posture score over 60s window)
  - Blink rate deviation component
  - Composite: `emotionScore * 0.4 + fidgetScore * 0.35 + blinkStress * 0.25`
- [ ] **Focus score** (Hour 22–23): Implement from Section 4:
  - `postureScore * 0.3 + (100 - fatigueScore) * 0.25 + (100 - stressScore) * 0.20 + postureStability * 0.25`
  - Posture stability = inverse of posture variance over last 2 minutes
- [ ] **Overall score + multi-signal ambient** (Hour 23–24):
  - Overall = `postureScore * 0.40 + focusScore * 0.35 + (100 - stressScore) * 0.25`
  - Update ambient mapping: posture drives warmth, fatigue (derived from blink) drives brightness dimming
  - Wire all 4 metric cards + overall gauge to live data
  - Wire session timeline charts to live data

**Output**: All 4 metric cards live. Overall gauge accurate. Ambient responds to multiple signals. Dashboard fully functional.

### Phase 5: Bio-Pet (Hour 24–34)
**Goal**: A Three.js creature that mirrors your state and evolves over time.

- [ ] **Basic pet rendering** (Hour 24–27): Render a simple creature in a designated area of the dashboard using Three.js. Start simple:
  - Option A: Low-poly geometric creature (sphere body, smaller sphere head, dot eyes) — buildable from Three.js primitives in a few hours
  - Option B: Free GLTF model from Sketchfab/Poly Pizza — looks better but integration takes longer
  - Must have: idle breathing animation (smooth scale oscillation on Y axis)
  - Nice to have: eyes that follow mouse or head position from webcam
- [ ] **Pet 3-state system** (Hour 27–30): Driven by Overall score (matching mockup):
  - **Thriving** (overall ≥ 65): Happy face, glowing, green tones, bouncy idle. "Your pet glows and blooms with energy."
  - **Fading** (overall 30–64): Neutral/concerned face, amber tones, dimmer glow, slower animation. "Your pet loses petals and its glow dims."
  - **Wilting** (overall < 30): Distressed face, red tones, curled in, shaking. "Your pet curls inward, urging a reset."
  - Each state shows: Posture score, Focus score, Stress score beneath the pet (as in mockup)
  - Transitions between states: gradual (lerp colors/scale over 3–5 seconds)
- [ ] **Posture mirroring** (Hour 30–31): Pet's body tilt matches your posture. If you lean left, pet leans left. If you slouch forward, pet droops forward. Subtle but noticeable. Driven by the same shoulder slant angle displayed in the Digital Twin.
- [ ] **Streak system** (Hour 31–33):
  - Streak: consecutive minutes with Overall score ≥ 65 (Thriving state)
  - 30-second grace period (score can dip below 65 briefly without breaking streak)
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

**Output**: A living pet in the dashboard's bottom-left panel that reacts to how you're sitting, has 3 visible states, and evolves the more you use KINETIC.

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
| **Dev 1 (ML Lead)** | Phase 0 scaffold → Phase 1: ML spike (posture algorithm: neck angle, shoulder slant, trunk cosine similarity + calibration + Digital Twin canvas) |
| **Dev 2 (Systems)** | Phase 0 help → Phase 2: brightness CLI + gamma Swift helper (compile, test, IPC wiring, smoothing) |
| **Dev 3 (Creative)** | Research Three.js pet approaches, build basic pet with breathing animation + 3-state system (Thriving/Fading/Wilting) using mock scores |
| **Dev 4 (Frontend)** | Build full dashboard layout from mockup: 4 metric cards, overall gauge, systems panel, ambient response panel, session timeline — all with mock data |

### Hour 12–24 (Core Features)
| Person | Task |
|--------|------|
| **Dev 1** | Phase 4: Face mesh → EAR blink detection → stress estimation → focus score → wire all 4 metrics live |
| **Dev 2** | Phase 2 finish (feel tuning) → wire multi-signal ambient (posture + fatigue → brightness/warmth) |
| **Dev 3** | Phase 5: Pet posture mirroring + state transitions driven by overall score |
| **Dev 4** | Phase 3: Wire live ML data into dashboard, state tabs (Upright/Slouching/Fatigued), session timeline charts |

### Hour 24–40 (Integration & Polish)
| Person | Task |
|--------|------|
| **Dev 1** | Phase 6: Elasticsearch setup + biometric data pipeline |
| **Dev 2** | Phase 6: Leaderboard UI + IPC handlers |
| **Dev 3** | Phase 5: Pet evolution + streak system + electron-store persistence |
| **Dev 4** | Dashboard polish: webcam overlay with FPS/landmark count, overall UI refinement |

### Hour 40–48 (Final Polish)
| Person | Task |
|--------|------|
| **Dev 1** | Kibana dashboard + Elasticsearch analytics |
| **Dev 2** | Gamma reset safety, error handling, edge cases |
| **Dev 3** | Pet polish, onboarding/calibration screen |
| **Dev 4** | Demo script, presentation slides, rehearsal coordination |

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
