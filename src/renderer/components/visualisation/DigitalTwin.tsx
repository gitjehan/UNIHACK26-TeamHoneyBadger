import { memo, useEffect, useRef } from 'react';
import { LANDMARKS } from '@renderer/lib/constants';
import type { Point } from '@renderer/lib/types';

interface DigitalTwinProps {
  landmarks: Point[];
  postureScore: number;
  shoulderSlant: number;
}

/* ── connections ─────────────────────────────────────── */
const UPPER_CONNECTIONS: [number, number][] = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
];

/* Landmark indices we actually use for framing */
const UPPER_LANDMARK_IDS = [
  LANDMARKS.NOSE, LANDMARKS.LEFT_EAR, LANDMARKS.RIGHT_EAR,
  LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER,
  LANDMARKS.LEFT_ELBOW, LANDMARKS.RIGHT_ELBOW,
  LANDMARKS.LEFT_WRIST, LANDMARKS.RIGHT_WRIST,
];

/* ── colour by score ─────────────────────────────────── */
function scoreColor(score: number): string {
  if (score >= 70) return '#4A7C59';
  if (score >= 40) return '#B8860B';
  return '#C0392B';
}

function isVis(p: Point | undefined): p is Point {
  return !!p && (p.visibility ?? 1) > 0.05;
}

const LERP = 0.3;

/* ── component ──────────────────────────────────────── */
function DigitalTwinImpl({ landmarks, postureScore, shoulderSlant }: DigitalTwinProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const mountedRef = useRef(false);

  const landmarksRef = useRef<Point[]>(landmarks);
  const postureScoreRef = useRef(postureScore);
  const smoothedRef = useRef<Point[]>([]);

  landmarksRef.current = landmarks;
  postureScoreRef.current = postureScore;

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
      }
    };

    const ro = new ResizeObserver(syncSize);
    ro.observe(canvas);
    syncSize();

    const draw = () => {
      frameRef.current = requestAnimationFrame(draw);

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const score = postureScoreRef.current;
      const lm = landmarksRef.current;
      const color = scoreColor(score);

      // Clear with muted background
      ctx.fillStyle = '#f0ebe3';
      ctx.fillRect(0, 0, W, H);

      if (!lm.length) return;

      // Smooth landmarks
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

      // Compute bounding box of visible upper-body landmarks to center & scale
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      let visCount = 0;
      for (const id of UPPER_LANDMARK_IDS) {
        const pt = sm[id];
        if (!isVis(pt)) continue;
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
        visCount++;
      }
      if (visCount < 2) return;

      // Add padding around bounding box (in normalised coords)
      const bboxPad = 0.06;
      minX -= bboxPad; maxX += bboxPad;
      minY -= bboxPad; maxY += bboxPad;
      const bW = Math.max(maxX - minX, 0.1);
      const bH = Math.max(maxY - minY, 0.1);

      // Fit bounding box into canvas with uniform scale, centered
      const canvasPad = 0.08;
      const drawW = W * (1 - 2 * canvasPad);
      const drawH = H * (1 - 2 * canvasPad);
      const scale = Math.min(drawW / bW, drawH / bH);
      const offsetX = W / 2 - ((minX + maxX) / 2) * scale;
      const offsetY = H / 2 - ((minY + maxY) / 2) * scale;
      const mp = (p: Point) => ({ x: offsetX + p.x * scale, y: offsetY + p.y * scale });

      // Draw connections
      const drawLine = (a: number, b: number, alpha: number, width: number) => {
        const pA = sm[a], pB = sm[b];
        if (!isVis(pA) || !isVis(pB)) return;
        const p1 = mp(pA), p2 = mp(pB);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      };

      // Upper body
      ctx.globalAlpha = 1;
      for (const [a, b] of UPPER_CONNECTIONS) drawLine(a, b, 1, 4);

      // Head - simple circle
      const lS = sm[LANDMARKS.LEFT_SHOULDER];
      const rS = sm[LANDMARKS.RIGHT_SHOULDER];
      const headPts = [sm[LANDMARKS.NOSE], sm[LANDMARKS.LEFT_EAR], sm[LANDMARKS.RIGHT_EAR]].filter(isVis);
      if (headPts.length && isVis(lS) && isVis(rS)) {
        const hc = {
          x: headPts.reduce((s, p) => s + p.x, 0) / headPts.length,
          y: headPts.reduce((s, p) => s + p.y, 0) / headPts.length,
        };
        const sMid = mp({ x: (lS.x + rS.x) / 2, y: (lS.y + rS.y) / 2 } as Point);
        const hm = mp(hc as Point);
        const sSpan = Math.abs(rS.x - lS.x);
        const headR = Math.max(sSpan * scale * 0.28, 12);

        // Neck
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(hm.x, hm.y + headR * 0.8);
        ctx.lineTo(sMid.x, sMid.y);
        ctx.stroke();

        // Head circle
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(hm.x, hm.y, headR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Joints - simple dots
      ctx.globalAlpha = 1;
      const jointIds = [
        LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER,
        LANDMARKS.LEFT_ELBOW, LANDMARKS.RIGHT_ELBOW,
        LANDMARKS.LEFT_WRIST, LANDMARKS.RIGHT_WRIST,
      ];

      for (const i of jointIds) {
        const pt = sm[i];
        if (!isVis(pt)) continue;
        const m = mp(pt);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    };

    draw();

    return () => {
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
      mountedRef.current = false;
    };
  }, []);

  const live = landmarks.length > 0;
  const color = scoreColor(postureScore);

  return (
    <div className="card digital-twin-card">
      <div className="digital-twin-header">
        <h3 className="digital-twin-title">Digital Twin</h3>
        <span className="digital-twin-live" style={{ color: live ? '#4A7C59' : '#A89B8C' }}>
          <span
            className="digital-twin-live-dot"
            style={{
              background: live ? '#4A7C59' : '#bbb',
            }}
          />
          Live
        </span>
      </div>

      <canvas
        ref={canvasRef}
        className="digital-twin-canvas"
      />

      <div className="digital-twin-footer">
        <span className="digital-twin-tilt">
          {shoulderSlant.toFixed(1)}° tilt
        </span>
        <div className="digital-twin-score-wrap">
          <div className="digital-twin-score-label">
            Alignment
          </div>
          <span className="digital-twin-score" style={{ color }}>
            {postureScore}
          </span>
          <span className="digital-twin-score-unit">/100</span>
        </div>
      </div>
    </div>
  );
}

export const DigitalTwin = memo(DigitalTwinImpl);
