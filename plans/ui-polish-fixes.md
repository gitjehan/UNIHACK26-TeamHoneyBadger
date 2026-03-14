# UI Polish Fixes

Fix six visual issues in the Axis dashboard: standardize number fonts, clean up overall gauge display, fix column heights, add padding for macOS traffic lights, restructure pet stat chips to 2x2 grid, and thicken progress bars.

## Tasks

1. Add `--font-number` CSS variable using Outfit and update all numeric font-family references across globals.css, OverallGauge.tsx, and pet-animations.css
2. Change OverallGauge.tsx to display score as "82%" instead of "82 /100"
3. Fix dashboard column grid-template-rows so left and right columns stretch to match center column height
4. Set default `.top-header` padding-left to 72px for macOS traffic light clearance
5. Convert `.pet-stat-chips` from flex-wrap to a 2-column CSS grid for a clean 2x2 layout
6. Increase `.metric-progress-track` height from 3px to 5-6px, and `.pet-evolution-bar` from 4px to 6px

## Files to modify

- `src/renderer/styles/globals.css` -- main stylesheet (progress bar height, column stretch, header padding, number font variable)
- `src/renderer/components/metrics/OverallGauge.tsx` -- overall score display
- `src/renderer/components/metrics/MetricCard.tsx` -- metric card number font
- `src/renderer/components/pet/pet-animations.css` -- stat chip grid, evolution bar
- `index.html` -- (only if adding a new Google Font import)

---

## 1. Standardize number font across the app

**Problem:** Numbers across the dashboard use `Cormorant Garamond` (a serif display font with old-style/non-lining figures), which makes digits like 1, 7, 8 sit at different baselines -- looking "messy" and inconsistent.

**Fix:** Switch all numeric displays to `Outfit`, which is **already loaded** via Google Fonts in `index.html`. Outfit has clean, modern lining numerals where all digits share the same baseline and width.

- In `globals.css`, add a new CSS variable:

```css
--font-number: 'Outfit', 'DM Sans', sans-serif;
```

- Replace `var(--font-display)` with `var(--font-number)` in all numeric contexts:
  - `.metric-value` (line 277 in globals.css) -- the big numbers on metric cards (80, 17, 78, 18)
  - `.pomodoro-time` (line 1486 in globals.css) -- the 25:00 timer
  - `.timeline-row-value` (line 606 in globals.css) -- timeline metric numbers
  - `.digital-twin-score` (line 804 in globals.css) -- digital twin score
  - `.ambient-stat-value` (line 872 in globals.css) -- ambient stat numbers
- In `OverallGauge.tsx`, change the inline `fontFamily` on the score `<text>` element (line 67) from `'Cormorant Garamond', 'Instrument Serif', Georgia, serif` to `'Outfit', 'DM Sans', sans-serif`
- In `pet-animations.css`:
  - `.pet-evolution-percent` (line 570) -- change `font-family` to `var(--font-number, 'Outfit', sans-serif)`
  - `.pet-chip-value` (line 621) -- change `font-family` to `var(--font-number, 'Outfit', sans-serif)`
  - `.pet-stage-name` (line 496) -- change `font-family` to `var(--font-number, 'Outfit', sans-serif)`

Ensure `font-variant-numeric: tabular-nums` is present on all these classes (already on `.metric-value`, `.pomodoro-time`, `.session-timer`; add where missing).

---

## 2. Change overall score from "82/100" to "82%"

**Problem:** The `OverallGauge` currently renders the score as two SVG text elements: `{clamped}` and `/100`, which looks cluttered.

**Fix:** In `OverallGauge.tsx`:

- Remove the `/100` text element (line 68)
- Change the score text element (line 67) to render `{clamped}%` instead of just `{clamped}`
- Alternatively, add `%` as a smaller suffix in the same text element or as a `<tspan>` with a smaller font size (e.g., 16px) so it reads cleanly as "82%"

---

## 3. Make left and right columns span full viewport height

**Problem:** The left and right columns use `align-content: start`, causing cards to stack at the top and leave empty grey space at the bottom. The columns are visually shorter than the center column.

**Fix:** In `globals.css`:

- Change `.dashboard-column` (line 164-171) from `align-content: start` to `align-content: stretch` or remove it entirely so cards distribute evenly
- Specifically for left and right columns, set the grid rows to use `1fr` so they stretch:
  - `.dashboard-column--left` (line 173): change `grid-template-rows: auto auto` to `grid-template-rows: auto 1fr` so the pet card stretches
  - `.dashboard-column--right` (line 185): change `grid-template-rows: auto auto auto auto auto` to `grid-template-rows: auto 1fr auto` so the ambient sound player (middle card) stretches to fill

---

## 4. Fix macOS traffic light buttons overlapping the logo

**Problem:** At wider viewport widths, `.top-header` has `padding-left: 24px`, which is insufficient clearance for macOS window control buttons (close/minimize/maximize). The fix at `max-width: 1080px` sets `padding-left: 72px` but the default does not.

**Fix:** In `globals.css`:

- Change the default `.top-header` `padding-left` (line 82) from `24px` to `72px` so the brand logo clears the traffic lights at all viewport widths

---

## 5. Pet stat chips: 2 full rows of 2 instead of 3+1 layout

**Problem:** The four stat chips (Posture, Focus, Stress, Time) use `flex-wrap`, which at narrow widths wraps the 4th chip onto its own line -- visually unbalanced.

**Fix:** In `pet-animations.css`:

- Change `.pet-stat-chips` (line 601) from `display: flex; flex-wrap: wrap; gap: 6px` to a 2-column grid:

```css
.pet-stat-chips {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
```

- This ensures exactly 2 chips per row, producing a clean 2x2 layout regardless of container width

---

## 6. Thicken the green progress bars on metric cards

**Problem:** The progress bar at the bottom of each metric card (`.metric-progress-track`) is only `3px` tall -- too thin to be visually meaningful.

**Fix:** In `globals.css`:

- Change `.metric-progress-track` `height` (line 320) from `3px` to `5px` or `6px`
- Similarly thicken the pet evolution bar in `pet-animations.css`: `.pet-evolution-bar` height from `4px` to `6px` (line 575)

---

## Summary of changes (no logic changes)

All modifications are purely visual/CSS with one small TSX template change (overall gauge text). No state management, scoring logic, event handling, or data flow is altered.
