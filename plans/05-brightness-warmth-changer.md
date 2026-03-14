# Plan 5: Improve Brightness and Screen Warmth Changer

## Problems

- **Bucket edge jumps**: Crossing score boundaries (20, 50, 80) causes abrupt target changes because the interpolation range shifts
- **Transition restarts on every update**: Every 1-second ambient update calls `restartTransition()`, which resets the 2-second lerp from scratch — if scores fluctuate, transitions never complete
- **Fatigue adjustment is raw**: `fatigueScore / 100 * 0.2` is applied directly without smoothing, so brightness can flicker with blink detection noise
- **User preferences ignored**: `brightnessRange` and `warmthIntensity` from electron-store are never applied

---

## Changes

### `src/renderer/ml/score-engine.ts`

- [ ] Smooth the ambient target before emitting: keep a rolling average of brightness and warmth targets over the last 5 values, so bucket-edge crossings don't cause jumps
- [ ] Smooth fatigueScore contribution with its own rolling average before applying to brightness

### `src/main/ambient-controller.ts`

- [ ] Don't restart transition if new target is within 0.02 of current target (dead zone to prevent constant restarts)
- [ ] When a new target arrives mid-transition, don't reset `startBrightness`/`startWarmth` to current values and restart from step 0. Instead, update the *target* and let the current transition continue from wherever it is (smooth retargeting)
- [ ] Increase `totalSteps` from 40 to 60 (3 seconds instead of 2) for gentler transitions

### `src/renderer/lib/constants.ts`

- [ ] Overlap the AMBIENT_MAP buckets slightly so there's no hard boundary:
  - 75-100 instead of 80-100
  - 45-80 instead of 50-80
  - 15-50 instead of 20-50
  - 0-20 stays the same
- [ ] This creates blending zones where both buckets contribute, eliminating sharp jumps

### `src/renderer/App.tsx`

- [ ] Load user preferences (`brightnessRange`, `warmthIntensity`) from electron-store on startup
- [ ] Apply them when sending ambient updates: clamp brightness to user's range, scale warmth by intensity multiplier

---

## Expected Outcome

- Brightness and warmth transitions are smooth, not jerky
- No abrupt changes when crossing score thresholds
- User preferences are respected
- Fatigue-based adjustments don't cause flickering
