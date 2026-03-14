import { useEffect, useRef, useState, type RefObject } from 'react';
import { LANDMARKS } from '@renderer/lib/constants';
import type { Point } from '@renderer/lib/types';

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

interface WebcamFeedProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  landmarks?: Point[];
  postureScore?: number;
  collapsed: boolean;
  onToggle: () => void;
}

function PositionPrompt(): JSX.Element {
  return (
    <div className="webcam-no-person" role="status">
      <div className="webcam-no-person__content">
        <svg
          className="webcam-no-person__icon"
          viewBox="0 0 64 64"
          width="56"
          height="56"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path d="M4 18V4h14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M46 4h14v14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M60 46v14H46" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18 60H4V46" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="32" cy="24" r="7" strokeWidth="2" />
          <path d="M18 54c0-8 6.3-14 14-14s14 6 14 14" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="webcam-no-person__text">
          Position yourself directly in front of the camera for Kinetic to work
        </p>
      </div>
    </div>
  );
}

const LOST_DELAY_MS = 1500;
const INITIAL_GRACE_MS = 5000;

export function WebcamFeed({ videoRef, landmarks = [], postureScore = 0, collapsed, onToggle }: WebcamFeedProps): JSX.Element {
  const [personDetected, setPersonDetected] = useState(true);
  const lostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasEverDetected = useRef(false);

  const hasLandmarks = landmarks.length > 0;

  useEffect(() => {
    if (hasLandmarks) {
      hasEverDetected.current = true;
      if (lostTimerRef.current) {
        clearTimeout(lostTimerRef.current);
        lostTimerRef.current = null;
      }
      setPersonDetected(true);
    } else if (!lostTimerRef.current) {
      const delay = hasEverDetected.current ? LOST_DELAY_MS : INITIAL_GRACE_MS;
      lostTimerRef.current = setTimeout(() => {
        setPersonDetected(false);
        lostTimerRef.current = null;
      }, delay);
    }
  }, [hasLandmarks]);

  useEffect(() => {
    return () => {
      if (lostTimerRef.current) clearTimeout(lostTimerRef.current);
    };
  }, []);

  const showPrompt = !personDetected && !collapsed;

  return (
    <div className={`card webcam-card${collapsed ? ' webcam-card--collapsed' : ''}`}>
      <div className="webcam-card__header">
        <h3 className="webcam-card__title">Webcam Feed</h3>
        <button
          type="button"
          onClick={onToggle}
          className="webcam-toggle"
          title={collapsed ? 'Show webcam' : 'Hide webcam'}
          aria-expanded={!collapsed}
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {/* Always mounted — only hidden via CSS so the MediaStream stays attached */}
      <div className={`webcam-stage${collapsed ? ' webcam-stage--hidden' : ''}${showPrompt ? ' webcam-stage--dimmed' : ''}`}>
        <video
          ref={videoRef}
          className="webcam-video"
          muted
          playsInline
          autoPlay
        />
        {hasLandmarks && personDetected && (
          <SkeletonOverlay landmarks={landmarks} postureScore={postureScore} />
        )}
        {showPrompt && <PositionPrompt />}
      </div>
    </div>
  );
}
