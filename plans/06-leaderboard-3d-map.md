# Plan 06 — End-Session Sydney Leaderboard Map

## Decision

Use **MapLibre GL JS** — a real OpenStreetMap vector tile map of Sydney, pitched at 45° so it looks like a tilted/isometric city view. No 3D buildings needed — just a clean flat streets-and-water map as the backdrop. Cat sprites are placed on the map as custom HTML markers, scaled by rank. This screen appears **before** the existing RecapOverlay when a session ends.

---

## What the Screen Looks Like

- A **modal** — not full-screen. A centred card with a semi-transparent dark backdrop behind it. The backdrop dims the dashboard behind it but the card does not fill the whole screen — there is visible space around all edges.
- Card size: **1100×660px** — wide and tall enough to show a generous map, but with ~90px of breathing room on each side of the 1280px window and ~70px top/bottom of the 800px window.
- The entire card is the MapLibre map, centered on Sydney, pitched 45° and rotated slightly
- 4 ginger cat sprites float on the map at different Sydney landmarks
- The rank-1 cat is the biggest (~80px tall), rank-4 is the smallest (~32px tall)
- Each cat has a small pill label below it showing nickname + score
- The rank-1 cat has a 👑 above its head
- The current user's cat glows gold with a CSS drop-shadow
- Top-left corner: a small HUD panel showing the ranked list (like a scoreboard sidebar)
- Top-right corner: "View Stats →" button that closes the leaderboard and opens the existing RecapOverlay
- Map is fully locked — no pan, zoom, or rotation by the user
- Pressing Escape also closes it

---

## Existing Code to Know

- **`src/renderer/App.tsx`** — main app. Has `leaderboard: LeaderboardEntry[]` state (top entries from Elasticsearch, refreshed every 20s). Has `nickname: string` state (the current user's nickname). Has `recap: SessionRecap | null` state. The `endSession()` async function sets `recap`. The `<RecapOverlay recap={recap} onClose={() => setRecap(null)} />` is rendered at the bottom of the JSX.

- **`src/renderer/components/recap/RecapOverlay.tsx`** — existing overlay that shows when `recap !== null`. Uses the `"overlay"` CSS class for the backdrop.

- **`src/renderer/components/pet/CatSprite.tsx`** — exports two components:
  - `CatSprite` — renders a single static frame from the spritesheet. Props: `row`, `col`, `scale` (default 3), `flip`.
  - `AnimatedCat` — a full animated cat with a behaviour state machine (walking, sleeping, grooming, idle). Props: `health` (`'Thriving' | 'Fading' | 'Wilting'`), `scale` (default 3). **This is the same live animated cat shown in the main dashboard.** It internally uses `CatSprite` and cycles through frames automatically.

  Both components import from `@renderer/assets/ginger-cat.png` — the 352×1696px spritesheet with 32×32 frames (11 cols × 53 rows).

- **`src/renderer/lib/types.ts`** — `LeaderboardEntry` has: `nickname: string`, `sessionId: string`, `avgOverallScore: number`, `bestStreak: number`, `totalLockedInMinutes: number`, `level: number`, `levelTitle: string`, `timestamp: string`.

- **`src/renderer/assets/ginger-cat.png`** — spritesheet 352×1696px. Each frame is **32×32px**. The sheet is **11 columns** wide. This is used internally by `CatSprite` and `AnimatedCat` — you do not need to import it directly in `LeaderboardMapScreen.tsx`.

- **`vite.renderer.config.ts`** — currently very minimal (just path aliases). Needs the `worker` config added.

- **`src/main/main.ts`** — Electron main process. No explicit CSP header. `contextIsolation: true`, `nodeIntegration: false`.

---

## Step 1 — Install

```bash
npm install maplibre-gl
```

`maplibre-gl` ships its own TypeScript types — no `@types/` package needed.

---

## Step 2 — Update `vite.renderer.config.ts`

Add the `worker` format config so Vite can bundle the MapLibre CSP worker correctly for Electron. This prevents a blob-URL worker issue in the packaged app.

**Full new content of `vite.renderer.config.ts`:**

```ts
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
});
```

---

## Step 3 — Create `src/renderer/components/recap/LeaderboardMapScreen.tsx`

This is the main new file. Create it at that exact path.

### Full implementation:

```tsx
import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LeaderboardEntry } from '@renderer/lib/types';
import { AnimatedCat } from '@renderer/components/pet/CatSprite';

// Apply the CSP-safe worker ONCE at module level, before any Map is instantiated.
// This import uses Vite's ?worker suffix to bundle the worker as an ES module,
// avoiding the blob: URL that Electron's CSP can block in production builds.
import MaplibreWorker from 'maplibre-gl/dist/maplibre-gl-csp-worker?worker';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(maplibregl as any).workerClass = MaplibreWorker;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The map is locked on this view — Sydney metro pitched at 45°. */
const MAP_CENTER: [number, number] = [151.15, -33.87];
const MAP_ZOOM = 10;
const MAP_PITCH = 45;
const MAP_BEARING = -20;

/**
 * Free MapLibre demo tile style — clean vector tiles, no API key required,
 * works immediately as long as the machine has internet.
 * Shows streets, water, parks, suburb labels. No 3D buildings.
 */
const MAP_STYLE = 'https://demotiles.maplibre.org/style.json';

/**
 * 4 Sydney landmarks. Rank 1 gets the CBD (most visually prominent),
 * lower ranks get outer suburbs.
 */
const SYDNEY_POSITIONS: Array<{ lng: number; lat: number; name: string }> = [
  { lng: 151.2093, lat: -33.8688, name: 'CBD' },
  { lng: 151.2741, lat: -33.8914, name: 'Bondi' },
  { lng: 151.0054, lat: -33.8148, name: 'Parramatta' },
  { lng: 151.2858, lat: -33.7969, name: 'Manly' },
];

/** Sprite display size in px for each rank (index 0 = rank 1). */
const RANK_SIZES = [80, 60, 45, 32] as const;

/** Border/highlight colours for each rank badge. */
const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32', '#888888'] as const;

/** Text labels for the rank badge. */
const RANK_LABELS = ['1st', '2nd', '3rd', '4th'] as const;

/**
 * Health state per rank — controls AnimatedCat behaviour.
 * Rank 1 & 2: Thriving — energetic, walks around, washes, meows.
 * Rank 3: Fading — mostly lying/crouching, slow and lethargic.
 * Rank 4: Wilting — almost entirely asleep (30–90s sleep blocks), barely moves.
 * This ensures all 4 cats look visually distinct from the moment the screen opens
 * and the behaviour reflects how well each player did in their session.
 */
const RANK_HEALTH: Array<'Thriving' | 'Fading' | 'Wilting'> = [
  'Thriving',
  'Thriving',
  'Fading',
  'Wilting',
] as const;

// ---------------------------------------------------------------------------
// Sprite scale helper
// ---------------------------------------------------------------------------

/**
 * AnimatedCat uses scale=3 by default, meaning each frame renders at 96×96px.
 * We want different sizes per rank (80, 60, 45, 32px).
 * Pass a fractional scale to AnimatedCat to hit those sizes:
 *   scale = targetPx / 32  (since each frame is 32px base)
 */
function rankToScale(targetPx: number): number {
  return targetPx / 32;
}

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

interface LeaderboardMapScreenProps {
  /** Full leaderboard from App state — we use the first 4 entries. */
  entries: LeaderboardEntry[];
  /** The current user's nickname so we can highlight their marker. */
  currentUserNickname: string;
  /** Called when the user clicks "View Stats →" or presses Escape. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeaderboardMapScreen({
  entries,
  currentUserNickname,
  onClose,
}: LeaderboardMapScreenProps): JSX.Element {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // We always show top 4 from the leaderboard.
  const top4 = entries.slice(0, 4);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialise the map.
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      pitch: MAP_PITCH,
      bearing: MAP_BEARING,
      // Lock the map — this is a display-only leaderboard screen.
      interactive: false,
      // Hide the default attribution control (we have limited space).
      attributionControl: false,
    });

    mapRef.current = map;

    // Track React roots so we can unmount them on cleanup.
    const roots: ReturnType<typeof createRoot>[] = [];

    // Add cat markers once the map style has loaded.
    map.on('load', () => {
      top4.forEach((entry, i) => {
        const pos = SYDNEY_POSITIONS[i];
        if (!pos) return;

        const size = RANK_SIZES[i];
        const color = RANK_COLORS[i];
        const rankLabel = RANK_LABELS[i];
        const isCurrentUser = entry.nickname === currentUserNickname;

        // ------------------------------------------------------------------
        // Outer wrapper div — maplibre Marker takes a raw HTMLElement, but
        // we mount a real React tree inside it using createRoot so that the
        // AnimatedCat component (the same live animated sprite from the
        // dashboard) renders and animates exactly as it does in the main app.
        // ------------------------------------------------------------------

        const wrapper = document.createElement('div');
        wrapper.style.cssText = [
          'display:flex',
          'flex-direction:column',
          'align-items:center',
          'gap:3px',
          'cursor:default',
          'user-select:none',
          // Gold glow for the current user
          isCurrentUser ? 'filter:drop-shadow(0 0 10px #FFD700) drop-shadow(0 0 4px #FFD700)' : '',
        ].filter(Boolean).join(';');

        // Crown above the rank-1 cat
        if (i === 0) {
          const crown = document.createElement('div');
          crown.textContent = '👑';
          crown.style.cssText = 'font-size:20px;line-height:1;margin-bottom:-2px';
          wrapper.appendChild(crown);
        }

        // Rank badge (1st / 2nd / 3rd / 4th) above the sprite
        const badge = document.createElement('div');
        badge.textContent = rankLabel;
        badge.style.cssText = [
          `background:${color}22`,
          `color:${color}`,
          `border:1px solid ${color}`,
          'font-size:9px',
          'font-weight:700',
          'padding:1px 5px',
          'border-radius:3px',
          'line-height:1.4',
          'letter-spacing:0.5px',
        ].join(';');
        wrapper.appendChild(badge);

        // Cat sprite container — we mount AnimatedCat here via createRoot.
        // AnimatedCat is the exact same component used in the main dashboard.
        // It receives a `scale` prop to hit the right pixel size for this rank.
        // health='Thriving' makes all leaderboard cats appear in their best state.
        // The scale prop on AnimatedCat multiplies the base 32px frame size:
        //   e.g. size=80 → scale=2.5 → cat renders at 80×80px.
        const spriteContainer = document.createElement('div');
        wrapper.appendChild(spriteContainer);

        const root = createRoot(spriteContainer);
        root.render(
          <AnimatedCat health={RANK_HEALTH[i]} scale={rankToScale(size)} />
        );
        roots.push(root);

        // Name + score pill below sprite
        const label = document.createElement('div');
        label.style.cssText = [
          'background:rgba(0,0,0,0.72)',
          'color:#fff',
          'font-size:10px',
          'font-weight:600',
          'padding:2px 7px',
          'border-radius:999px',
          'white-space:nowrap',
          `border:1px solid ${color}`,
          'max-width:120px',
          'overflow:hidden',
          'text-overflow:ellipsis',
        ].join(';');
        label.textContent = `${entry.nickname}  ${entry.avgOverallScore}`;
        wrapper.appendChild(label);

        // anchor:'bottom' — the bottom of the wrapper sits at the coordinate,
        // so the cat's feet touch the map surface.
        new maplibregl.Marker({ element: wrapper, anchor: 'bottom' })
          .setLngLat([pos.lng, pos.lat])
          .addTo(map);
      });
    });

    // Keyboard close
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);

    // Cleanup on unmount — unmount all React roots before destroying the map
    // to avoid React "unmount after container removed" warnings.
    return () => {
      window.removeEventListener('keydown', handleKey);
      roots.forEach(r => r.unmount());
      map.remove();
      mapRef.current = null;
    };
  // We intentionally run this only once on mount. entries/nickname are
  // captured via closure; the leaderboard doesn't need to live-update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // Backdrop — fixed-position overlay that dims the dashboard behind it.
    // NOT full-screen: the card is centred with visible gaps on all sides.
    // The "overlay" CSS class already provides position:fixed, inset:0,
    // display:flex, align-items:center, justify-content:center — so the card
    // will naturally centre in the window.
    <div
      className="overlay"
      style={{ zIndex: 200 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Leaderboard"
    >
      {/* Card — stop click propagation so clicking inside doesn't close */}
      <div
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            position: 'relative',
            // 1100×660 fills most of the 1280×800 window while keeping
            // visible margin on all sides so it reads as a modal, not fullscreen.
            width: 1100,
            height: 660,
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          }}
        >
          {/* ----------------------------------------------------------------
              The map fills the whole card.
          ---------------------------------------------------------------- */}
          <div
            ref={mapContainerRef}
            style={{ width: '100%', height: '100%' }}
          />

          {/* ----------------------------------------------------------------
              Top-left: Title HUD
          ---------------------------------------------------------------- */}
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: 14,
              background: 'rgba(0,0,0,0.72)',
              backdropFilter: 'blur(6px)',
              borderRadius: 10,
              padding: '10px 14px',
              color: '#fff',
              minWidth: 160,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>
              🏆 LOCK IN BOARD
            </div>
            {top4.map((entry, i) => (
              <div
                key={entry.nickname}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 11,
                  marginBottom: 4,
                  fontWeight: entry.nickname === currentUserNickname ? 700 : 400,
                  color: entry.nickname === currentUserNickname ? '#FFD700' : '#fff',
                }}
              >
                <span style={{ color: RANK_COLORS[i], fontWeight: 700, width: 22 }}>
                  #{i + 1}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.nickname}
                </span>
                <span style={{ color: '#aaa', fontVariantNumeric: 'tabular-nums' }}>
                  {entry.avgOverallScore}
                </span>
              </div>
            ))}
          </div>

          {/* ----------------------------------------------------------------
              Top-right: Close / continue button
          ---------------------------------------------------------------- */}
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              background: 'rgba(0,0,0,0.72)',
              backdropFilter: 'blur(6px)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: 0.3,
            }}
          >
            View Stats →
          </button>

          {/* ----------------------------------------------------------------
              Bottom-right: OSM attribution (required by OSM licence)
          ---------------------------------------------------------------- */}
          <div
            style={{
              position: 'absolute',
              bottom: 6,
              right: 8,
              fontSize: 9,
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            © OpenStreetMap contributors
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Step 4 — Update `src/renderer/App.tsx`

Two targeted changes only. Do not touch anything else.

### Change 1 — Add the import at the top of the imports block

Add this line alongside the other component imports (near the `RecapOverlay` import):

```ts
import { LeaderboardMapScreen } from '@renderer/components/recap/LeaderboardMapScreen';
```

### Change 2 — Add `showLeaderboard` state

Inside the `App()` function, alongside the existing `const [recap, setRecap] = useState<SessionRecap | null>(null);` line, add:

```ts
const [showLeaderboard, setShowLeaderboard] = useState(false);
```

### Change 3 — Trigger the leaderboard in `endSession()`

The existing `endSession()` function ends with:
```ts
sessionIdRef.current = uuidv4();
scoreEngine.startSession();
```

Add one line **before** those two lines, so it reads:
```ts
setShowLeaderboard(true);   // ← add this line
sessionIdRef.current = uuidv4();
scoreEngine.startSession();
```

### Change 4 — Update the JSX at the bottom of App

The existing JSX currently has:
```tsx
<RecapOverlay
  recap={recap}
  onClose={() => setRecap(null)}
/>
```

Replace it with this block (two components):
```tsx
{showLeaderboard && (
  <LeaderboardMapScreen
    entries={leaderboard}
    currentUserNickname={nickname}
    onClose={() => setShowLeaderboard(false)}
  />
)}
<RecapOverlay
  recap={showLeaderboard ? null : recap}
  onClose={() => setRecap(null)}
/>
```

**Why `showLeaderboard ? null : recap`:** Both states get set when a session ends (recap is set, leaderboard flag is set). By passing `null` to RecapOverlay while the leaderboard is showing, we ensure only the leaderboard screen is visible first. When the user clicks "View Stats →", `showLeaderboard` becomes false, RecapOverlay receives the real `recap` object, and the normal recap card appears.

---

## Step 5 — Handle the maplibre-gl CSS import

MapLibre requires its own CSS for the map canvas to render correctly. The import is already in `LeaderboardMapScreen.tsx`:

```ts
import 'maplibre-gl/dist/maplibre-gl.css';
```

Vite will handle this automatically — no additional config needed.

---

## Step 6 — Handle the `?worker` import TypeScript type

In `LeaderboardMapScreen.tsx`, the line:
```ts
import MaplibreWorker from 'maplibre-gl/dist/maplibre-gl-csp-worker?worker';
```

Vite understands `?worker` natively. TypeScript may warn about the untyped module. If it does, add a declaration in `src/renderer/vite-env.d.ts` (or any existing `.d.ts` file in the renderer):

```ts
declare module '*?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}
```

---

## Edge Cases to Handle

### Fewer than 4 leaderboard entries

The leaderboard might have 0–3 entries (e.g. early in the hackathon demo). The `top4.forEach` loop already handles this gracefully by only iterating over entries that exist. If there are fewer than 4 entries, only that many cat markers will appear on the map — the remaining positions will just be empty. No crash.

### entries is empty

If `entries` is empty (Elasticsearch is down or not configured), the leaderboard map still opens — the map of Sydney renders, but with no cat markers. The HUD panel will show nothing. This is acceptable.

### Map style offline / no internet

`demotiles.maplibre.org` requires internet. If the machine is offline the map canvas will be blank/grey but the component won't crash. The markers still won't appear (the `map.on('load')` event won't fire if tiles fail). This is acceptable for a hackathon demo environment.

---

## File Summary

| File | Action |
|------|--------|
| `package.json` | Add `maplibre-gl` via `npm install maplibre-gl` |
| `vite.renderer.config.ts` | Add `worker: { format: 'es' }` and `optimizeDeps: { exclude: ['maplibre-gl'] }` |
| `src/renderer/components/recap/LeaderboardMapScreen.tsx` | **Create new file** — full implementation above |
| `src/renderer/App.tsx` | Add import, add `showLeaderboard` state, set it in `endSession()`, update JSX |
| `src/renderer/vite-env.d.ts` (if needed) | Add `?worker` module declaration if TypeScript errors on the import |

---

## What the User Sees (Flow)

1. User clicks "End Session" in the header
2. `endSession()` runs — saves data to Elasticsearch, sets `recap`, sets `showLeaderboard = true`
3. **`LeaderboardMapScreen` appears** — centred modal with dark backdrop, Sydney map loads inside a 1100×660px card, 4 cats placed at their positions
4. User reads the leaderboard, sees where they rank
5. User clicks "View Stats →" or presses Escape
6. `showLeaderboard = false` — leaderboard closes
7. **`RecapOverlay` appears** — the existing Spotify-Wrapped-style recap card shows normally
8. User closes the recap as before

---

## Notes for the Implementing Agent

- Do **not** use `react-map-gl` — use `maplibre-gl` directly with `useRef` and `useEffect` as shown. This avoids an extra dependency and gives full control.
- The `maplibregl.workerClass` assignment **must happen at module level** (outside the component function), not inside `useEffect`, otherwise the first Map instantiation may happen before the worker is set.
- The `interactive: false` on the Map options is important — this is a display screen, not an interactive map.
- Do **not** add a navigation control (`maplibregl.NavigationControl`) — keep the map UI clean.
- The `map.remove()` in the cleanup function is critical — it destroys the WebGL context on unmount and prevents memory leaks in Electron.
- Keep the existing `RecapOverlay` and `SessionRecapCard` completely unchanged — we're just gating when they appear.
- **The cat sprites on the map are `AnimatedCat` components** mounted via `createRoot` — the exact same animated sprite as the main dashboard pet. They will walk, sleep, yawn, and groom themselves on the map just like the real pet. The `scale` prop is set per-rank using `rankToScale(size)` which divides the target pixel size by the base 32px frame size.
- **Each cat has a different `health` prop** driven by `RANK_HEALTH[i]`: ranks 1 & 2 are `Thriving` (energetic, walks around, washes, meows), rank 3 is `Fading` (slow, mostly lying down), rank 4 is `Wilting` (almost always asleep in 30–90s blocks). This makes all 4 cats visually and behaviourally distinct from the moment the screen opens, and the behaviour reflects how well each player performed.
- **React root cleanup** — call `root.unmount()` on every `createRoot` root before `map.remove()` in the cleanup function. This prevents React from trying to unmount components after their DOM containers have been removed.
