import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LeaderboardEntry } from '@renderer/lib/types';
import { AnimatedCat, CatSprite } from '@renderer/components/pet/CatSprite';
import './leaderboard-map-screen.css';
import MaplibreWorker from 'maplibre-gl/dist/maplibre-gl-csp-worker?worker';

type MaplibreWithWorker = typeof maplibregl & {
  workerClass?: new () => Worker;
};

// Set a CSP-safe worker class before creating any map instances.
(maplibregl as MaplibreWithWorker).workerClass = MaplibreWorker;

const MAP_CENTER: [number, number] = [151.19, -33.865];
const MAP_ZOOM = 10.6;
const MAP_PITCH = 0;
const MAP_BEARING = 0;
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-raster',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};
const MAP_BOUNDS: maplibregl.LngLatBoundsLike = [[150.96, -34.09], [151.36, -33.69]];

const SYDNEY_POSITIONS: Array<{ lng: number; lat: number; name: string }> = [
  { lng: 151.2093, lat: -33.8688, name: 'CBD' },
  { lng: 151.2741, lat: -33.8914, name: 'Bondi' },
  { lng: 151.1799, lat: -33.8981, name: 'Inner West' },
  { lng: 151.2858, lat: -33.7969, name: 'Manly' },
];
const STRATHFIELD_POSITION = { lng: 151.0942, lat: -33.8731, name: 'Strathfield' } as const;
const LANE_COVE_POSITION = { lng: 151.1689, lat: -33.8149, name: 'Lane Cove' } as const;

const RANK_COLORS = ['#f8d66d', '#d8dde9', '#d79b6f', '#adb4c8'] as const;
const RANK_LABELS = ['1st', '2nd', '3rd', '4th'] as const;
// CSS filters to give each non-self cat a distinct colour theme.
// Index 0 is reserved for the current user / 1st place (original ginger, no filter).
const RANK_FILTERS = [
  undefined,                                                    // 1st / self: original ginger
  'sepia(1) saturate(4) hue-rotate(185deg)',                    // 2nd: blue
  'sepia(1) saturate(3) hue-rotate(260deg) brightness(1.2)',   // 3rd: purple
  'sepia(1) saturate(3) hue-rotate(90deg)',                     // 4th: green
] as const;
const RANK_HEALTH: Array<'Thriving' | 'Fading' | 'Wilting'> = ['Thriving', 'Thriving', 'Fading', 'Wilting'];
const RANK_SPRITE_POSES = [
  { row: 0, col: 2, flip: false },
  { row: 1, col: 3, flip: false },
  { row: 2, col: 1, flip: true },
  { row: 3, col: 2, flip: false },
] as const;


const MIN_MARKER_SIZE_PX = 34;
const MAX_MARKER_SIZE_PX = 86;

function rankToScale(targetPx: number): number {
  return targetPx / 32;
}

function sameNickname(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function formatScore(score: number): string {
  if (!Number.isFinite(score)) return '0';
  return String(Math.round(score));
}

function scoreToMarkerSize(score: number): number {
  const clampedScore = Math.min(100, Math.max(0, score));
  return Math.round(MIN_MARKER_SIZE_PX + ((MAX_MARKER_SIZE_PX - MIN_MARKER_SIZE_PX) * clampedScore) / 100);
}

const CBD_POSITION = { lng: 151.2093, lat: -33.8688, name: 'CBD' } as const;

function resolveMarkerPosition(entry: LeaderboardEntry, index: number): { lng: number; lat: number; name: string } | null {
  if (sameNickname(entry.nickname, 'honeybadger')) return CBD_POSITION;
  if (sameNickname(entry.nickname, 'anubhav')) return STRATHFIELD_POSITION;
  if (sameNickname(entry.nickname, 'eshaan')) return LANE_COVE_POSITION;
  return SYDNEY_POSITIONS[index] ?? null;
}


interface LeaderboardMapScreenProps {
  entries: LeaderboardEntry[];
  currentUserNickname: string;
  onClose: () => void;
}

export function LeaderboardMapScreen({
  entries,
  currentUserNickname,
  onClose,
}: LeaderboardMapScreenProps): JSX.Element {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const shareHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shareHintVisible, setShareHintVisible] = useState(false);
  const top4 = useMemo(() => entries.slice(0, 4), [entries]);

  useEffect(() => {
    document.body.classList.add('overlay-open');
    return () => {
      document.body.classList.remove('overlay-open');
      if (shareHintTimeoutRef.current !== null) clearTimeout(shareHintTimeoutRef.current);
    };
  }, []);

  const handleShareClick = () => {
    setShareHintVisible(true);
    if (shareHintTimeoutRef.current !== null) clearTimeout(shareHintTimeoutRef.current);
    shareHintTimeoutRef.current = setTimeout(() => {
      setShareHintVisible(false);
      shareHintTimeoutRef.current = null;
    }, 1500);
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      pitch: MAP_PITCH,
      bearing: MAP_BEARING,
      maxBounds: MAP_BOUNDS,
      interactive: false,
      attributionControl: false,
    });

    const roots: Root[] = [];
    const markers: maplibregl.Marker[] = [];

    const mountMapMarkers = () => {
      top4.forEach((entry, i) => {
        const pos = resolveMarkerPosition(entry, i);
        if (!pos) return;

        const rankColor = RANK_COLORS[i];
        const rankLabel = RANK_LABELS[i];
        const targetSize = scoreToMarkerSize(entry.avgOverallScore);
        const currentUser = sameNickname(entry.nickname, currentUserNickname);

        const wrapper = document.createElement('div');
        wrapper.className = `leaderboard-marker${currentUser ? ' leaderboard-marker--current' : ''}`;
        wrapper.style.setProperty('--marker-rank-color', rankColor);

        if (i === 0) {
          const crown = document.createElement('div');
          crown.className = 'leaderboard-marker__crown';
          crown.textContent = '👑';
          wrapper.appendChild(crown);
        }

        const badge = document.createElement('div');
        badge.className = 'leaderboard-marker__badge';
        badge.textContent = rankLabel;
        wrapper.appendChild(badge);

        const spriteContainer = document.createElement('div');
        spriteContainer.className = 'leaderboard-marker__sprite leaderboard-marker__sprite--pulse';
        wrapper.appendChild(spriteContainer);

        const rankFilter = currentUser
          ? undefined
          : sameNickname(entry.nickname, 'anubhav')
            ? 'sepia(1) saturate(5) hue-rotate(150deg)'  // teal
            : RANK_FILTERS[i];
        const root = createRoot(spriteContainer);
        root.render(
          sameNickname(entry.nickname, currentUserNickname) || i === 0 ? (
            <AnimatedCat health={RANK_HEALTH[i]} scale={rankToScale(targetSize)} filter={rankFilter} />
          ) : (
            <CatSprite
              row={RANK_SPRITE_POSES[i].row}
              col={RANK_SPRITE_POSES[i].col}
              flip={RANK_SPRITE_POSES[i].flip}
              scale={rankToScale(targetSize)}
              filter={rankFilter}
            />
          ),
        );
        roots.push(root);

        const label = document.createElement('div');
        label.className = 'leaderboard-marker__label';
        label.title = `${entry.nickname} - ${formatScore(entry.avgOverallScore)}`;
        label.textContent = `${entry.nickname}  ${formatScore(entry.avgOverallScore)}`;
        wrapper.appendChild(label);

        const marker = new maplibregl.Marker({ element: wrapper, anchor: 'bottom' })
          .setLngLat([pos.lng, pos.lat])
          .addTo(map);
        markers.push(marker);
      });
    };

    mountMapMarkers();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
      markers.forEach((marker) => marker.remove());
      roots.forEach((root) => root.unmount());
      map.remove();
    };
  }, []);

  return (
    <div
      className="overlay leaderboard-map-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Sydney leaderboard map"
    >
      <div className="leaderboard-map-shell" style={{ animation: 'slideUp 0.3s ease-out' }} onClick={(event) => event.stopPropagation()}>
        <section className="leaderboard-map-card">
          <div ref={mapContainerRef} className="leaderboard-map-canvas" />
          <div className="leaderboard-map-vignette" />
          <div className="leaderboard-map-location">GREATER SYDNEY REGION</div>

          <aside className="leaderboard-map-hud" aria-label="Top four leaderboard list">
            <div className="leaderboard-map-hud__title">LOCK IN LEADERBOARD</div>
            {top4.length === 0 ? (
              <div className="leaderboard-map-hud__empty">No leaderboard entries yet.</div>
            ) : (
              top4.map((entry, i) => {
                const currentUser = sameNickname(entry.nickname, currentUserNickname);
                return (
                  <div
                    key={`${entry.sessionId}-${entry.nickname}-${i}`}
                    className={[
                      'leaderboard-map-hud__row',
                      currentUser ? 'leaderboard-map-hud__row--current' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="leaderboard-map-hud__rank" style={{ color: RANK_COLORS[i] }}>
                      #{i + 1}
                    </span>
                    <span className="leaderboard-map-hud__name">{entry.nickname}</span>
                    <span className="leaderboard-map-hud__score">{formatScore(entry.avgOverallScore)}</span>
                  </div>
                );
              })
            )}
          </aside>

          <div className="leaderboard-map-actions">
            <button
              type="button"
              className="leaderboard-map-button leaderboard-map-button--ghost"
              onClick={handleShareClick}
            >
              Share
            </button>
            <button
              type="button"
              className="leaderboard-map-button leaderboard-map-button--primary"
              onClick={onClose}
            >
              Start New Session
            </button>
          </div>

          {shareHintVisible && (
            <div className="leaderboard-map-share-hint">Share coming soon</div>
          )}

          <div className="leaderboard-map-attribution">© OpenStreetMap contributors</div>
        </section>
      </div>
    </div>
  );
}
