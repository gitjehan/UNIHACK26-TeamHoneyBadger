# Plan 06: Screen Break Reminder (30-Minute Eye Strain Prevention)

## Goal

After 30 minutes of continuous screen time, display a gentle, non-intrusive break reminder encouraging the user to rest their eyes. The feature tracks *actual presence* (using the existing `personDetected` flag from the webcam ML pipeline) so the timer only counts time the user is genuinely at the screen. If the user steps away for more than 60 seconds the timer resets automatically. The reminder follows the 20-20-20 rule (every 20 minutes, look at something 20 feet away for 20 seconds) adapted to a 30-minute cadence to avoid being annoying.

---

## Current State

- **Session elapsed time** is already tracked in `score-engine.ts` via `getSessionStats().durationSeconds`, but this measures total session time, not continuous screen presence.
- **Person detection** is tracked via `scoreEngine.personDetected` (hysteresis: 3 consecutive frames to appear, 6 to disappear).
- **No Toast / notification component** exists yet. One is planned in `plans/04-gamification-pet.md` but not implemented. This plan creates the shared Toast infrastructure so both plans can use it.
- **No break reminder logic** exists anywhere in the codebase.

---

## Architecture Overview

```
scoreEngine (score-engine.ts)
  ├── tracks continuousScreenSeconds (new)
  ├── increments while personDetected === true
  ├── resets when person absent > 60s
  └── sets breakReminderDue = true at 1800s (30 min)
         │
         ▼
   EngineState.breakReminderDue  ──►  useScores() hook (no changes needed)
         │
         ▼
   App.tsx reads state.breakReminderDue
         │
         ▼
   <BreakReminder /> overlay component
         │
         ├── Shows message + 20-20-20 tip
         ├── Dismiss button calls scoreEngine.dismissBreakReminder()
         └── Optional: pet reacts with sleepy animation
```

---

## Tasks (execute in order)

### Task 1: Add break-reminder tracking to `src/renderer/ml/score-engine.ts`

#### 1a. Add private fields to the `ScoreEngine` class

Add these fields alongside the existing session-tracking fields (after `private _personDetected = false;` around line 156):

```typescript
private continuousScreenSeconds = 0;
private absentSeconds = 0;
private _breakReminderDue = false;
private readonly BREAK_REMINDER_THRESHOLD = 1800; // 30 minutes
private readonly ABSENCE_RESET_THRESHOLD = 60;    // 60 seconds away resets
```

#### 1b. Add `breakReminderDue` to the `EngineState` interface

In the existing `EngineState` interface (line 25), add:

```typescript
export interface EngineState {
  snapshot: ScoreSnapshot;
  systems: SystemsState;
  pet: PetState;
  ambient: AmbientTarget;
  fatigueScore: number;
  poseLandmarks: Point[];
  faceLandmarks: Point[];
  poseFps: number;
  faceFps: number;
  personDetected: boolean;
  breakReminderDue: boolean; // <-- ADD THIS
}
```

#### 1c. Expose `breakReminderDue` in the `state` getter

In the `get state()` method (line 193), add `breakReminderDue: this._breakReminderDue` to the returned object:

```typescript
get state(): EngineState {
  return {
    snapshot: this.snapshot,
    systems: this.systems,
    pet: this.pet,
    ambient: this._personDetected ? this.getAmbientTarget() : { brightness: 1, warmth: 0 },
    fatigueScore: this.fatigueScore,
    poseLandmarks: this.poseLandmarks,
    faceLandmarks: this.faceLandmarks,
    poseFps: this.poseFps,
    faceFps: this.faceFps,
    personDetected: this._personDetected,
    breakReminderDue: this._breakReminderDue, // <-- ADD THIS
  };
}
```

#### 1d. Add the `updateScreenPresence` private method

Add this method to the class. It is called from `updateSessionStats()` on every recompute tick (roughly every 250ms when the person is detected):

```typescript
private updateScreenPresence(deltaSeconds: number): void {
  if (this._personDetected) {
    this.continuousScreenSeconds += deltaSeconds;
    this.absentSeconds = 0;

    if (
      !this._breakReminderDue &&
      this.continuousScreenSeconds >= this.BREAK_REMINDER_THRESHOLD
    ) {
      this._breakReminderDue = true;
    }
  } else {
    this.absentSeconds += deltaSeconds;

    if (this.absentSeconds >= this.ABSENCE_RESET_THRESHOLD) {
      this.continuousScreenSeconds = 0;
      this._breakReminderDue = false;
    }
  }
}
```

#### 1e. Call `updateScreenPresence` from `updateSessionStats`

In the existing `updateSessionStats()` method (line 394), add a call to `this.updateScreenPresence(deltaSeconds)` right after `this.lastTick = now;`:

```typescript
private updateSessionStats(): void {
  const now = Date.now();
  const deltaSeconds = Math.max(0, (now - this.lastTick) / 1000);
  this.lastTick = now;

  this.updateScreenPresence(deltaSeconds); // <-- ADD THIS LINE

  // ... rest of the method unchanged ...
}
```

#### 1f. Add the `dismissBreakReminder` public method

Add this public method to the class:

```typescript
dismissBreakReminder(): void {
  this._breakReminderDue = false;
  this.continuousScreenSeconds = 0;
  this.emit();
}
```

#### 1g. Reset screen presence tracking in `startSession`

In the existing `startSession()` method (line 227), add resets for the new fields:

```typescript
startSession(): void {
  this.sessionStartedAt = Date.now();
  this.lastTick = Date.now();
  this.bestStreakSeconds = 0;
  this.currentStreakSeconds = 0;
  this.streakGraceSeconds = 0;
  this.totalUprightSeconds = 0;
  this.sessionScoreCount = 0;
  this.postureSum = 0;
  this.focusSum = 0;
  this.stressSum = 0;
  this.overallSum = 0;
  this.blinkRateSum = 0;
  this.previousPetStage = this.pet.stage;
  this.sessionNewAccessories.clear();
  this.timeline.clear();
  // Reset break reminder tracking
  this.continuousScreenSeconds = 0;
  this.absentSeconds = 0;
  this._breakReminderDue = false;
  this.emit();
}
```

---

### Task 2: Create `src/renderer/components/ui/BreakReminder.tsx`

Create the directory `src/renderer/components/ui/` and file `BreakReminder.tsx`.

This is a non-intrusive overlay that appears when the user has been at the screen for 30 minutes. It matches the Axis warm/organic design language.

```tsx
import { memo, useEffect, useState } from 'react';

interface BreakReminderProps {
  visible: boolean;
  onDismiss: () => void;
}

export const BreakReminder = memo(function BreakReminder({
  visible,
  onDismiss,
}: BreakReminderProps): JSX.Element | null {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      // Small delay so the CSS transition plays on mount
      const timer = setTimeout(() => setShow(true), 50);
      return () => clearTimeout(timer);
    }
    setShow(false);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className={`break-reminder-backdrop ${show ? 'break-reminder-backdrop--visible' : ''}`}>
      <div className={`break-reminder-card ${show ? 'break-reminder-card--visible' : ''}`}>
        {/* Eye icon */}
        <div className="break-reminder-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>

        <h2 className="break-reminder-title">Time to rest your eyes</h2>

        <p className="break-reminder-body">
          You've been at the screen for <strong>30 minutes</strong>. Take a short break
          to reduce eye strain.
        </p>

        <div className="break-reminder-tip">
          <span className="break-reminder-tip-label">20-20-20 rule</span>
          <span className="break-reminder-tip-text">
            Look at something 20 feet away for 20 seconds.
          </span>
        </div>

        <button
          className="btn btn-primary break-reminder-dismiss"
          type="button"
          onClick={onDismiss}
        >
          Got it, thanks
        </button>
      </div>
    </div>
  );
});
```

---

### Task 3: Add CSS styles to `src/renderer/styles/globals.css`

Append the following styles at the end of `globals.css`:

```css
/* ── Break Reminder ─────────────────────────────────────── */

.break-reminder-backdrop {
  position: fixed;
  inset: 0;
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(45, 43, 40, 0);
  backdrop-filter: blur(0px);
  transition: background 0.4s ease, backdrop-filter 0.4s ease;
  pointer-events: none;
}

.break-reminder-backdrop--visible {
  background: rgba(45, 43, 40, 0.25);
  backdrop-filter: blur(4px);
  pointer-events: auto;
}

.break-reminder-card {
  background: var(--bg-card);
  border: 1px solid var(--border-card);
  border-radius: 20px;
  padding: 36px 40px 32px;
  max-width: 380px;
  width: 90%;
  text-align: center;
  box-shadow: 0 12px 40px rgba(45, 43, 40, 0.18);
  opacity: 0;
  transform: translateY(16px) scale(0.97);
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.break-reminder-card--visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.break-reminder-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--amber-bg);
  color: var(--amber-primary);
  margin-bottom: 16px;
}

.break-reminder-title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.break-reminder-body {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0 0 16px;
}

.break-reminder-body strong {
  color: var(--text-primary);
  font-weight: 600;
}

.break-reminder-tip {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--bg-card-muted);
  border: 1px solid var(--border-card);
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 20px;
}

.break-reminder-tip-label {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--amber-primary);
}

.break-reminder-tip-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.break-reminder-dismiss {
  width: 100%;
  padding: 10px 0;
  font-size: 14px;
  font-weight: 600;
  border-radius: 10px;
}
```

---

### Task 4: Integrate `BreakReminder` into `src/renderer/App.tsx`

#### 4a. Add the import

At the top of `App.tsx`, add:

```typescript
import { BreakReminder } from '@renderer/components/ui/BreakReminder';
```

#### 4b. Add the import of `scoreEngine` (already imported)

`scoreEngine` is already imported on line 17. No change needed.

#### 4c. Render `<BreakReminder>` in the app shell

In the `return` block of the `App` component (after the `<RecapOverlay>` on line 335), add:

```tsx
<BreakReminder
  visible={state.breakReminderDue}
  onDismiss={() => scoreEngine.dismissBreakReminder()}
/>
```

The full return becomes:

```tsx
return (
  <div className="app-shell">
    <Header state={state.snapshot.overall.state} onEndSession={() => void endSession()} />
    <main className="app-content">
      {webcam.error ? (
        <div className="onboarding">
          <div className="onboarding-card">
            <h2>Webcam access needed</h2>
            <p>{webcam.error}</p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: '8px 0 0' }}>
              Make sure your camera is connected and permissions are enabled in System Settings &gt; Privacy &amp; Security &gt; Camera.
            </p>
            <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        </div>
      ) : (
        <Dashboard
          state={state}
          videoRef={webcam.videoRef}
          timeline={timeline}
          visionBackend={visionBackend}
        />
      )}
    </main>
    <RecapOverlay
      recap={recap}
      onClose={() => setRecap(null)}
    />
    <BreakReminder
      visible={state.breakReminderDue}
      onDismiss={() => scoreEngine.dismissBreakReminder()}
    />
  </div>
);
```

---

### Task 5 (Optional Enhancement): Pet reacts when break is due

In `src/renderer/components/pet/BioPet.tsx`, if the component receives a `breakReminderDue` prop, show the pet in a "sleepy" state (e.g., reduced bounce animation, half-closed eyes overlay, or a gentle sway) to reinforce the break message visually.

#### 5a. Add prop to BioPet

```typescript
interface BioPetProps {
  pet: PetState;
  postureScore: number;
  focusScore: number;
  stressScore: number;
  breakReminderDue?: boolean; // <-- ADD THIS
}
```

#### 5b. Pass prop from Dashboard

In `src/renderer/components/layout/Dashboard.tsx`, pass the new prop:

```tsx
<BioPet
  pet={state.pet}
  postureScore={snapshot.posture.score}
  focusScore={snapshot.focus.score}
  stressScore={snapshot.stress.score}
  breakReminderDue={state.breakReminderDue}
/>
```

#### 5c. Use in BioPet render

When `breakReminderDue` is true, add a CSS class like `bio-pet--sleepy` to the pet container that applies a subtle visual cue (e.g., reduced opacity, gentle pulse, or a "zzz" overlay). The exact implementation depends on the current pet rendering approach (PixelSprite / CatSprite). A simple approach:

```tsx
<div className={`bio-pet-container ${breakReminderDue ? 'bio-pet--sleepy' : ''}`}>
  {/* existing pet rendering */}
</div>
```

Add to `globals.css`:

```css
.bio-pet--sleepy {
  animation: sleepy-sway 3s ease-in-out infinite;
  filter: saturate(0.7);
}

@keyframes sleepy-sway {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-2deg); }
  75% { transform: rotate(2deg); }
}
```

---

## Files Changed (Summary)

| File | Change |
|------|--------|
| `src/renderer/ml/score-engine.ts` | Add screen presence tracking fields, `updateScreenPresence()` method, `dismissBreakReminder()` method, update `EngineState` interface and `state` getter, reset in `startSession()` |
| `src/renderer/components/ui/BreakReminder.tsx` | **NEW** -- break reminder overlay component |
| `src/renderer/styles/globals.css` | Add break reminder CSS styles |
| `src/renderer/App.tsx` | Import and render `<BreakReminder>`, wire dismiss to `scoreEngine` |
| `src/renderer/components/layout/Dashboard.tsx` | Pass `breakReminderDue` prop to BioPet (Task 5 only) |
| `src/renderer/components/pet/BioPet.tsx` | Accept and react to `breakReminderDue` prop (Task 5 only) |

---

## Acceptance Criteria

- [ ] After exactly 30 minutes of continuous screen presence (person detected by webcam), the break reminder overlay appears
- [ ] The overlay displays the 20-20-20 rule tip and a dismiss button
- [ ] Clicking "Got it, thanks" dismisses the overlay and resets the 30-minute timer
- [ ] If the user leaves the camera view for more than 60 seconds, the timer resets automatically (no reminder shown)
- [ ] Brief absences (< 60 seconds, e.g., glancing away) do NOT reset the timer
- [ ] Starting a new session resets the timer
- [ ] The overlay appears on top of the dashboard but below any system dialogs
- [ ] The overlay matches the Axis design language (warm earth tones, rounded card, DM Sans + Cormorant Garamond fonts)
- [ ] No existing functionality is broken (Pomodoro, pet, ambient, leaderboard, recap)
- [ ] (Optional) The pet shows a sleepy/drowsy animation when the break reminder is active

---

## Testing

### Manual Verification

For development testing, temporarily lower `BREAK_REMINDER_THRESHOLD` to `10` (10 seconds) in `score-engine.ts` to verify:

1. Sit in front of the camera for 10+ seconds -- the reminder should appear
2. Click dismiss -- the reminder disappears and the timer resets
3. Wait another 10 seconds -- the reminder should appear again
4. Step away from the camera for 60+ seconds -- return and confirm the timer restarted (no immediate reminder)
5. Step away for only 5 seconds, return -- timer should continue from where it was (not reset)

**Remember to reset `BREAK_REMINDER_THRESHOLD` back to `1800` before committing.**

### Automated Verification

Add a unit test or script that:
1. Instantiates a `ScoreEngine` (or uses the singleton)
2. Simulates `reportPersonFrame(true)` and `recompute()` calls over 1800 simulated seconds
3. Asserts `state.breakReminderDue === true` after the threshold
4. Calls `dismissBreakReminder()` and asserts `state.breakReminderDue === false`
5. Simulates absence for 60+ seconds and asserts timer reset
