# Plan 3: Improve UI and UX

## Issues Found

- **Responsive layout breaks**: At narrower viewports, the 3-column grid (`320px 1fr 300px`) gets cramped; columns don't adapt gracefully
- **No min-height on webcam**: Feed can get squished between metric cards and timeline
- **Missing hover/focus states**: Recap close button, welcome feature cards, calibration elements
- **No live streak display**: Streak is only shown in recap and leaderboard, not during the session
- **Timeline empty state**: Just text, no visual feedback
- **Recap font mismatch**: Canvas uses `system-ui` instead of the design system font

---

## Changes

### `src/renderer/styles/globals.css`

- [ ] Add `min-height: 200px` to the webcam grid area
- [ ] Tighten responsive breakpoints: at `1200px`, collapse right column below instead of trying 3-across; at `820px`, stack everything single-column with reduced card padding
- [ ] Add hover/focus styles for `.onboarding-card` feature blocks and recap close button

### `src/renderer/components/layout/Header.tsx`

- [ ] Add a live streak counter next to the state tabs: "Locked in for Xm" (read from `scoreEngine.getSessionStats()`)
- [ ] Only show when streak > 0; subtle fade-in/out

### `src/renderer/components/visualisation/SessionTimeline.tsx`

- [ ] Improve empty state: add a subtle pulsing dot or shimmer animation instead of plain text

### `src/renderer/components/recap/SessionRecapCard.tsx`

- [ ] Match canvas font to `--font-sans` variable

---

## Expected Outcome

- App looks good at all viewport sizes (desktop down to ~800px width)
- Interactive elements have clear hover/focus feedback
- Users can see their current streak during the session
- Empty states feel polished rather than bare
