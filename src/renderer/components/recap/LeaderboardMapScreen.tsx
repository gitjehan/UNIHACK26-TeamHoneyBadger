import { useEffect, useMemo, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LeaderboardEntry } from '@renderer/lib/types';
import { AnimatedCat } from '@renderer/components/pet/CatSprite';
import './leaderboard-map-screen.css';
import MaplibreWorker from 'maplibre-gl/dist/maplibre-gl-csp-worker?worker';

type MaplibreWithWorker = typeof maplibregl & {
  workerClass?: new () => Worker;
};

// Set a CSP-safe worker class before creating any map instances.
(maplibregl as MaplibreWithWorker).workerClass = MaplibreWorker;

const MAP_CENTER: [number, number] = [151.15, -33.87];
const MAP_ZOOM = 10;
const MAP_PITCH = 45;
const MAP_BEARING = -20;
const MAP_STYLE = 'https://demotiles.maplibre.org/style.json';

const SYDNEY_POSITIONS: Array<{ lng: number; lat: number; name: string }> = [
  { lng: 151.2093, lat: -33.8688, name: 'CBD' },
  { lng: 151.2741, lat: -33.8914, name: 'Bondi' },
  { lng: 151.0054, lat: -33.8148, name: 'Parramatta' },
  { lng: 151.2858, lat: -33.7969, name: 'Manly' },
];

const RANK_SIZES = [80, 60, 45, 32] as const;
const RANK_COLORS = ['#f8d66d', '#d8dde9', '#d79b6f', '#adb4c8'] as const;
const RANK_LABELS = ['1st', '2nd', '3rd', '4th'] as const;
const RANK_HEALTH: Array<'Thriving' | 'Fading' | 'Wilting'> = ['Thriving', 'Thriving', 'Fading', 'Wilting'];

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
  const top4 = useMemo(() => entries.slice(0, 4), [entries]);

  useEffect(() => {
    document.body.classList.add('overlay-open');
    return () => document.body.classList.remove('overlay-open');
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      pitch: MAP_PITCH,
      bearing: MAP_BEARING,
      interactive: false,
      attributionControl: false,
    });

    const roots: Root[] = [];
    const markers: maplibregl.Marker[] = [];

    const onMapLoad = () => {
      top4.forEach((entry, i) => {
        const pos = SYDNEY_POSITIONS[i];
        if (!pos) return;

        const rankColor = RANK_COLORS[i];
        const rankLabel = RANK_LABELS[i];
        const targetSize = RANK_SIZES[i];
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
        spriteContainer.className = 'leaderboard-marker__sprite';
        wrapper.appendChild(spriteContainer);

        const root = createRoot(spriteContainer);
        root.render(<AnimatedCat health={RANK_HEALTH[i]} scale={rankToScale(targetSize)} />);
        roots.push(root);

        const label = document.createElement('div');
        label.className = 'leaderboard-marker__label';
        label.textContent = `${entry.nickname}  ${formatScore(entry.avgOverallScore)}`;
        wrapper.appendChild(label);

        const marker = new maplibregl.Marker({ element: wrapper, anchor: 'bottom' })
          .setLngLat([pos.lng, pos.lat])
          .addTo(map);
        markers.push(marker);
      });
    };

    map.once('load', onMapLoad);

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

          <aside className="leaderboard-map-hud" aria-label="Top four leaderboard list">
            <div className="leaderboard-map-hud__title">LOCK IN BOARD</div>
            {top4.length === 0 ? (
              <div className="leaderboard-map-hud__empty">Waiting for leaderboard data...</div>
            ) : (
              top4.map((entry, i) => {
                const currentUser = sameNickname(entry.nickname, currentUserNickname);
                return (
                  <div
                    key={`${entry.sessionId}-${entry.nickname}-${i}`}
                    className={`leaderboard-map-hud__row${currentUser ? ' leaderboard-map-hud__row--current' : ''}`}
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

          <button type="button" className="leaderboard-map-button" onClick={onClose}>
            View Stats <span aria-hidden="true">→</span>
          </button>

          <div className="leaderboard-map-attribution">© OpenStreetMap contributors</div>
        </section>
      </div>
    </div>
  );
}
