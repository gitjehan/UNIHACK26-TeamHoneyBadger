# Plan 2: Pet Lifecycle Logic (Egg Hatching, Evolution, Persistence)

## Current State

The core pet state machine exists in `score-engine.ts` — egg crack, evolution stages, health states all work. Key gaps:

- **Pet only saved on "End Session"** — closing the app loses all session progress
- **Hat unlock** ("3 sessions completed") not implemented
- **Crown unlock** ("#1 on leaderboard") not implemented
- **Only cape rendered** on the 3D pet — wings, halo, scarf, glasses, hat, crown have no visuals
- **No hatch animation** — geometry just swaps instantly from egg to creature

---

## Changes

### `src/renderer/App.tsx`

- [ ] Add periodic pet persistence: save `state.pet` to electron-store every 30 seconds (not just on "End Session")
- [ ] Also save on the cleanup return of the webcam/engine effect so progress survives window close
- [ ] Track session count in electron-store; on `endSession`, increment count and check for hat unlock (3 sessions)

### `src/renderer/ml/score-engine.ts`

- [ ] Add hat unlock: check stored session count >= 3 in `endSession()`
- [ ] Add crown unlock: accept leaderboard rank as parameter, unlock crown if rank === 1
- [ ] Emit a distinct event/flag when evolution or accessory unlock happens (e.g. `lastEvolution` and `lastAccessoryUnlock` fields on pet state) so the UI can react

### `src/renderer/components/pet/BioPet.tsx`

- [ ] Add Three.js meshes for missing accessories:
  - **Scarf**: torus or curved plane at neck height
  - **Hat**: cylinder + disc on top of head
  - **Glasses**: two small torus rings at eye level
  - **Wings**: two flat planes on the back (stage 4+)
  - **Halo**: flat torus floating above head (stage 5)
  - **Crown**: jagged cylinder on top (leaderboard #1)
- [ ] Add a hatch transition: when stage changes from 0 to 1, briefly scale the egg group to 0 with a bounce easing, then build the new creature geometry and scale it from 0 to 1

---

## Expected Outcome

- Pet progress is saved automatically and survives app restarts
- All accessories are visually rendered on the 3D pet
- Hatching has a smooth animated transition
- Hat and crown unlock conditions work correctly
