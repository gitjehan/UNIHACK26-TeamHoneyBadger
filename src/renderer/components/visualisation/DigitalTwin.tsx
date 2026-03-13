import { memo, useEffect, useRef } from 'react';
import { LANDMARKS } from '@renderer/lib/constants';
import type { Point } from '@renderer/lib/types';

interface DigitalTwinProps {
  landmarks: Point[];
  postureScore: number;
  shoulderSlant: number;
}

/* ── live upper-body connections ─────────────────────── */
const UPPER_CONNECTIONS: [number, number][] = [
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [11, 23], [12, 24],
];

/* ── static seated lower-body connections ───────────── */
const LOWER_CONNECTIONS: [number, number][] = [
  [23, 24],
  [23, 25], [25, 27],
  [24, 26], [26, 28],
];

/* ── colour helpers ─────────────────────────────────── */

type ColorBand = 'good' | 'fair' | 'poor';

function getColorBand(score: number): ColorBand {
  if (score >= 70) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

const COLORS: Record<ColorBand, string> = {
  good: '#3D6B4F',
  fair: '#C4962C',
  poor: '#B85A4D',
};

const GLOWS: Record<ColorBand, string> = {
  good: 'rgba(61,107,79,0.50)',
  fair: 'rgba(196,150,44,0.50)',
  poor: 'rgba(184,90,77,0.50)',
};

const BG_TINTS: Record<ColorBand, string> = {
  good: 'rgba(61,107,79,0.03)',
  fair: 'rgba(196,150,44,0.03)',
  poor: 'rgba(184,90,77,0.03)',
};

function isVis(p: Point | undefined): p is Point {
  if (!p) return false;
  return (p.visibility ?? 1) > 0.05;
}

/* ── joint hierarchy ────────────────────────────────── */

const MAJOR: Set<number> = new Set([LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER, LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP]);
const MID: Set<number> = new Set([LANDMARKS.LEFT_ELBOW, LANDMARKS.RIGHT_ELBOW, LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE]);
const HEAD_IDS: Set<number> = new Set([LANDMARKS.NOSE, LANDMARKS.LEFT_EAR, LANDMARKS.RIGHT_EAR]);
const LOWER_IDS: Set<number> = new Set([
  LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP,
  LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE,
  LANDMARKS.LEFT_ANKLE, LANDMARKS.RIGHT_ANKLE,
]);

function jointR(i: number): number {
  if (MAJOR.has(i)) return 6;
  if (MID.has(i)) return 5;
  return 4;
}

const LERP = 0.32;

/* ── component ──────────────────────────────────────── */

function DigitalTwinImpl({ landmarks, postureScore, shoulderSlant }: DigitalTwinProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const mountedRef = useRef(false);

  // Reactive value refs (updated each render, read in animation loop)
  const landmarksRef = useRef<Point[]>(landmarks);
  const postureScoreRef = useRef(postureScore);
  const shoulderSlantRef = useRef(shoulderSlant);

  // Smoothed landmarks (mutated in-place)
  const smoothedRef = useRef<Point[]>([]);

  // Cached gradients and canvas size
  const bgGradientRef = useRef<CanvasGradient | null>(null);
  const lastSizeRef = useRef({ w: 0, h: 0 });
  const lastColorBandRef = useRef<ColorBand>('good');

  // Keep refs up to date (cheap, no effect re-run)
  landmarksRef.current = landmarks;
  postureScoreRef.current = postureScore;
  shoulderSlantRef.current = shoulderSlant;

  /* ── mount-once: setup canvas + animation loop ───────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mountedRef.current) return;
    mountedRef.current = true;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const syncSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        bgGradientRef.current = null; // invalidate cached gradient
      }
    };

    const ro = new ResizeObserver(syncSize);
    ro.observe(canvas);
    syncSize();

    /* ── animation loop ───────────────────────────────── */
    const draw = () => {
      frameRef.current = requestAnimationFrame(draw);

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const score = postureScoreRef.current;
      const lm = landmarksRef.current;
      const colorBand = getColorBand(score);
      const color = COLORS[colorBand];
      const glow = GLOWS[colorBand];
      const tint = BG_TINTS[colorBand];

      // Rebuild background gradient if size or color band changed
      if (
        !bgGradientRef.current ||
        lastSizeRef.current.w !== W ||
        lastSizeRef.current.h !== H ||
        lastColorBandRef.current !== colorBand
      ) {
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, 'rgba(0,0,0,0.05)');
        bg.addColorStop(0.45, 'rgba(0,0,0,0.015)');
        bg.addColorStop(1, 'rgba(0,0,0,0.055)');
        bgGradientRef.current = bg;
        lastSizeRef.current = { w: W, h: H };
        lastColorBandRef.current = colorBand;
      }

      // Clear and draw background
      ctx.fillStyle = bgGradientRef.current!;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);

      if (!lm.length) return;

      // Smooth upper body landmarks (mutate in-place)
      const sm = smoothedRef.current;
      for (let i = 0; i < lm.length; i++) {
        const target = lm[i];
        const prev = sm[i];
        if (!prev || !isVis(prev) || !isVis(target)) {
          sm[i] = { ...target };
        } else {
          sm[i] = {
            x: prev.x + (target.x - prev.x) * LERP,
            y: prev.y + (target.y - prev.y) * LERP,
            z: target.z,
            visibility: target.visibility,
          };
        }
      }

      // Derive seated lower body from shoulders
      const lS = sm[LANDMARKS.LEFT_SHOULDER];
      const rS = sm[LANDMARKS.RIGHT_SHOULDER];

      if (isVis(lS) && isVis(rS)) {
        const mx = (lS.x + rS.x) / 2;
        const sSpan = Math.abs(rS.x - lS.x);
        const sY = (lS.y + rS.y) / 2;
        const below = Math.max(1.0 - sY, 0.25);

        const hipY = sY + below * 0.36;
        const kneeY = sY + below * 0.48;
        const ankleY = sY + below * 0.76;

        const hipHW = sSpan * 0.40;
        const kneeHW = sSpan * 0.52;
        const ankleHW = sSpan * 0.30;

        sm[LANDMARKS.LEFT_HIP]    = { x: mx - hipHW, y: hipY, z: 0, visibility: 1 };
        sm[LANDMARKS.RIGHT_HIP]   = { x: mx + hipHW, y: hipY, z: 0, visibility: 1 };
        sm[LANDMARKS.LEFT_KNEE]   = { x: mx - kneeHW, y: kneeY, z: 0, visibility: 1 };
        sm[LANDMARKS.RIGHT_KNEE]  = { x: mx + kneeHW, y: kneeY, z: 0, visibility: 1 };
        sm[LANDMARKS.LEFT_ANKLE]  = { x: mx - ankleHW, y: ankleY, z: 0, visibility: 1 };
        sm[LANDMARKS.RIGHT_ANKLE] = { x: mx + ankleHW, y: ankleY, z: 0, visibility: 1 };
      }

      // Coordinate mapping with padding
      const pad = 0.07;
      const dW = W * (1 - 2 * pad);
      const dH = H * (1 - 2 * pad);
      const oX = W * pad;
      const oY = H * pad;
      const mp = (p: Point) => ({ x: oX + p.x * dW, y: oY + p.y * dH });

      // Centerline reference
      ctx.strokeStyle = 'rgba(255,255,255,0.055)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 8]);
      ctx.beginPath();
      ctx.moveTo(W / 2, oY);
      ctx.lineTo(W / 2, oY + dH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Seat / chair hint
      const lH = sm[LANDMARKS.LEFT_HIP], rH = sm[LANDMARKS.RIGHT_HIP];
      if (isVis(lH) && isVis(rH)) {
        const l = mp(lH), r = mp(rH);
        const ext = (r.x - l.x) * 0.35;
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(l.x - ext, l.y + 3);
        ctx.quadraticCurveTo((l.x + r.x) / 2, l.y + 8, r.x + ext, r.y + 3);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Batched connection drawing (no shadowBlur)
      const drawConnections = (conns: [number, number][], alpha: number, lw: number) => {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (const [a, b] of conns) {
          const pA = sm[a], pB = sm[b];
          if (!isVis(pA) || !isVis(pB)) continue;
          const p1 = mp(pA), p2 = mp(pB);
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      };

      // Lower body (faded, static)
      drawConnections(LOWER_CONNECTIONS, 0.38, 3.5);

      // Upper body (bright, live)
      drawConnections(UPPER_CONNECTIONS, 1, 4.5);

      // Head
      const headPts = [sm[LANDMARKS.NOSE], sm[LANDMARKS.LEFT_EAR], sm[LANDMARKS.RIGHT_EAR]].filter(isVis);

      if (headPts.length && isVis(lS) && isVis(rS)) {
        const hc = {
          x: headPts.reduce((s, p) => s + p.x, 0) / headPts.length,
          y: headPts.reduce((s, p) => s + p.y, 0) / headPts.length,
        };
        const sMid = mp({ x: (lS.x + rS.x) / 2, y: (lS.y + rS.y) / 2 } as Point);
        const hm = mp(hc as Point);
        const sSpan = Math.abs(rS.x - lS.x);
        const headR = Math.max(sSpan * dW * 0.30, 14);

        // Neck (no shadow)
        ctx.strokeStyle = color;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hm.x, hm.y + headR * 0.75);
        ctx.lineTo(sMid.x, sMid.y);
        ctx.stroke();

        // Head outer glow ring (cheap static glow instead of shadowBlur)
        ctx.beginPath();
        ctx.arc(hm.x, hm.y, headR + 6, 0, Math.PI * 2);
        ctx.fillStyle = glow.replace(/[\d.]+\)$/, '0.08)');
        ctx.fill();

        ctx.beginPath();
        ctx.arc(hm.x, hm.y, headR + 3, 0, Math.PI * 2);
        ctx.fillStyle = glow.replace(/[\d.]+\)$/, '0.12)');
        ctx.fill();

        // Head fill with gradient
        const hg = ctx.createRadialGradient(
          hm.x - headR * 0.18, hm.y - headR * 0.18, headR * 0.05,
          hm.x, hm.y, headR,
        );
        hg.addColorStop(0, color + 'ee');
        hg.addColorStop(0.7, color + 'bb');
        hg.addColorStop(1, color + '88');
        ctx.beginPath();
        ctx.arc(hm.x, hm.y, headR, 0, Math.PI * 2);
        ctx.fillStyle = hg;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.30)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Face features — tiny dot eyes + smile arc
        const eyeOff = headR * 0.28;
        const eyeY = hm.y - headR * 0.08;
        const eyeR = Math.max(headR * 0.08, 1.5);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(hm.x - eyeOff, eyeY, eyeR, 0, Math.PI * 2);
        ctx.arc(hm.x + eyeOff, eyeY, eyeR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(hm.x, hm.y + headR * 0.08, headR * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();

        // Ear indicators
        const lEar = sm[LANDMARKS.LEFT_EAR], rEar = sm[LANDMARKS.RIGHT_EAR];
        ctx.fillStyle = color + 'aa';
        if (isVis(lEar)) {
          const ep = mp(lEar);
          ctx.beginPath();
          ctx.arc(ep.x, ep.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        if (isVis(rEar)) {
          const ep = mp(rEar);
          ctx.beginPath();
          ctx.arc(ep.x, ep.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Batched joints (skip head landmarks)
      // First pass: white backing circles
      ctx.fillStyle = 'rgba(255,255,255,0.80)';
      for (let i = 0; i < sm.length; i++) {
        const pt = sm[i];
        if (!isVis(pt) || HEAD_IDS.has(i)) continue;
        const m = mp(pt);
        const r = jointR(i);
        const lower = LOWER_IDS.has(i);
        ctx.globalAlpha = lower ? 0.4 : 1;
        ctx.beginPath();
        ctx.arc(m.x, m.y, r + 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Second pass: colored fills with cheap glow (extra circle behind)
      for (let i = 0; i < sm.length; i++) {
        const pt = sm[i];
        if (!isVis(pt) || HEAD_IDS.has(i)) continue;
        const m = mp(pt);
        const r = jointR(i);
        const lower = LOWER_IDS.has(i);
        ctx.globalAlpha = lower ? 0.4 : 1;

        // Cheap glow: larger semi-transparent circle behind
        ctx.fillStyle = glow.replace(/[\d.]+\)$/, lower ? '0.15)' : '0.25)');
        ctx.beginPath();
        ctx.arc(m.x, m.y, r + 3, 0, Math.PI * 2);
        ctx.fill();

        // Main joint
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Shoulder-level indicator
      if (isVis(lS) && isVis(rS)) {
        const pl = mp(lS), pr = mp(rS);
        const mY = (pl.y + pr.y) / 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.09)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(pl.x - 10, mY);
        ctx.lineTo(pr.x + 10, mY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };

    draw();

    // Cleanup
    return () => {
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
      mountedRef.current = false;
    };
  }, []);

  const live = landmarks.length > 0;
  const color = COLORS[getColorBand(postureScore)];

  return (
    <div className="card" style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          Digital Twin
        </h3>
        <span style={{ fontSize: 11, color: live ? '#3D6B4F' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: live ? '#3D6B4F' : '#bbb',
              boxShadow: live ? '0 0 4px rgba(61,107,79,0.5)' : 'none',
            }}
          />
          Live
        </span>
      </div>

      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          aspectRatio: '5 / 6',
          borderRadius: 10,
          background: 'var(--bg-card-muted)',
          border: '1px solid var(--border-card)',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '2px 0' }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {shoulderSlant.toFixed(1)}° tilt
        </span>
        <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
            Alignment
          </div>
          <span style={{ fontSize: 26, fontWeight: 700, color, letterSpacing: '-0.02em' }}>
            {postureScore}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 2 }}>/100</span>
        </div>
      </div>
    </div>
  );
}

export const DigitalTwin = memo(DigitalTwinImpl);
