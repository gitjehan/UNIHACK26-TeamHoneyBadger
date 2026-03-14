# Axis — Critical Bugfix Tasks

**Priority**: HACKATHON DEADLINE. Every task below must result in visibly working, smooth behaviour.

---

## Parallel Execution Plan

```
ROUND 1 — COMPLETED
  [Task 1] Performance & Lag           → score-engine.ts, App.tsx, constants.ts        ✅
  [Task 2] Digital Twin Visual Quality  → DigitalTwin.tsx only                          ✅
  [Task 3] Bio-Pet Glitching           → BioPet.tsx only                               ✅

ROUND 2 — COMPLETED
  [Task 4] Posture Tracking Accuracy   → posture-scorer.ts, pose-engine.ts, calibration.ts  ✅
  [Task 5] Blink Rate Detection        → blink-detector.ts, face-engine.ts                  ✅
  [Task 6] Webcam CV Overlay           → WebcamFeed.tsx, Dashboard.tsx                       ✅

ROUND 3 — POLISH & DEMO PREP (run all 5 in parallel — zero file overlap):
  [Task 7]  Welcome & Calibration screens  → WelcomeScreen.tsx, CalibrationScreen.tsx
  [Task 8]  Recap Card redesign            → SessionRecapCard.tsx, RecapOverlay.tsx
  [Task 9]  Dark mode theme               → globals.css, BioPet.tsx (scene bg), DigitalTwin.tsx (canvas bg)
  [Task 10] Loading/init progress UI       → App.tsx, new LoadingScreen.tsx
  [Task 11] Streak counter + toasts        → Header.tsx, new StreakDisplay + Toast components

PARALLEL SAFETY:
  Task 7:  WelcomeScreen.tsx, CalibrationScreen.tsx          — unique files
  Task 8:  SessionRecapCard.tsx, RecapOverlay.tsx             — unique files
  Task 9:  globals.css, BioPet.tsx scene bg, DigitalTwin.tsx  — unique (only touches bg color lines)
  Task 10: App.tsx, new LoadingScreen.tsx                     — App.tsx is shared risk with Task 11
  Task 11: Header.tsx, new components                         — Header.tsx is unique

  ⚠️  Tasks 10 & 11 both touch App.tsx — run Task 10 first, then Task 11.
      OR: Task 11 can avoid App.tsx by self-contained event listeners on scoreEngine.
      All other tasks are fully safe to parallelize.
```

---

## Task 1: Fix App Performance / Lag

**Files to modify**: `src/renderer/ml/score-engine.ts`, `src/renderer/App.tsx`, `src/renderer/lib/constants.ts`

### Root Causes Identified

1. **`emit()` fires on every single pose frame (~15fps) AND every face frame (~5fps) AND on every `setSystemStatus` call.** Each `emit()` triggers every React subscriber, which triggers re-renders of the entire Dashboard tree. That's ~20+ full React re-renders per second with no throttling.

2. **BioPet `useEffect` depends on `[modelPath, pet, postureScore, postureTilt]`** — since `pet` is a new object reference on every emit, the entire Three.js scene (scene, renderer, camera, GLTF loader) is **torn down and rebuilt** on every score update. This is the #1 cause of the glitching/fading AND the lag.

3. **`state` object in `App.tsx` (from `useScores()`) is used as a dependency in the biometric send `useEffect` (line 209: `[stage, state]`)** — since `state` is a new object on every emit, this effect re-runs continuously. The `setInterval` is being recreated ~20 times/sec.

4. **Two separate `@vladmandic/human` instances** are created — one in `PoseEngine.initHuman()` and one in `FaceEngine.initHuman()`. Each loads its own copy of the model weights. This doubles memory usage and GPU contention. They fight over the WebGL backend.

5. **`ambientAudio.update()` fires on every score change** (App.tsx line 181) with `[stage, state.snapshot.overall.score, state.snapshot.stress.score]` — if scores change frequently (they do), this hammers the Web Audio API.

### Fixes Required

**A. Throttle `emit()` in `score-engine.ts`:**
```typescript
// Add a frame-throttle: emit at most every 250ms (4fps to UI — plenty smooth)
private lastEmit = 0;
private emitScheduled = false;

private emit(): void {
  const now = Date.now();
  if (now - this.lastEmit < 250) {
    // Schedule one trailing emit so the last state always reaches the UI
    if (!this.emitScheduled) {
      this.emitScheduled = true;
      setTimeout(() => {
        this.emitScheduled = false;
        this.lastEmit = Date.now();
        const current = this.state;
        this.listeners.forEach((l) => l(current));
      }, 250 - (now - this.lastEmit));
    }
    return;
  }
  this.lastEmit = now;
  const current = this.state;
  this.listeners.forEach((l) => l(current));
}
```

**B. Fix the biometric `useEffect` dependency in `App.tsx`:**
Change line 209 from `[stage, state]` to `[stage]`. The `state` is already read inside the interval callback via closure — it doesn't need to be a dependency. The current code recreates the `setInterval` on every render.

**C. Share a single Human instance between PoseEngine and FaceEngine:**
In `App.tsx`, create ONE `@vladmandic/human` instance with both `body` and `face` enabled, then pass it to both engines. Or: run both pose + face detection in a SINGLE engine class that alternates between them (pose on tick, face every 3rd tick). This halves GPU memory and eliminates WebGL context contention.

Alternative simpler fix: Stagger initialization — let PoseEngine finish `init()` before starting FaceEngine `init()`. Currently both `init()` are fired simultaneously (App.tsx lines 145-146) and race for GPU.

**D. Reduce `POSE_FPS` from 15 to 10 in `constants.ts`:**
15fps pose detection is aspirational. On most laptops with Human library, 10fps is more realistic and still smooth. This alone cuts CPU load by 33%.

**E. Throttle `ambientAudio.update()` calls:**
Wrap in a simple time-check: only call if >=2 seconds since last call.

### Acceptance Criteria
- App feels responsive — no visible frame drops in the UI
- CPU usage drops significantly (check Activity Monitor)
- Score updates still feel real-time (4fps to UI is indistinguishable from 15fps for numbers)

---

## Task 2: Improve Digital Twin Visual Quality

**Files to modify**: `src/renderer/components/visualisation/DigitalTwin.tsx`

### Problems Identified

1. **Canvas is tiny (290x280)** but stretched via `width: 100%` — this makes everything blurry because canvas resolution doesn't match display size. No DPI scaling.

2. **Lines are 2px thin** with no rounded caps — looks jagged and clinical.

3. **Joint dots are 3px radius** — barely visible, especially at low resolution.

4. **No landmark smoothing** — raw landmarks jitter frame-to-frame because ML models have per-frame noise. The Digital Twin twitches constantly.

5. **No padding** — landmarks at edges of the frame get clipped against the canvas border.

6. **All landmarks drawn identically** — no visual hierarchy. Shoulders/hips should be larger than wrists/ankles. Head should be distinct.

7. **No background visual** — just a flat color with no depth cue.

### Fixes Required

**A. Fix canvas DPI scaling:**
```typescript
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  // ... rest of drawing at logical coordinates using rect.width/rect.height
}, [landmarks, postureScore]);
```

**B. Add landmark smoothing with lerp:**
Store previous landmark positions in a `useRef`. Each frame, lerp current toward target:
```typescript
const smoothedRef = useRef<Point[]>([]);
// In the effect:
const smoothed = landmarks.map((target, i) => {
  const prev = smoothedRef.current[i];
  if (!prev) return target;
  return {
    x: prev.x + (target.x - prev.x) * 0.35,
    y: prev.y + (target.y - prev.y) * 0.35,
    z: target.z,
    visibility: target.visibility,
  };
});
smoothedRef.current = smoothed;
```
Use `0.35` lerp factor — fast enough to track movement, smooth enough to kill jitter.

**C. Improve line and joint rendering:**
```typescript
ctx.lineWidth = 4;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';
// Add subtle glow
ctx.shadowColor = color;
ctx.shadowBlur = 6;
```

**D. Draw landmarks with visual hierarchy:**
- Shoulders, hips: radius 7, filled
- Head (nose, ears): radius 6, filled
- Elbows, knees: radius 5, filled
- Wrists, ankles: radius 4, filled
- Add a white border ring around each joint for contrast

**E. Add 10% padding** so landmarks don't clip at edges:
```typescript
const mapPoint = (point: Point) => ({
  x: padding + point.x * drawWidth,
  y: padding + point.y * drawHeight,
});
```

**F. Add subtle centerline/grid for posture reference:**
Draw a faint vertical dashed line down the center of the canvas as a "perfect posture" reference. This gives the user an instant visual cue of how far they're leaning.

**G. Add a gradient background** instead of flat color — subtle dark-to-slightly-lighter from top to bottom.

### Acceptance Criteria
- Stick figure is crisp on Retina displays
- Movement is smooth, not twitchy
- Joints are clearly visible with visual hierarchy
- Centerline gives posture reference
- Looks polished enough for a hackathon demo

---

## Task 3: Fix Bio-Pet Glitching and Fading

**Files to modify**: `src/renderer/components/pet/BioPet.tsx`

### Root Causes Identified

1. **CRITICAL: The `useEffect` depends on `[modelPath, pet, postureScore, postureTilt]`.** Since `pet` is a new object reference from the score engine on every tick (~20/sec), the ENTIRE effect re-runs every time. This means:
   - `scene`, `camera`, `renderer` are **destroyed and recreated** ~20 times/sec
   - `mount.innerHTML = ''` clears the canvas, then a new one is appended → visible flash/fade
   - `GLTFLoader.load()` fires ~20 times/sec → network requests pile up
   - `requestAnimationFrame` loops stack up before cleanup runs

   **This is THE bug.** The pet flickers because the Three.js scene is being torn down and rebuilt on every score update.

2. **Health state transitions have no hysteresis.** If the overall score hovers around 65, the pet rapidly switches between Thriving and Fading every frame, causing color/animation oscillation.

3. **`mount.innerHTML = ''`** is a destructive DOM clear that causes a visible frame gap. Even if the effect ran less often, this approach causes flashes.

### Fixes Required

**A. Separate Three.js lifecycle from reactive props:**
Split into TWO effects:
1. **Scene setup effect** — depends on `[]` (mount only). Creates scene, camera, renderer, lights, floor. Stores them in refs. Starts the animation loop. Cleanup disposes everything.
2. **Props update effect** — depends on `[pet.stage, pet.health, postureTilt, postureScore]`. Updates the existing pet group's material colors, scale, rotation. Does NOT recreate the scene.

```typescript
const sceneRef = useRef<THREE.Scene | null>(null);
const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
const petGroupRef = useRef<THREE.Group | null>(null);

// Effect 1: Mount scene ONCE
useEffect(() => {
  const mount = mountRef.current;
  if (!mount) return;

  const scene = new THREE.Scene();
  // ... create renderer, camera, lights, floor, petGroup
  // ... start animate loop
  sceneRef.current = scene;

  // Build or load pet model ONCE
  buildFallbackPet(petGroupRef.current!, pet);

  return () => { /* dispose everything */ };
}, []); // EMPTY DEPS — mount once

// Effect 2: Update visuals reactively (NO scene recreation)
useEffect(() => {
  const group = petGroupRef.current;
  if (!group) return;

  // Update material colors based on health
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
      child.material.color.setHex(healthColor(pet.health));
      child.material.emissive.setHex(healthColor(pet.health));
      child.material.emissiveIntensity = pet.health === 'Thriving' ? 0.28 : 0.1;
    }
  });
}, [pet.health, pet.stage]);
```

**B. Add health state hysteresis:**
Don't switch health states on single-frame score changes. In score-engine.ts, require the score to stay in a health bracket for at least 3 seconds before transitioning. Store a `healthTransitionTimer` and only commit the change when the timer expires.

Alternatively, do it on the BioPet side: use a `useRef` to track the "committed" health state, and only update it if the new health has been consistent for 3+ seconds.

**C. Animate health transitions instead of instant switches:**
When health DOES change, lerp the material color from old to new over 1-2 seconds using the animation loop instead of setting it instantly.

**D. Handle resize without scene recreation:**
The current `onResize` handler is fine but it's inside the effect that keeps re-running. Move it to the mount-once effect.

### Acceptance Criteria
- Pet renders stably — no flickering, no fading in and out
- Health state changes are smooth transitions, not instant jumps
- Pet breathes and tilts smoothly in response to posture
- No GLTF load spam in network tab
- Three.js scene is created exactly once and updated reactively

---

## Task 4: Fix Posture Tracking Accuracy

**Files to modify**: `src/renderer/ml/posture-scorer.ts`, `src/renderer/ml/pose-engine.ts`, `src/renderer/ml/calibration.ts`

**DEPENDS ON**: Task 1 (performance fixes must land first so score updates aren't being dropped)

### Problems to Investigate & Fix

**A. COCO-to-MediaPipe index mapping may be wrong:**
In `pose-engine.ts` lines 63-79, the Human library returns COCO-17 keypoints which are mapped to MediaPipe-33 indices. The mapping is:
```
COCO 11 (left hip)  → LANDMARKS.LEFT_HIP (23)
COCO 12 (right hip) → LANDMARKS.RIGHT_HIP (24)
```
But COCO keypoint ordering is: `[nose, left_eye, right_eye, left_ear, right_ear, left_shoulder, right_shoulder, left_elbow, right_elbow, left_wrist, right_wrist, left_hip, right_hip, left_knee, right_knee, left_ankle, right_ankle]`

So COCO index 3 = left_ear, but in the mapping it maps to `LANDMARKS.LEFT_EAR` (7). **Verify this mapping is correct.** The Human library may use a different COCO ordering than standard. Print out the actual keypoint labels from Human's output to confirm.

**B. Visibility threshold is extremely low:**
In `hasRequiredLandmarks()` (line 286), shoulder visibility threshold is `0.08` and head is `0.03`. These are so low that landmarks with essentially zero confidence are accepted. This means garbage landmark positions get through, producing wild posture scores. **Raise to 0.3 for shoulders and 0.2 for head.**

**C. Calibration may produce bad baseline vectors:**
Read `calibration.ts` and verify:
- The upright trunk vector is computed correctly (shoulder midpoint → hip midpoint)
- The baseline neck angle and shoulder slant are averaged correctly across samples
- Edge case: if user calibrates while slouching, all scores will be wrong forever. Add a sanity check: if calibrated neck angle < 150, warn and re-prompt.

**D. Read and verify `posture-scorer.ts` formulas:**
- Neck score: `((neckAngle - 140) / 40) * 100` — an angle of 180 gives 100, angle of 140 gives 0. This seems correct.
- Shoulder score: `(1 - shoulderSlant / 10) * 100` — slant of 0 gives 100, slant of 10 gives 0. Correct.
- Trunk similarity: `((similarity - 0.85) / 0.15) * 100` — similarity of 1.0 gives 100, 0.85 gives 0. Correct.
- **BUT**: if no calibration data exists (null), what does `scorePosture` do? It must use sensible defaults, not crash or return 0.

**E. Add console logging for debugging:**
Temporarily add `console.log` every 2 seconds showing: `neckAngle`, `shoulderSlant`, `trunkSimilarity`, `compositeScore`, `landmark visibility scores`. This will immediately reveal if values are in expected ranges.

### Acceptance Criteria
- Sitting upright produces score 70-100
- Slouching produces score 20-50
- Leaning sideways shows increased shoulder slant
- Score responds within 1-2 seconds of posture change
- No wild score jumps from frame to frame (smoothing works)

---

## Task 5: Fix Blink Rate Detection

**Files to modify**: `src/renderer/ml/blink-detector.ts`, `src/renderer/ml/face-engine.ts`

**DEPENDS ON**: Task 1 (the dual Human instance fix directly affects face detection)

### Root Causes Identified

1. **Eye landmark indices are for MediaPipe Face Mesh (478 landmarks), but `@vladmandic/human` returns its OWN face mesh format.** The constants in `constants.ts` use MediaPipe indices:
   ```
   LEFT_EYE.top = [159, 158, 157]
   LEFT_EYE.bottom = [145, 144, 153]
   LEFT_EYE.left = 33
   LEFT_EYE.right = 133
   ```
   Human's face mesh has 478 points BUT they may not be in the same order as MediaPipe's. **This is likely why blink detection returns nothing — it's reading the wrong landmarks.**

2. **The face mesh check in App.tsx (line 129) requires `landmarks.length >= 390`.** Human's mesh output (`face.mesh`) may return fewer points depending on the model. If it returns e.g. 360 points, the blink detector never receives data. **Log `landmarks.length` to verify.**

3. **EAR threshold of 0.20 may be wrong for Human's coordinate system.** Human returns mesh coordinates in pixel space (which face-engine.ts normalizes by dividing by video dimensions). The resulting EAR values may be in a completely different range than the expected 0.20-0.35. **Log actual EAR values to find the correct threshold.**

4. **The `BlinkDetector.update()` is only called inside `scoreEngine.updateFace()`**, which is only called when `hasFaceMesh` is true. If face detection fails silently (returns empty mesh), blink detection never runs.

### Fixes Required

**A. Verify Human face mesh landmark indices:**
Log the actual face mesh from Human:
```typescript
// In face-engine.ts detectFace():
console.log('Face mesh points:', rawMesh?.length, 'Sample point:', rawMesh?.[0]);
```
Then cross-reference Human's documentation for which indices correspond to eye landmarks. Human uses a different indexing than MediaPipe — you likely need to map:
- Human's left eye indices to `LEFT_EYE` constants
- Human's right eye indices to `RIGHT_EYE` constants

Check Human's source: the eye landmarks in `@vladmandic/human` are typically at indices matching the Facemesh 468-point topology (which IS MediaPipe-compatible). But the mesh array structure from Human might be `[x, y, z]` arrays not objects, and the normalization in `face-engine.ts` might produce different scales.

**B. Fix the landmark count threshold:**
Change `landmarks.length >= 390` to `landmarks.length >= 100` or better yet, check for a minimum set of eye landmarks specifically:
```typescript
const hasEyeLandmarks = landmarks[LEFT_EYE.left] && landmarks[LEFT_EYE.right] &&
                        landmarks[RIGHT_EYE.left] && landmarks[RIGHT_EYE.right];
```

**C. Calibrate EAR threshold empirically:**
Add temporary logging in `blink-detector.ts`:
```typescript
console.log('EAR:', ear.toFixed(4), 'Closed frames:', this.closedFrames, 'Blinks:', blinkRate);
```
Watch the console while blinking deliberately. Adjust `EAR_BLINK_THRESHOLD` to match the actual values. It might need to be 0.15 or 0.25 depending on normalization.

**D. Ensure face engine initializes successfully:**
Add error boundary: if Human face init fails, log clearly. Check if the face model is actually downloaded (network tab). The model URL `https://vladmandic.github.io/human/models` must be accessible.

**E. Add fallback blink rate:**
If face detection is degraded, don't show "0 bpm" — show "--" or use a simulated baseline of 17 bpm so other scores (fatigue, stress) aren't zeroed out.

### Acceptance Criteria
- Blink rate card shows a real number (12-25 bpm range for normal use)
- Deliberately blinking rapidly shows increased bpm
- Prolonged eye closure (2+ seconds) is detected
- Fatigue score responds to blink patterns
- Face Mesh system status shows green dot

---

## Quick Reference: File Ownership Per Task

| File | Task 1 | Task 2 | Task 3 | Task 4 | Task 5 |
|------|--------|--------|--------|--------|--------|
| `score-engine.ts` | **WRITE** | | | read | read |
| `App.tsx` | **WRITE** | | | | |
| `constants.ts` | **WRITE** | read | | read | read |
| `DigitalTwin.tsx` | | **WRITE** | | | |
| `BioPet.tsx` | | | **WRITE** | | |
| `posture-scorer.ts` | | | | **WRITE** | |
| `pose-engine.ts` | | | | **WRITE** | |
| `calibration.ts` | | | | **WRITE** | |
| `blink-detector.ts` | | | | | **WRITE** |
| `face-engine.ts` | | | | | **WRITE** |

No two tasks in the same round write to the same file.

---

## Task 6: Enhance Webcam CV Overlay — Make Computer Vision Visible

**Files to modify**: `src/renderer/components/visualisation/WebcamFeed.tsx`

**ROUND 2** (parallel with Tasks 4 & 5 — only touches WebcamFeed.tsx)

### Problem

The webcam overlay currently draws tiny 2.2px dots on landmarks against the video feed. It looks like nothing is happening — the user can't tell computer vision is running. This is the most visually impressive part of the demo and it's being completely wasted.

Also: the video has `transform: scaleX(-1)` (mirrored) but the canvas overlay does NOT, so landmarks appear on the wrong side of the face/body.

### Fixes Required

**A. Mirror the canvas overlay to match the video:**
```typescript
// The video is mirrored with CSS scaleX(-1), so mirror canvas drawing too
ctx.translate(canvas.width, 0);
ctx.scale(-1, 1);
```

**B. Draw full skeleton connections (not just dots):**
Import `POSE_CONNECTIONS` and draw lines between connected landmarks:
```typescript
import { POSE_CONNECTIONS } from '@renderer/lib/constants';

// Draw skeleton lines
ctx.strokeStyle = scoreColor(postureScore);
ctx.lineWidth = 3;
ctx.lineCap = 'round';
for (const [a, b] of POSE_CONNECTIONS) {
  const pA = landmarks[a], pB = landmarks[b];
  if (!isVisible(pA) || !isVisible(pB)) continue;
  ctx.beginPath();
  ctx.moveTo(pA.x * canvas.width, pA.y * canvas.height);
  ctx.lineTo(pB.x * canvas.width, pB.y * canvas.height);
  ctx.stroke();
}
```

**C. Draw face mesh wireframe:**
The component needs to receive `faceLandmarks` as a prop (currently only gets pose landmarks). Pass face landmarks from Dashboard. Then draw a subset of face mesh triangulation edges as thin semi-transparent lines:
```typescript
// Draw face mesh as subtle wireframe
if (faceLandmarks.length > 100) {
  ctx.strokeStyle = 'rgba(74, 124, 89, 0.3)';
  ctx.lineWidth = 0.5;
  // Draw edges between adjacent face mesh points (every 3rd connection to avoid clutter)
  for (let i = 0; i < faceLandmarks.length - 1; i += 3) {
    const p1 = faceLandmarks[i], p2 = faceLandmarks[i + 1];
    if (!p1 || !p2) continue;
    ctx.beginPath();
    ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
    ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
    ctx.stroke();
  }
}
```

Better approach: use the standard MediaPipe face mesh tessellation connections (468 triangles) for a proper wireframe. These are available as a predefined array — search npm for `@mediapipe/face_mesh` FACEMESH_TESSELATION or hardcode the ~40 key contour connections (jawline, eyebrows, nose bridge, lip outline, eye outlines).

**D. Draw real-time neck angle arc annotation:**
```typescript
// Draw angle arc between ear → shoulder → hip
const ear = landmarks[7]; // or 8
const shoulder = landmarks[11]; // or 12
const hip = landmarks[23]; // or 24
if (isVisible(ear) && isVisible(shoulder) && isVisible(hip)) {
  // Draw the angle arc at the shoulder joint
  const sx = shoulder.x * canvas.width, sy = shoulder.y * canvas.height;
  const angleToEar = Math.atan2(ear.y - shoulder.y, ear.x - shoulder.x);
  const angleToHip = Math.atan2(hip.y - shoulder.y, hip.x - shoulder.x);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sx, sy, 25, angleToHip, angleToEar, false);
  ctx.stroke();

  // Label the angle
  ctx.fillStyle = 'white';
  ctx.font = '11px monospace';
  ctx.fillText(`${neckAngle.toFixed(0)}°`, sx + 28, sy - 5);
}
```

**E. Draw shoulder level line with tilt annotation:**
```typescript
const ls = landmarks[11], rs = landmarks[12];
if (isVisible(ls) && isVisible(rs)) {
  const lx = ls.x * canvas.width, ly = ls.y * canvas.height;
  const rx = rs.x * canvas.width, ry = rs.y * canvas.height;

  // Shoulder line
  ctx.strokeStyle = shoulderSlant > 5 ? '#C0392B' : '#4A7C59';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(rx, ry);
  ctx.stroke();
  ctx.setLineDash([]);

  // Horizontal reference line
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(lx, (ly + ry) / 2);
  ctx.lineTo(rx, (ly + ry) / 2);
  ctx.stroke();

  // Tilt label
  ctx.fillStyle = 'white';
  ctx.font = '11px monospace';
  const midX = (lx + rx) / 2;
  ctx.fillText(`${shoulderSlant.toFixed(1)}° tilt`, midX - 25, Math.min(ly, ry) - 10);
}
```

**F. Eye region highlighting:**
Draw small rectangles or circles around each eye region, colored by blink state:
- Green outline when eyes open (EAR > threshold)
- Red flash when blink detected
- Amber when prolonged closure

**G. Emotion label near face:**
If emotion data is available, draw a small label near the top of the detected face:
```typescript
ctx.fillStyle = 'rgba(0,0,0,0.5)';
ctx.fillRect(faceX - 30, faceY - 25, 60, 18);
ctx.fillStyle = 'white';
ctx.font = '11px sans-serif';
ctx.fillText(emotionState, faceX - 25, faceY - 11);
```

**H. Increase landmark dot sizes:**
Change from 2.2px to 4px radius. Add a thin white outline ring around each dot for contrast against varied backgrounds.

### Props Changes Needed

`WebcamFeed` needs additional props (update Dashboard.tsx to pass them):
```typescript
interface WebcamFeedProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  landmarks: Point[];
  faceLandmarks: Point[];      // NEW
  postureScore: number;
  neckAngle: number;           // NEW
  shoulderSlant: number;       // NEW
  emotionState: string;        // NEW
  blinkRate: number;           // NEW
  poseFps: number;
  faceFps: number;
}
```

### Acceptance Criteria
- Full skeleton visible on webcam feed (colored by posture quality)
- Face mesh wireframe visible on face
- Neck angle arc annotation drawn at shoulder
- Shoulder tilt line with degree label
- Eye highlights react to blinks
- Emotion label shown near face
- Everything mirrored correctly to match the video
- Looks impressive in a demo — "wow, it's tracking everything"

---

## Updated File Ownership Table

| File | T1 | T2 | T3 | T4 | T5 | T6 |
|------|----|----|----|----|----|----|
| `score-engine.ts` | **W** | | | r | r | |
| `App.tsx` | **W** | | | | | |
| `constants.ts` | **W** | r | | r | r | r |
| `DigitalTwin.tsx` | | **W** | | | | |
| `BioPet.tsx` | | | **W** | | | |
| `posture-scorer.ts` | | | | **W** | | |
| `pose-engine.ts` | | | | **W** | | |
| `calibration.ts` | | | | **W** | | |
| `blink-detector.ts` | | | | | **W** | |
| `face-engine.ts` | | | | | **W** | |
| `WebcamFeed.tsx` | | | | | | **W** |
| `Dashboard.tsx` | | | | | | **W** |

No two tasks in the same round write to the same file.
