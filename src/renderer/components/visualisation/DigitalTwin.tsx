import { useEffect, useRef, useCallback } from 'react';
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

function scoreColor(score: number): string {
  if (score >= 70) return '#3D6B4F';
  if (score >= 40) return '#C4962C';
  return '#B85A4D';
}

function scoreGlow(score: number): string {
  if (score >= 70) return 'rgba(61,107,79,0.50)';
  if (score >= 40) return 'rgba(196,150,44,0.50)';
  return 'rgba(184,90,77,0.50)';
}

function scoreBgTint(score: number): string {
  if (score >= 70) return 'rgba(61,107,79,0.03)';
  if (score >= 40) return 'rgba(196,150,44,0.03)';
  return 'rgba(184,90,77,0.03)';
}

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

export function DigitalTwin({ landmarks, postureScore, shoulderSlant }: DigitalTwinProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const smoothedRef = useRef<Point[]>([]);

  const syncSize = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(c);
    return () => ro.disconnect();
  }, [syncSize]);

  /* ── main draw ──────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    syncSize();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    /* ── background ─────────────────────────────────── */
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, 'rgba(0,0,0,0.05)');
    bg.addColorStop(0.45, 'rgba(0,0,0,0.015)');
    bg.addColorStop(1, 'rgba(0,0,0,0.055)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const tint = scoreBgTint(postureScore);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);

    if (!landmarks.length) return;

    /* ── smooth upper body ──────────────────────────── */
    const sm = landmarks.map((target, i) => {
      const prev = smoothedRef.current[i];
      if (!prev || !isVis(prev) || !isVis(target)) return target;
      return {
        x: prev.x + (target.x - prev.x) * LERP,
        y: prev.y + (target.y - prev.y) * LERP,
        z: target.z,
        visibility: target.visibility,
      } as Point;
    });

    /* ── derive seated lower body ───────────────────── */
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

    smoothedRef.current = sm;

    /* ── coordinate mapping with padding ─────────────── */
    const pad = 0.07;
    const dW = W * (1 - 2 * pad);
    const dH = H * (1 - 2 * pad);
    const oX = W * pad;
    const oY = H * pad;
    const mp = (p: Point) => ({ x: oX + p.x * dW, y: oY + p.y * dH });

    const color = scoreColor(postureScore);
    const glow = scoreGlow(postureScore);

    /* ── centerline reference ───────────────────────── */
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.055)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 8]);
    ctx.beginPath();
    ctx.moveTo(W / 2, oY);
    ctx.lineTo(W / 2, oY + dH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    /* ── draw a connection line ──────────────────────── */
    const drawLine = (a: number, b: number, alpha: number, lw: number, blur: number) => {
      const pA = sm[a], pB = sm[b];
      if (!isVis(pA) || !isVis(pB)) return;
      const p1 = mp(pA), p2 = mp(pB);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = glow;
      ctx.shadowBlur = blur;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.restore();
    };

    /* ── seat / chair hint ──────────────────────────── */
    const lH = sm[LANDMARKS.LEFT_HIP], rH = sm[LANDMARKS.RIGHT_HIP];
    if (isVis(lH) && isVis(rH)) {
      const l = mp(lH), r = mp(rH);
      const ext = (r.x - l.x) * 0.35;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(l.x - ext, l.y + 3);
      ctx.quadraticCurveTo((l.x + r.x) / 2, l.y + 8, r.x + ext, r.y + 3);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    /* ── lower body (faded, static) ─────────────────── */
    for (const [a, b] of LOWER_CONNECTIONS) drawLine(a, b, 0.38, 3.5, 4);

    /* ── upper body (bright, live) ──────────────────── */
    for (const [a, b] of UPPER_CONNECTIONS) drawLine(a, b, 1, 4.5, 9);

    /* ── head ───────────────────────────────────────── */
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

      /* neck */
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.shadowColor = glow;
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.moveTo(hm.x, hm.y + headR * 0.75);
      ctx.lineTo(sMid.x, sMid.y);
      ctx.stroke();
      ctx.restore();

      /* head outer glow ring */
      ctx.save();
      ctx.beginPath();
      ctx.arc(hm.x, hm.y, headR + 3, 0, Math.PI * 2);
      ctx.fillStyle = glow.replace(/[\d.]+\)$/, '0.12)');
      ctx.fill();
      ctx.restore();

      /* head fill with gradient */
      ctx.save();
      ctx.shadowColor = glow;
      ctx.shadowBlur = 12;
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
      ctx.restore();

      /* face features — tiny dot eyes + smile arc */
      const eyeOff = headR * 0.28;
      const eyeY = hm.y - headR * 0.08;
      const eyeR = Math.max(headR * 0.08, 1.5);
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(hm.x - eyeOff, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hm.x + eyeOff, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(hm.x, hm.y + headR * 0.08, headR * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.restore();

      /* ear indicators */
      const lEar = sm[LANDMARKS.LEFT_EAR], rEar = sm[LANDMARKS.RIGHT_EAR];
      if (isVis(lEar)) {
        const ep = mp(lEar);
        ctx.save();
        ctx.fillStyle = color + 'aa';
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (isVis(rEar)) {
        const ep = mp(rEar);
        ctx.save();
        ctx.fillStyle = color + 'aa';
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    /* ── joints (skip head landmarks) ───────────────── */
    sm.forEach((pt, i) => {
      if (!isVis(pt) || HEAD_IDS.has(i)) return;
      const m = mp(pt);
      const r = jointR(i);
      const lower = LOWER_IDS.has(i);
      const a = lower ? 0.4 : 1;

      ctx.save();
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(m.x, m.y, r + 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.80)';
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = a;
      ctx.shadowColor = glow;
      ctx.shadowBlur = lower ? 3 : 6;
      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    });

    /* ── shoulder-level indicator ────────────────────── */
    if (isVis(lS) && isVis(rS)) {
      const pl = mp(lS), pr = mp(rS);
      const mY = (pl.y + pr.y) / 2;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(pl.x - 10, mY);
      ctx.lineTo(pr.x + 10, mY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }, [landmarks, postureScore, syncSize]);

  const live = landmarks.length > 0;
  const color = scoreColor(postureScore);

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
