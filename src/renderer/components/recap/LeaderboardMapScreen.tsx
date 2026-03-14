import { useEffect, useMemo, useRef } from 'react';
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
const MAP_ZOOM = 10.15;
const MAP_PITCH = 0;
const MAP_BEARING = 0;
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
const RANK_SPRITE_POSES = [
  { row: 0, col: 2, flip: false },
  { row: 1, col: 3, flip: false },
  { row: 2, col: 1, flip: true },
  { row: 3, col: 2, flip: false },
] as const;

const SYDNEY_CALLOUTS = [
  { lng: 151.2153, lat: -33.8568, label: 'Opera House', emoji: '🎭' },
  { lng: 151.2108, lat: -33.8523, label: 'Harbour Bridge', emoji: '🌉' },
  { lng: 151.2741, lat: -33.8914, label: 'Bondi Beach', emoji: '🏖️' },
] as const;

const FALLBACK_PLAYERS = [
  { nickname: 'HarbourHustler', score: 86 },
  { nickname: 'BondiBlazer', score: 79 },
  { nickname: 'ParraPulse', score: 72 },
  { nickname: 'ManlyMomentum', score: 68 },
] as const;

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

function buildFallbackEntry(index: number, nickname: string, score: number): LeaderboardEntry {
  return {
    nickname,
    sessionId: `fallback-${index + 1}`,
    avgOverallScore: score,
    bestStreak: 0,
    totalLockedInMinutes: 0,
    level: 1,
    levelTitle: 'Starter',
    timestamp: new Date(0).toISOString(),
  };
}

function buildTopFour(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const output = entries.slice(0, 4);
  const used = new Set(output.map((entry) => entry.nickname.trim().toLowerCase()));

  FALLBACK_PLAYERS.forEach((fallback, index) => {
    if (output.length >= 4) return;
    if (used.has(fallback.nickname.toLowerCase())) return;
    output.push(buildFallbackEntry(index, fallback.nickname, fallback.score));
    used.add(fallback.nickname.toLowerCase());
  });

  while (output.length < 4) {
    const index = output.length;
    output.push(buildFallbackEntry(index, `SydneyGuest ${index + 1}`, 60 - index * 4));
  }

  return output;
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
  const top4 = useMemo(() => buildTopFour(entries), [entries]);

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

    const mountMapMarkers = () => {
      const harbourPulse = document.createElement('div');
      harbourPulse.className = 'leaderboard-harbour-pulse';
      const harbourPulseMarker = new maplibregl.Marker({ element: harbourPulse, anchor: 'center' })
        .setLngLat([151.209, -33.86])
        .addTo(map);
      markers.push(harbourPulseMarker);

      SYDNEY_CALLOUTS.forEach((callout) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'leaderboard-sydney-callout';

        const emoji = document.createElement('span');
        emoji.className = 'leaderboard-sydney-callout__emoji';
        emoji.textContent = callout.emoji;
        wrapper.appendChild(emoji);

        const label = document.createElement('span');
        label.className = 'leaderboard-sydney-callout__label';
        label.textContent = callout.label;
        wrapper.appendChild(label);

        const marker = new maplibregl.Marker({ element: wrapper, anchor: 'bottom' })
          .setLngLat([callout.lng, callout.lat])
          .addTo(map);
        markers.push(marker);
      });

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
        spriteContainer.className = 'leaderboard-marker__sprite leaderboard-marker__sprite--pulse';
        wrapper.appendChild(spriteContainer);

        const root = createRoot(spriteContainer);
        root.render(
          sameNickname(entry.nickname, currentUserNickname) || i === 0 ? (
            <AnimatedCat health={RANK_HEALTH[i]} scale={rankToScale(targetSize)} />
          ) : (
            <CatSprite
              row={RANK_SPRITE_POSES[i].row}
              col={RANK_SPRITE_POSES[i].col}
              flip={RANK_SPRITE_POSES[i].flip}
              scale={rankToScale(targetSize)}
            />
          ),
        );
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
          <div className="leaderboard-map-location">SYDNEY, NSW - AUSTRALIA</div>

          <aside className="leaderboard-map-hud" aria-label="Top four leaderboard list">
            <div className="leaderboard-map-hud__title">SYDNEY LOCK IN BOARD</div>
            {top4.map((entry, i) => {
              const currentUser = sameNickname(entry.nickname, currentUserNickname);
              const placeholder = entry.sessionId.startsWith('fallback-');
              return (
                <div
                  key={`${entry.sessionId}-${entry.nickname}-${i}`}
                  className={[
                    'leaderboard-map-hud__row',
                    currentUser ? 'leaderboard-map-hud__row--current' : '',
                    placeholder ? 'leaderboard-map-hud__row--placeholder' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span className="leaderboard-map-hud__rank" style={{ color: RANK_COLORS[i] }}>
                    #{i + 1}
                  </span>
                  <span className="leaderboard-map-hud__name">{entry.nickname}</span>
                  <span className="leaderboard-map-hud__score">{formatScore(entry.avgOverallScore)}</span>
                </div>
              );
            })}
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
