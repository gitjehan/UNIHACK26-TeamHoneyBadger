# Plan 1: Fix Posture Tracking Accuracy

## Problem

Posture scoring feels inconsistent. Several compounding issues:

- **Smoothing window too large**: `RollingAverage(60)` at 8fps = ~7.5 seconds of lag before score reacts to posture changes
- **Slouch penalty double-counts**: `slumpSeverity` is derived from the same signals (neck, trunk, shoulder) that already drive the raw score, then applied as an *additional* penalty on top
- **Constants vs code mismatch**: `NECK_ANGLE_RANGE` in `constants.ts` says `terrible: 140` but `posture-scorer.ts` hardcodes `130`
- **Calibration race condition**: Calibration samples every 70ms but pose runs at 8fps (125ms), so many samples reuse stale frames. First samples may use default values `{ neckAngle: 175, shoulderSlant: 1 }` before real detection starts
- **No visibility filtering in calibration**: Low-confidence landmarks can skew the baseline

---

## Changes

### `src/renderer/ml/score-engine.ts`

- [ ] Reduce `postureSmoothing` from `RollingAverage(60)` to `RollingAverage(24)` (~3 seconds at 8fps) for faster feedback
- [ ] Remove or halve the `slumpSeverity * 20` penalty — the raw composite score already accounts for slouching

### `src/renderer/ml/posture-scorer.ts`

- [ ] Replace hardcoded `130` and `50` with `NECK_ANGLE_RANGE.terrible` and `NECK_ANGLE_RANGE.perfect - NECK_ANGLE_RANGE.terrible` from constants
- [ ] Same for shoulder and trunk scoring — use `SHOULDER_SLANT_MAX` and `TRUNK_SIMILARITY_RANGE` directly

### `src/renderer/ml/calibration.ts`

- [ ] Filter out samples where key landmarks (shoulders, ears) have `visibility < 0.3` before averaging
- [ ] Skip the first 500ms of calibration samples to let pose detection warm up

### `src/renderer/App.tsx`

- [ ] Increase calibration sample interval from `70ms` to `150ms` to align with pose update rate
- [ ] Increase minimum sample count from 8 to 12

---

## Expected Outcome

- Posture score reacts within ~3 seconds instead of ~7.5 seconds
- Score feels more accurate and consistent with actual posture
- Calibration produces reliable baseline values
