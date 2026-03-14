# Plan: Replace Digital Twin with Pomodoro Timer

## Goal

Replace the Digital Twin stick-figure canvas in the left dashboard column with a high-quality, aesthetically pleasing Pomodoro Timer component. The timer must match the reference design (circular arc progress ring, warm salmon tones, white text/controls) and integrate seamlessly with the existing KINETIC UI, color palette, and score engine. No existing logic should be broken.

---

## Current State

The Digital Twin is a canvas-based stick figure at `src/renderer/components/visualisation/DigitalTwin.tsx`. It is mounted in the left column of `src/renderer/components/layout/Dashboard.tsx` (line 58), above the BioPet:

```tsx
// Dashboard.tsx — lines 57–69 (current)
<div className="column" style={{ gridTemplateRows: '1fr auto' }}>
  <DigitalTwin
    landmarks={state.poseLandmarks}
    postureScore={snapshot.posture.score}
    shoulderSlant={snapshot.posture.shoulderSlant}
  />
  <BioPet
    pet={state.pet}
    postureTilt={snapshot.posture.shoulderSlant}
    postureScore={snapshot.posture.score}
    focusScore={snapshot.focus.score}
    stressScore={snapshot.stress.score}
  />
</div>
```

The import on line 7:
```tsx
import { DigitalTwin } from '@renderer/components/visualisation/DigitalTwin';
```

---

## Reference Design

The reference image shows:
- A rounded-corner card with a warm **salmon/pink background** (`~#D4908A`)
- A **circular SVG arc** (white stroke, ~270° sweep) acting as a progress ring
- **Countdown text** (`MM:SS`) centered in white within the arc
- A small **white dot** at the arc's current endpoint
- Clean, minimal, no visual clutter

---

## Tasks (execute in order)

### Task 1: Create `src/renderer/components/pomodoro/PomodoroTimer.tsx`

Create the directory `src/renderer/components/pomodoro/` and file `PomodoroTimer.tsx`.

#### Props Interface

```typescript
interface PomodoroTimerProps {
  postureScore: number;
}
```

#### Features to Implement

1. **Timer Modes** — three selectable modes via tab-style buttons at the top of the card:
   - Focus: 25 minutes (1500 seconds)
   - Short Break: 5 minutes (300 seconds)
   - Long Break: 15 minutes (900 seconds)
   - Switching modes resets the timer

2. **Circular Arc Progress Ring** — rendered as SVG:
   - Use an SVG `<circle>` element with `stroke-dasharray` and `stroke-dashoffset`
   - Circle radius: ~90px, `stroke-width: 4`, `stroke-linecap: round`
   - White stroke (`#ffffff`) on top of the colored card background
   - A faint translucent track ring behind the progress arc (`rgba(255,255,255,0.2)`)
   - Arc starts at 12 o'clock position (apply `transform: rotate(-90deg)` to the SVG or use SVG `transform`)
   - **Math:**
     - `circumference = 2 * Math.PI * radius`
     - `progress = timeRemaining / totalDuration` (1.0 = full, 0.0 = done)
     - `strokeDashoffset = circumference * (1 - progress)`
   - **Endpoint dot:** A small white circle rendered at the arc's current position:
     - `angle = -Math.PI / 2 + 2 * Math.PI * progress`
     - `dotX = cx + radius * Math.cos(angle)`
     - `dotY = cy + radius * Math.sin(angle)`
     - Render as an SVG `<circle>` with `r={6}` and `fill="#ffffff"`

3. **Countdown Display** — centered inside the arc:
   - Format: `MM:SS` (pad with leading zeros)
   - Font: `var(--font-display)`, size ~40px, color white, `font-variant-numeric: tabular-nums`
   - Use `letter-spacing: 0.02em` for readability

4. **Controls** — beneath the SVG arc:
   - **Start / Pause** button — toggles between play and pause state
   - **Reset** button — resets timer to current mode's full duration
   - Styled as subtle white/translucent buttons on the colored background
   - Use simple text labels or unicode icons (e.g., `▶` / `❚❚` / `↺`)

5. **Round Counter** — 4 small dots in a row below controls:
   - Filled white dot = completed Focus round
   - Outline-only white dot = pending round
   - After 4 Focus rounds, the next break is automatically a Long Break instead of Short Break
   - Track `completedRounds` in state (0–4, resets after Long Break)

6. **Posture Nudge** — conditional warning:
   - When `postureScore < 40` AND the timer mode is "Focus" AND the timer is running:
     - Show a small text message below the dots: "Sit up — your posture is slipping"
     - White text, 11px, slight opacity, with a subtle fade-in animation
   - When posture recovers above 40 or timer is paused/stopped, hide the nudge

7. **Card Background Colors** — the entire card changes color based on the active mode:
   - Focus: `#D4908A` (warm salmon, per reference image)
   - Short Break: `#7BA68A` (sage green, harmonizes with `--green-primary: #4A7C59`)
   - Long Break: `#8A9EB5` (calm blue-grey)
   - Transition between colors smoothly using CSS `transition: background-color 0.4s ease`

8. **Timer Logic** — use `useRef` + `useEffect` with `setInterval(1000)`:
   - Store `timeRemaining` in `useState` (seconds)
   - Store `isRunning` in `useState`
   - When `isRunning` is true, decrement `timeRemaining` by 1 each second
   - When `timeRemaining` reaches 0:
     - If mode was Focus: increment `completedRounds`, auto-switch to Short Break (or Long Break if 4 rounds done)
     - If mode was Break: auto-switch back to Focus
     - Reset timer to new mode's duration
     - Pause the timer (user must manually start next session)
   - Clean up interval on unmount

9. **Component Structure:**
   ```tsx
   export const PomodoroTimer = memo(function PomodoroTimer({ postureScore }: PomodoroTimerProps) {
     // State: mode, timeRemaining, isRunning, completedRounds
     // Refs: intervalRef
     // Effects: timer tick, cleanup
     // Computed: progress, arcOffset, dotPosition, formattedTime
     
     return (
       <div className="card pomodoro-card" data-mode={mode}>
         {/* Mode tabs */}
         <div className="pomodoro-tabs">...</div>
         
         {/* SVG arc + countdown */}
         <div className="pomodoro-ring-container">
           <svg viewBox="0 0 200 200">
             {/* Track ring (faint) */}
             {/* Progress arc */}
             {/* Endpoint dot */}
           </svg>
           <div className="pomodoro-time">{formattedTime}</div>
         </div>
         
         {/* Controls */}
         <div className="pomodoro-controls">...</div>
         
         {/* Round dots */}
         <div className="pomodoro-rounds">...</div>
         
         {/* Posture nudge (conditional) */}
         {showNudge && <div className="pomodoro-nudge">...</div>}
       </div>
     );
   });
   ```

10. **Imports needed:**
    ```tsx
    import { memo, useState, useEffect, useRef, useCallback } from 'react';
    ```

---

### Task 2: Add CSS to `src/renderer/styles/globals.css`

Append the following CSS block to the end of `globals.css` (before the closing scrollbar section or at the very end). These styles must be consistent with the existing design tokens.

```css
/* ── Pomodoro Timer ───────────────────────────────────── */

.pomodoro-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border: none;
  border-radius: 16px;
  transition: background-color 0.4s ease;
  overflow: hidden;
}

.pomodoro-card[data-mode="focus"] {
  background: #D4908A;
}

.pomodoro-card[data-mode="shortBreak"] {
  background: #7BA68A;
}

.pomodoro-card[data-mode="longBreak"] {
  background: #8A9EB5;
}

.pomodoro-card:hover {
  border-color: transparent;
}

.pomodoro-tabs {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 3px;
}

.pomodoro-tab {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.65);
  border-radius: 6px;
  padding: 5px 12px;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.pomodoro-tab:hover {
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.1);
}

.pomodoro-tab.active {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}

.pomodoro-ring-container {
  position: relative;
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pomodoro-ring-container svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.pomodoro-arc {
  transition: stroke-dashoffset 1s linear;
}

.pomodoro-time {
  position: relative;
  z-index: 1;
  font-family: var(--font-display);
  font-size: 40px;
  font-weight: 500;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  line-height: 1;
}

.pomodoro-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.pomodoro-btn {
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  border-radius: 10px;
  padding: 8px 20px;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  user-select: none;
}

.pomodoro-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
}

.pomodoro-btn:active {
  transform: translateY(0);
}

.pomodoro-btn-reset {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.2);
  font-size: 14px;
  padding: 8px 12px;
}

.pomodoro-rounds {
  display: flex;
  gap: 6px;
  align-items: center;
}

.pomodoro-round-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.6);
  background: transparent;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.pomodoro-round-dot.filled {
  background: #ffffff;
  border-color: #ffffff;
}

.pomodoro-nudge {
  color: rgba(255, 255, 255, 0.8);
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  text-align: center;
  animation: fadeIn var(--transition-normal);
}
```

---

### Task 3: Modify `src/renderer/components/layout/Dashboard.tsx`

Make exactly these changes — nothing else in the file should change:

1. **Remove** the DigitalTwin import (line 7):
   ```tsx
   // DELETE this line:
   import { DigitalTwin } from '@renderer/components/visualisation/DigitalTwin';
   ```

2. **Add** the PomodoroTimer import (in the same import block):
   ```tsx
   import { PomodoroTimer } from '@renderer/components/pomodoro/PomodoroTimer';
   ```

3. **Replace** the DigitalTwin JSX (lines 58–62) with:
   ```tsx
   <PomodoroTimer postureScore={snapshot.posture.score} />
   ```

4. The full left column should now look like:
   ```tsx
   <div className="column" style={{ gridTemplateRows: '1fr auto' }}>
     <PomodoroTimer postureScore={snapshot.posture.score} />
     <BioPet
       pet={state.pet}
       postureTilt={snapshot.posture.shoulderSlant}
       postureScore={snapshot.posture.score}
       focusScore={snapshot.focus.score}
       stressScore={snapshot.stress.score}
     />
   </div>
   ```

### Task 4: Do NOT delete `DigitalTwin.tsx`

Keep `src/renderer/components/visualisation/DigitalTwin.tsx` in the codebase — only remove its import and usage from Dashboard. It may be useful for debugging later.

---

### Task 5: Verify Integration

After all changes:
1. Check for TypeScript/linter errors in the modified files
2. Confirm the PomodoroTimer renders in the left column where the Digital Twin used to be
3. Confirm the BioPet still renders below it
4. Confirm no other components are affected
5. Confirm the timer card background matches the reference design's salmon pink in Focus mode

---

## Existing Color Palette (for reference)

These are defined in `src/renderer/styles/globals.css` as CSS custom properties:

| Variable | Value | Use |
|----------|-------|-----|
| `--bg-primary` | `#FAFAF7` | Page background |
| `--bg-card` | `#ffffff` | Card surfaces |
| `--bg-card-muted` | `#F5F4F0` | Muted backgrounds |
| `--text-primary` | `#2d2b28` | Main text |
| `--text-secondary` | `#6b6158` | Secondary text |
| `--text-tertiary` | `#9a8f84` | Labels |
| `--green-primary` | `#4A7C59` | Good status |
| `--amber-primary` | `#B8860B` | Fair status |
| `--red-primary` | `#C0392B` | Poor status |
| `--border-card` | `#E8E4DC` | Card borders |
| `--font-sans` | `'DM Sans', ...` | Body text |
| `--font-display` | `'Cormorant Garamond', ...` | Large numerals |

## Existing Design Patterns (follow these)

- Cards use class `card` with `border-radius: 16px`, `padding: 20px`, `border: 1px solid #E8E4DC`
- Transitions use `--transition-fast` (0.15s), `--transition-normal` (0.25s), `--transition-slow` (0.4s)
- Components are wrapped in `React.memo`
- Font sizes: labels 10px uppercase, values 28-40px display font
- Status colors: green `#4A7C59`, amber `#B8860B`, red `#C0392B`

## What This Does NOT Touch

- No changes to ML pipeline, score-engine, pose-engine, or face-engine
- No changes to IPC, main process, or preload
- No changes to BioPet, WebcamFeed, SessionTimeline, or any other component
- No changes to the scoring logic or ambient controller
- No new npm dependencies
