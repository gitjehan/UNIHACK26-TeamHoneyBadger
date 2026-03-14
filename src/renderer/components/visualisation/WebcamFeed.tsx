import { useEffect, useRef, type RefObject } from 'react';
import { LANDMARKS } from '@renderer/lib/constants';
import type { Point } from '@renderer/lib/types';

interface WebcamFeedProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  poseFps: number;
  faceFps: number;
  landmarks?: Point[];
  postureScore?: number;
}

const UPPER_CONNECTIONS: [number, number][] = [
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
];

const JOINT_IDS = [
  LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER,
  LANDMARKS.LEFT_ELBOW, LANDMARKS.RIGHT_ELBOW,
  LANDMARKS.LEFT_WRIST, LANDMARKS.RIGHT_WRIST,
];

function scoreColor(score: number): string {
  if (score >= 70) return '#4A7C59';
  if (score >= 40) return '#B8860B';
  return '#C0392B';
}

function isVis(p: Point | undefined): p is Point {
  return !!p && (p.visibility ?? 1) > 0.05;
}

const LERP = 0.3;

function SkeletonOverlay({ landmarks, postureScore }: { landmarks: Point[]; postureScore: number }): JSX.Element {
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

    const ctx = canvas.getContext('2d', { alpha: true });
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
      ctx.clearRect(0, 0, W, H);

      const lm = landmarksRef.current;
      if (!lm.length) return;

      const score = postureScoreRef.current;
      const color = scoreColor(score);

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

      // Map normalized coords to canvas — canvas is scaleX(-1) matched to mirrored video
      const mp = (p: Point) => ({ x: p.x * W, y: p.y * H });

      // Connections
      for (const [a, b] of UPPER_CONNECTIONS) {
        const pA = sm[a], pB = sm[b];
        if (!isVis(pA) || !isVis(pB)) continue;
        const p1 = mp(pA), p2 = mp(pB);
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // Head
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
        const sSpan = Math.abs(rS.x - lS.x) * W;
        const headR = Math.max(sSpan * 0.28, 10);

        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.85;

        // Neck
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(hm.x, hm.y + headR * 0.8);
        ctx.lineTo(sMid.x, sMid.y);
        ctx.stroke();

        // Head circle (outline only so user's face shows through)
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.fillStyle = 'transparent';
        ctx.beginPath();
        ctx.arc(hm.x, hm.y, headR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Joints
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      for (const id of JOINT_IDS) {
        const pt = sm[id];
        if (!isVis(pt)) continue;
        const m = mp(pt);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    };

    draw();

    return () => {
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
      mountedRef.current = false;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        transform: 'scaleX(-1)',
        pointerEvents: 'none',
      }}
    />
  );
}

export function WebcamFeed({ videoRef, poseFps, faceFps, landmarks = [], postureScore = 0 }: WebcamFeedProps): JSX.Element {
  return (
    <div className="card" style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 10, minHeight: 0, overflow: 'hidden' }}>
      <h3>Webcam Feed</h3>
      <div
        style={{
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
          background: 'var(--bg-card-muted)',
          border: '1px solid var(--border-card)',
          minHeight: 140,
          aspectRatio: '4 / 3',
        }}
      >
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block', position: 'absolute', inset: 0 }}
          muted
          playsInline
          autoPlay
        />
        {landmarks.length > 0 && (
          <SkeletonOverlay landmarks={landmarks} postureScore={postureScore} />
        )}
      </div>
      <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        {poseFps} fps pose · {faceFps} fps face
      </div>
    </div>
  );
}
