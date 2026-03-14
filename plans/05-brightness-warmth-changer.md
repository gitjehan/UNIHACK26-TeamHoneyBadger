jehanzebqureshi@MacBook-Air UNIHACK26-TeamHoneyBadger % npm star
t

> kinetic@0.1.0 start
> electron-forge start

✔ Checking your system
✔ Locating application
✔ Loading configuration
✔ Preparing native dependencies [0.1s]
✔ Running generateAssets hook
✔ Running preStart hook
  ✔ [plugin-vite] Preparing Vite bundles
    ✔ Launched Vite dev servers for renderer process code
      [0.1s]
      ✔ Target main_window
        › ➜  Local:   http://localhost:5173/
          ➜  Network: use --host to expose
    ✔ Built main process and preload bundles [1s]
      ✔ Building src/main/main.ts target
      ✔ Building src/preload/preload.ts target
✔ Launched Electron app. Type rs in terminal to restart main
  process.

8:41:34 PM [@electron-forge/plugin-vite] target built src/preload/preload.ts
8:41:36 PM [@electron-forge/plugin-vite] target built src/main/main.ts

[dotenv@17.3.1] injecting env (0) from .env -- tip: ⚙️  write to custom object with { processEnv: myObject }
[dotenv@17.3.1] injecting env (0) from .env.local -- tip: ⚙️  override existing env vars with { override: true }
(node:28213) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `Electron --trace-warnings ...` to show where the warning was created)
2026-03-14 20:41:36.739 Electron[28213:109821] +[IMKClient subclass]: chose IMKClient_Modern
2026-03-14 20:41:36.739 Electron[28213:109821] +[IMKInputSession subclass]: chose IMKInputSession_Modern
[IPC] ambient:update → { brightness: 0.75, warmth: 0 }
2026-03-14 20:41:38.446 Electron Helper[28250:110210] WARNING: Add NSCameraUseContinuityCameraDeviceType to your Info.plist to use AVCaptureDeviceTypeContinuityCamera.
[IPC] ambient:update → { brightness: 0.75, warmth: 0 }
[IPC] ambient:update → { brightness: 0.75, warmth: 0 }
[IPC] ambient:update → { brightness: 0.72, warmth: 0 }
[IPC] ambient:update → { brightness: 0.33, warmth: 0.54 }
[Ambient] gamma-helper found at: /Users/jehanzebqureshi/Documents/UNIHACK-26/UNIHACK26-TeamHoneyBadger/src/main/gamma-helper
[IPC] ambient:update → { brightness: 0.22, warmth: 0.7 }
[IPC] ambient:update → { brightness: 0.24, warmth: 0.67 }
[IPC] ambient:update → { brightness: 0.23, warmth: 0.68 }
[IPC] ambient:update → { brightness: 0.23, warmth: 0.69 }
[IPC] ambient:update → { brightness: 0.23, warmth: 0.69 }
[IPC] ambient:update → { brightness: 0.23, warmth: 0.68 }
[IPC] ambient:update → { brightness: 0.48, warmth: 0.34 }
[IPC] ambient:update → { brightness: 0.38, warmth: 0.46 }
[IPC] ambient:update → { brightness: 0.37, warmth: 0.47 }
[IPC] ambient:update → { brightness: 0.24, warmth: 0.66 }
[IPC] ambient:update → { brightness: 0.35, warmth: 0.49 }
[IPC] ambient:update → { brightness: 0.35, warmth: 0.49 }# Plan 5: Improve Brightness and Screen Warmth Changer

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
