import { useEffect, useMemo, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type * as GeoJSON from 'geojson';
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
const MAP_ZOOM = 10.35;
const MAP_PITCH = 0;
const MAP_BEARING = 0;
const MAP_STYLE = 'https://demotiles.maplibre.org/style.json';
const MAP_BOUNDS: maplibregl.LngLatBoundsLike = [[150.95, -34.08], [151.36, -33.7]];

const SYDNEY_POSITIONS: Array<{ lng: number; lat: number; name: string }> = [
  { lng: 151.2093, lat: -33.8688, name: 'CBD' },
  { lng: 151.2741, lat: -33.8914, name: 'Bondi' },
  { lng: 151.1799, lat: -33.8981, name: 'Inner West' },
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

const SYDNEY_FOCUS_GEOJSON: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [151.03, -33.98],
          [151.06, -33.95],
          [151.11, -33.93],
          [151.16, -33.9],
          [151.22, -33.88],
          [151.27, -33.85],
          [151.31, -33.81],
          [151.33, -33.77],
          [151.28, -33.74],
          [151.19, -33.74],
          [151.11, -33.78],
          [151.06, -33.83],
          [151.03, -33.9],
          [151.03, -33.98],
        ]],
      },
    },
  ],
};

const SYDNEY_WEST_MASK_GEOJSON: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [150.55, -34.3],
          [151.04, -34.3],
          [151.04, -33.5],
          [150.55, -33.5],
          [150.55, -34.3],
        ]],
      },
    },
  ],
};

const SYDNEY_HARBOUR_LINE_GEOJSON: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [151.146, -33.864],
          [151.174, -33.86],
          [151.198, -33.857],
          [151.214, -33.852],
          [151.231, -33.848],
          [151.248, -33.85],
          [151.27, -33.846],
        ],
      },
    },
  ],
};

const MAP_LAYER_IDS = {
  westMaskSource: 'sydney-west-mask-source',
  westMaskLayer: 'sydney-west-mask-layer',
  focusSource: 'sydney-focus-source',
  focusFillLayer: 'sydney-focus-fill-layer',
  focusLineLayer: 'sydney-focus-line-layer',
  focusGlowLayer: 'sydney-focus-glow-layer',
  harbourSource: 'sydney-harbour-line-source',
  harbourLayer: 'sydney-harbour-line-layer',
} as const;

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

function addSydneyContextLayers(map: maplibregl.Map): void {
  if (!map.getSource(MAP_LAYER_IDS.westMaskSource)) {
    map.addSource(MAP_LAYER_IDS.westMaskSource, {
      type: 'geojson',
      data: SYDNEY_WEST_MASK_GEOJSON,
    });
    map.addLayer({
      id: MAP_LAYER_IDS.westMaskLayer,
      type: 'fill',
      source: MAP_LAYER_IDS.westMaskSource,
      paint: {
        'fill-color': '#070b12',
        'fill-opacity': 0.56,
      },
    });
  }

  if (!map.getSource(MAP_LAYER_IDS.focusSource)) {
    map.addSource(MAP_LAYER_IDS.focusSource, {
      type: 'geojson',
      data: SYDNEY_FOCUS_GEOJSON,
    });
    map.addLayer({
      id: MAP_LAYER_IDS.focusFillLayer,
      type: 'fill',
      source: MAP_LAYER_IDS.focusSource,
      paint: {
        'fill-color': '#4fd1ff',
        'fill-opacity': 0.09,
      },
    });
    map.addLayer({
      id: MAP_LAYER_IDS.focusLineLayer,
      type: 'line',
      source: MAP_LAYER_IDS.focusSource,
      paint: {
        'line-color': '#8be7ff',
        'line-width': 2.1,
        'line-opacity': 0.9,
        'line-dasharray': [1.1, 1.3],
      },
    });
    map.addLayer({
      id: MAP_LAYER_IDS.focusGlowLayer,
      type: 'line',
      source: MAP_LAYER_IDS.focusSource,
      paint: {
        'line-color': '#8be7ff',
        'line-width': 4.8,
        'line-opacity': 0.28,
        'line-blur': 1.4,
      },
    });
  }

  if (!map.getSource(MAP_LAYER_IDS.harbourSource)) {
    map.addSource(MAP_LAYER_IDS.harbourSource, {
      type: 'geojson',
      data: SYDNEY_HARBOUR_LINE_GEOJSON,
    });
    map.addLayer({
      id: MAP_LAYER_IDS.harbourLayer,
      type: 'line',
      source: MAP_LAYER_IDS.harbourSource,
      paint: {
        'line-color': '#74f2ff',
        'line-width': 2.4,
        'line-opacity': 0.9,
      },
    });
  }
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
      maxBounds: MAP_BOUNDS,
      interactive: false,
      attributionControl: false,
    });

    const roots: Root[] = [];
    const markers: maplibregl.Marker[] = [];
    let outlinePulseHandle: ReturnType<typeof setInterval> | null = null;

    const mountMapMarkers = () => {
      const enableOutlinePulse = () => {
        if (outlinePulseHandle !== null) return;
        let phase = 0;
        outlinePulseHandle = setInterval(() => {
          if (!map.getLayer(MAP_LAYER_IDS.focusGlowLayer)) return;
          phase += 0.16;
          const pulse = (Math.sin(phase) + 1) / 2;
          map.setPaintProperty(MAP_LAYER_IDS.focusGlowLayer, 'line-width', 4.4 + pulse * 3.2);
          map.setPaintProperty(MAP_LAYER_IDS.focusGlowLayer, 'line-opacity', 0.18 + pulse * 0.4);
        }, 120);
      };

      if (map.loaded()) {
        addSydneyContextLayers(map);
        enableOutlinePulse();
      } else {
        map.once('load', () => {
          addSydneyContextLayers(map);
          enableOutlinePulse();
        });
      }

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
      if (outlinePulseHandle !== null) clearInterval(outlinePulseHandle);
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
          <div className="leaderboard-map-west-cut" />
          <div className="leaderboard-map-vignette" />
          <div className="leaderboard-map-location">SYDNEY HARBOUR BASIN - NSW</div>

          <aside className="leaderboard-map-hud" aria-label="Top four leaderboard list">
            <div className="leaderboard-map-hud__title">SYDNEY LOCK IN BOARD</div>
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

          <button type="button" className="leaderboard-map-button" onClick={onClose}>
            View Stats <span aria-hidden="true">→</span>
          </button>

          <div className="leaderboard-map-attribution">© OpenStreetMap contributors</div>
        </section>
      </div>
    </div>
  );
}
