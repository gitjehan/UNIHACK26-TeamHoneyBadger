# Plan 4: Add Further Gamification Through Pet

## What's Missing

Per the MASTERPLAN, the pet should react to milestones and unlock accessories with celebrations. Currently there are no in-session notifications, no celebrations, and no streak-based pet reactions.

---

## Changes

### New Component: `src/renderer/components/ui/Toast.tsx`

- [ ] Simple floating toast that slides in from top-right, auto-dismisses after 4 seconds
- [ ] Variants: "achievement" (gold border), "info" (neutral)
- [ ] Rendered at app root level in `App.tsx`

### `src/renderer/ml/score-engine.ts`

- [ ] Add `notifications: Array<{ type: string, message: string }>` to engine state
- [ ] Push notification when:
  - Pet evolves ("Your pet evolved to Hatchling!")
  - Accessory unlocks ("You unlocked the Cape!")
  - Streak milestones: 10 min ("10 min streak!"), 30 min, 60 min
- [ ] Clear notifications after they're consumed by the UI

### `src/renderer/components/pet/BioPet.tsx`

- [ ] Add a celebration effect on evolution: brief scale bounce + emissive flash on the pet group (2-second animation triggered by detecting stage change)
- [ ] Add streak milestone reactions: small bounce/glow pulse at 10/30/60 min streak thresholds

### `src/renderer/App.tsx`

- [ ] Read notifications from state, render `<Toast>` for each
- [ ] Pass leaderboard rank to `endSession()` for crown unlock check

---

## Expected Outcome

- Users get real-time feedback when they hit milestones
- Pet visibly celebrates when it evolves or earns accessories
- The experience feels more rewarding and game-like
