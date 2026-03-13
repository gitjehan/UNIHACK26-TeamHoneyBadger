# Blink Detection Refactoring: Delta-Based Approach

## Why the current approach fails

The current `BlinkDetector` uses an **absolute threshold** — it checks if the Eye Aspect Ratio (EAR) drops below a fixed number to detect a blink. The problem:

1. **Landmarks are normalized non-uniformly** (`x / videoWidth`, `y / videoHeight`), which inflates EAR values well above the textbook 0.25–0.35 range. Typical observed values are 0.4–0.7+.
2. The static threshold (`EAR_BLINK_THRESHOLD = 0.2`) is far too low to ever be crossed with inflated values.
3. The adaptive threshold calibration tries to fix this (collects 25 open-eye samples, sets threshold to `p60 * 0.65`), but:
   - Takes ~5 seconds at 5 FPS before it even kicks in
   - The ratio `0.65` was tuned for textbook EAR ranges and may still be wrong for inflated values
   - Different users, cameras, distances, and lighting all shift the baseline differently

## What delta-based detection is

Instead of asking "is EAR below X?", we ask **"did EAR just drop significantly from where it was?"**

A blink is a rapid, temporary dip in EAR. In a rolling window of EAR values, a blink looks like:

```
open:   ████████████████████
blink:              ██
                   ████
open:   ████████████████████
```

The delta approach:
- Maintain a **rolling average** of recent EAR values (this represents your "open eye" baseline in real-time)
- When current EAR drops below `rollingAvg * DROP_RATIO` (e.g., 0.70), mark the eye as **closing**
- When current EAR rises back above `rollingAvg * OPEN_RATIO` (e.g., 0.80), and the eye was closing for 1–8 frames, count it as a **blink**
- If it was closing for >8 frames, count it as a **prolonged closure** (fatigue signal)

## Why this is better

| Problem | Absolute Threshold | Delta-Based |
|---|---|---|
| Inflated EAR from normalization | Breaks completely | Doesn't matter — it's relative |
| Different face shapes | Needs per-user tuning | Self-adapting every frame |
| User moves closer/further | Threshold becomes wrong | Rolling avg adjusts automatically |
| Camera/lighting changes | May stop detecting | Handles it naturally |
| Calibration delay | 5 seconds of no detection | Works from frame 2 |

## Implementation plan

### File: `src/renderer/ml/blink-detector.ts`

### Step 1: Replace threshold constants

Remove:
- `EAR_CALIBRATION_FRAMES`
- `ADAPTIVE_THRESHOLD_RATIO`
- The `getThreshold()` method
- `earCalibrationSamples` and `adaptiveThreshold` fields

Add:
```ts
/** A blink starts when EAR drops to this fraction of the rolling average */
const DROP_RATIO = 0.70;

/** A blink ends when EAR recovers to this fraction of the rolling average */
const OPEN_RATIO = 0.80;
```

### Step 2: Use a separate "open-eye" rolling average

The existing `earBuffer` (window=30) includes blink frames in the average, which drags it down. We need a rolling average that **only tracks open-eye EAR**:

```ts
// Tracks the open-eye baseline (only fed values when eyes are open)
private openEarBuffer = new RollingAverage(20);

// Whether we're currently in a closing/closed state
private eyeClosing = false;
```

### Step 3: New detection logic in `update()`

Replace the current threshold-crossing block (`lines 123–132`) with:

```ts
this.earBuffer.push(ear); // keep for avgEAR reporting

const baseline = this.openEarBuffer.average;

if (baseline > 0 && ear < baseline * DROP_RATIO) {
  // Eye is closing
  if (!this.eyeClosing) {
    this.eyeClosing = true;
  }
  this.closedFrames += 1;
} else {
  // Eye is open — feed into open-eye baseline
  this.openEarBuffer.push(ear);

  if (this.eyeClosing) {
    // Just re-opened — check if it was a blink or prolonged closure
    if (this.closedFrames >= BLINK_MIN_FRAMES && this.closedFrames <= BLINK_MAX_FRAMES) {
      this.blinkTimes.push(now);
    } else if (this.closedFrames > BLINK_MAX_FRAMES) {
      this.closureTimes.push(now);
    }
    this.closedFrames = 0;
    this.eyeClosing = false;
  }
}
```

Key difference: `openEarBuffer` is **only fed when eyes are open**, so blink dips never contaminate the baseline. This makes the rolling average a reliable "this is what your open eyes look like right now" signal.

### Step 4: Set `baselineOpenEar` continuously

For the fatigue score calculation, instead of setting `baselineOpenEar` once during calibration, keep it updated:

```ts
// In the open-eye branch above:
this.baselineOpenEar = this.openEarBuffer.average;
```

This means fatigue scoring also adapts in real-time.

### Step 5: Update logging

Update the diagnostic log to show delta-relevant info:

```ts
console.log(
  `[BlinkDetector] EAR: ${ear.toFixed(4)} | baseline: ${baseline.toFixed(4)}` +
  ` | dropAt: ${(baseline * DROP_RATIO).toFixed(4)}` +
  ` | closing: ${this.eyeClosing} | closedFrames: ${this.closedFrames}` +
  ` | blinks/min: ${this.cachedBlinkRate}`
);
```

### What to delete

- `earCalibrationSamples` field
- `adaptiveThreshold` field
- `getThreshold()` method entirely
- Import of `EAR_BLINK_THRESHOLD` from constants (no longer needed here)

### What stays the same

- `eyeAspectRatio()` function — still computes EAR the same way
- `hasEyeLandmarks()` — still validates landmark presence
- `blinkTimes[]` / `closureTimes[]` / `pruneOlderThan()` — blink counting window logic is unchanged
- `buildFrame()` / `buildFallbackFrame()` — output format unchanged
- `computeFatigue()` — same formula, just uses continuously-updated `baselineOpenEar`
- The `earBuffer` (window=30) — still used for `avgEAR` reporting in the output

## Tuning

If blinks are **still not detected**, lower `DROP_RATIO` to `0.65` (more sensitive).
If **false positives** from micro-movements, raise `DROP_RATIO` to `0.75` (less sensitive).

The `OPEN_RATIO` should always be higher than `DROP_RATIO` to create hysteresis (prevents rapid on/off flickering at the boundary).

## Constants reference

| Constant | Value | Purpose |
|---|---|---|
| `DROP_RATIO` | 0.70 | EAR must drop to 70% of baseline to start a blink |
| `OPEN_RATIO` | 0.80 | EAR must recover to 80% of baseline to end a blink |
| `BLINK_MIN_FRAMES` | 1 | Minimum frames closed to count as blink (not noise) |
| `BLINK_MAX_FRAMES` | 8 | Maximum frames closed before it's a prolonged closure |
| `openEarBuffer` window | 20 | ~4 seconds of open-eye history at 5 FPS |
