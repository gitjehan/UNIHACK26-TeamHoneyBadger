import { useEffect, useRef, type RefObject } from 'react';
import { POSE_CONNECTIONS, LANDMARKS } from '@renderer/lib/constants';
import type { Point } from '@renderer/lib/types';

/* ──────────────────────────────────────────────────────────
   WebcamFeed — Webcam overlay with full CV visualisation.

   Draws: skeleton, face mesh wireframe, neck angle arc,
   shoulder tilt line, eye highlights, emotion label,
   and pose landmark dots with visual hierarchy.
   ────────────────────────────────────────────────────────── */

interface WebcamFeedProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  landmarks: Point[];
  faceLandmarks: Point[];
  postureScore: number;
  neckAngle: number;
  shoulderSlant: number;
  emotionState: string;
  blinkRate: number;
  avgEAR: number;
  poseFps: number;
  faceFps: number;
}

// ── Visual hierarchy for joints ──────────────────────────

const MAJOR_JOINTS = new Set([
  LANDMARKS.LEFT_SHOULDER,
  LANDMARKS.RIGHT_SHOULDER,
  LANDMARKS.LEFT_HIP,
  LANDMARKS.RIGHT_HIP,
]);
const HEAD_JOINTS = new Set([LANDMARKS.NOSE, LANDMARKS.LEFT_EAR, LANDMARKS.RIGHT_EAR]);
const MID_JOINTS = new Set([
  LANDMARKS.LEFT_ELBOW,
  LANDMARKS.RIGHT_ELBOW,
  LANDMARKS.LEFT_KNEE,
  LANDMARKS.RIGHT_KNEE,
]);

function jointRadius(index: number): number {
  if (MAJOR_JOINTS.has(index as never)) return 6;
  if (HEAD_JOINTS.has(index as never)) return 5;
  if (MID_JOINTS.has(index as never)) return 4.5;
  return 3.5;
}

// ── Color helpers ────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return '#3D6B4F';
  if (score >= 40) return '#C4962C';
  return '#B85A4D';
}

function scoreColorRGBA(score: number, alpha: number): string {
  if (score >= 70) return `rgba(61, 107, 79, ${alpha})`;
  if (score >= 40) return `rgba(196, 150, 44, ${alpha})`;
  return `rgba(184, 90, 77, ${alpha})`;
}

function isVisible(point: Point | undefined): point is Point {
  if (!point) return false;
  return (point.visibility ?? 1) > 0.05;
}

// ── Face mesh contour indices (key outlines only) ────────
// Jawline, eyebrows, nose bridge, lip outline, eye outlines
// Using standard MediaPipe 468-point topology

const FACE_CONTOURS: [number, number][] = [
  // Jawline
  [10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389],
  [389, 356], [356, 454], [454, 323], [323, 361], [361, 288], [288, 397],
  [397, 365], [365, 379], [379, 378], [378, 400], [400, 377], [377, 152],
  [152, 148], [148, 176], [176, 149], [149, 150], [150, 136], [136, 172],
  [172, 58], [58, 132], [132, 93], [93, 234], [234, 127], [127, 162],
  [162, 21], [21, 54], [54, 103], [103, 67], [67, 109], [109, 10],
  // Left eyebrow
  [46, 53], [53, 52], [52, 65], [65, 55], [55, 107],
  // Right eyebrow
  [276, 283], [283, 282], [282, 295], [295, 285], [285, 336],
  // Left eye
  [33, 7], [7, 163], [163, 144], [144, 145], [145, 153], [153, 154],
  [154, 155], [155, 133], [133, 173], [173, 157], [157, 158], [158, 159],
  [159, 160], [160, 161], [161, 246], [246, 33],
  // Right eye
  [362, 382], [382, 381], [381, 380], [380, 374], [374, 373], [373, 390],
  [390, 249], [249, 263], [263, 466], [466, 388], [388, 387], [387, 386],
  [386, 385], [385, 384], [384, 398], [398, 362],
  // Nose bridge
  [168, 6], [6, 197], [197, 195], [195, 5], [5, 4],
  // Nose bottom
  [4, 1], [1, 19], [19, 94], [94, 2], [2, 164],
  // Outer lips
  [61, 146], [146, 91], [91, 181], [181, 84], [84, 17], [17, 314],
  [314, 405], [405, 321], [321, 375], [375, 291], [291, 409], [409, 270],
  [270, 269], [269, 267], [267, 0], [0, 37], [37, 39], [39, 40], [40, 185], [185, 61],
];

// Eye center indices for highlight circles
const LEFT_EYE_INDICES = [33, 133, 159, 145];
const RIGHT_EYE_INDICES = [362, 263, 386, 374];

export function WebcamFeed({
  videoRef,
  landmarks,
  faceLandmarks,
  postureScore,
  neckAngle,
  shoulderSlant,
  emotionState,
  blinkRate,
  avgEAR,
  poseFps,
  faceFps,
}: WebcamFeedProps): JSX.Element {
  const overlayRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = overlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match canvas resolution to video (DPI-aware)
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 360;
    canvas.width = vw;
    canvas.height = vh;
    ctx.clearRect(0, 0, vw, vh);

    // Mirror canvas to match the mirrored video CSS
    ctx.save();
    ctx.translate(vw, 0);
    ctx.scale(-1, 1);

    const color = scoreColor(postureScore);

    // ── 1. Draw skeleton connections ─────────────────────

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    for (const [a, b] of POSE_CONNECTIONS) {
      const pA = landmarks[a];
      const pB = landmarks[b];
      if (!isVisible(pA) || !isVisible(pB)) continue;
      ctx.beginPath();
      ctx.moveTo(pA.x * vw, pA.y * vh);
      ctx.lineTo(pB.x * vw, pB.y * vh);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // ── 2. Draw pose landmark dots with hierarchy ────────

    const landmarkIndices = Object.values(LANDMARKS) as number[];
    for (const index of landmarkIndices) {
      const point = landmarks[index];
      if (!isVisible(point)) continue;

      const px = point.x * vw;
      const py = point.y * vh;
      const r = jointRadius(index);

      // White outline ring
      ctx.beginPath();
      ctx.arc(px, py, r + 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fill();

      // Filled dot
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // ── 3. Draw shoulder level line with tilt annotation ─

    const ls = landmarks[LANDMARKS.LEFT_SHOULDER];
    const rs = landmarks[LANDMARKS.RIGHT_SHOULDER];
    if (isVisible(ls) && isVisible(rs)) {
      const lx = ls.x * vw;
      const ly = ls.y * vh;
      const rx = rs.x * vw;
      const ry = rs.y * vh;

      // Shoulder line
      ctx.strokeStyle = shoulderSlant > 5 ? '#B85A4D' : '#3D6B4F';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(rx, ry);
      ctx.stroke();

      // Horizontal reference line
      const midY = (ly + ry) / 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.moveTo(lx, midY);
      ctx.lineTo(rx, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Tilt label
      if (shoulderSlant > 1) {
        const midX = (lx + rx) / 2;
        const labelY = Math.min(ly, ry) - 12;
        ctx.font = 'bold 11px monospace';
        const text = `${shoulderSlant.toFixed(1)}° tilt`;
        const tw = ctx.measureText(text).width;

        // Label background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        roundRect(ctx, midX - tw / 2 - 4, labelY - 11, tw + 8, 16, 4);
        ctx.fill();

        ctx.fillStyle = shoulderSlant > 5 ? '#ff6b6b' : '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(text, midX, labelY);
        ctx.textAlign = 'start';
      }
    }

    // ── 4. Draw neck angle arc ───────────────────────────

    const ear = landmarks[LANDMARKS.LEFT_EAR] ?? landmarks[LANDMARKS.RIGHT_EAR];
    const shoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
    const hip = landmarks[LANDMARKS.LEFT_HIP];

    if (isVisible(ear) && isVisible(shoulder) && isVisible(hip)) {
      const sx = shoulder.x * vw;
      const sy = shoulder.y * vh;
      const angleToEar = Math.atan2((ear.y - shoulder.y) * vh, (ear.x - shoulder.x) * vw);
      const angleToHip = Math.atan2((hip.y - shoulder.y) * vh, (hip.x - shoulder.x) * vw);

      // Arc
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 28, Math.min(angleToEar, angleToHip), Math.max(angleToEar, angleToHip), false);
      ctx.stroke();

      // Angle label
      const labelAngle = (angleToEar + angleToHip) / 2;
      const labelX = sx + Math.cos(labelAngle) * 42;
      const labelY = sy + Math.sin(labelAngle) * 42;

      ctx.font = 'bold 11px monospace';
      const angleText = `${Math.round(neckAngle)}°`;
      const atw = ctx.measureText(angleText).width;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      roundRect(ctx, labelX - atw / 2 - 4, labelY - 7, atw + 8, 16, 4);
      ctx.fill();

      ctx.fillStyle = neckAngle >= 160 ? '#7bed9f' : neckAngle >= 150 ? '#ffa502' : '#ff6b6b';
      ctx.textAlign = 'center';
      ctx.fillText(angleText, labelX, labelY + 5);
      ctx.textAlign = 'start';
    }

    // ── 5. Draw face mesh wireframe ──────────────────────

    if (faceLandmarks.length > 100) {
      ctx.strokeStyle = scoreColorRGBA(postureScore, 0.35);
      ctx.lineWidth = 0.7;
      ctx.shadowBlur = 0;

      for (const [a, b] of FACE_CONTOURS) {
        const pA = faceLandmarks[a];
        const pB = faceLandmarks[b];
        if (!pA || !pB) continue;
        ctx.beginPath();
        ctx.moveTo(pA.x * vw, pA.y * vh);
        ctx.lineTo(pB.x * vw, pB.y * vh);
        ctx.stroke();
      }

      // ── 6. Eye region highlights ─────────────────────

      drawEyeHighlight(ctx, faceLandmarks, LEFT_EYE_INDICES, vw, vh, avgEAR);
      drawEyeHighlight(ctx, faceLandmarks, RIGHT_EYE_INDICES, vw, vh, avgEAR);

      // ── 7. Emotion label near face ───────────────────

      if (emotionState && emotionState !== 'unknown') {
        // Use nose tip (index 1) or forehead (index 10) for position
        const anchor = faceLandmarks[10] ?? faceLandmarks[1];
        if (anchor) {
          const ex = anchor.x * vw;
          const ey = anchor.y * vh - 22;

          const emotionEmoji = getEmotionEmoji(emotionState);
          const label = `${emotionEmoji} ${emotionState}`;
          ctx.font = 'bold 11px sans-serif';
          const ew = ctx.measureText(label).width;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
          roundRect(ctx, ex - ew / 2 - 6, ey - 10, ew + 12, 18, 6);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(label, ex, ey + 3);
          ctx.textAlign = 'start';
        }
      }
    }

    ctx.restore(); // undo mirror transform

    // ── 8. HUD overlay (non-mirrored, drawn after restore) ──

    // Blink rate badge (top-right)
    if (blinkRate > 0) {
      ctx.font = 'bold 11px monospace';
      const brText = `${Math.round(blinkRate)} bpm`;
      const brw = ctx.measureText(brText).width;
      const brX = vw - brw - 18;
      const brY = 16;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      roundRect(ctx, brX - 6, brY - 11, brw + 12, 18, 6);
      ctx.fill();

      ctx.fillStyle = blinkRate >= 12 && blinkRate <= 22 ? '#7bed9f' : '#ffa502';
      ctx.fillText(brText, brX, brY + 2);
    }

    // Posture score badge (top-left)
    ctx.font = 'bold 12px monospace';
    const psText = `Posture ${Math.round(postureScore)}`;
    const psw = ctx.measureText(psText).width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    roundRect(ctx, 8, 5, psw + 12, 18, 6);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(psText, 14, 18);
  }, [videoRef, landmarks, faceLandmarks, postureScore, neckAngle, shoulderSlant, emotionState, blinkRate, avgEAR]);

  const points = landmarks.filter(isVisible).length;
  const facePoints = faceLandmarks.length;

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
          minHeight: 0,
        }}
      >
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }}
          muted
          playsInline
          autoPlay
        />
        <canvas
          ref={overlayRef}
          aria-label="Webcam feed with pose and face mesh overlay"
          role="img"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            transform: 'scaleX(-1)',
          }}
        />
      </div>
      <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        {poseFps} fps pose · {faceFps} fps face · {points} body · {facePoints} face pts
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawEyeHighlight(
  ctx: CanvasRenderingContext2D,
  faceLandmarks: Point[],
  indices: number[],
  vw: number,
  vh: number,
  avgEAR: number,
): void {
  let cx = 0;
  let cy = 0;
  let count = 0;
  for (const idx of indices) {
    const p = faceLandmarks[idx];
    if (!p) continue;
    cx += p.x * vw;
    cy += p.y * vh;
    count++;
  }
  if (count === 0) return;
  cx /= count;
  cy /= count;

  const r = 12;
  // avgEAR is a rolling average — for instantaneous blink detection see BlinkDetector.
  // Wider thresholds accommodate non-uniform normalization (x/width, y/height)
  // which inflates EAR beyond the standard 0.25–0.35 textbook range.
  const eyeColor =
    avgEAR < 0.25
      ? 'rgba(255, 107, 107, 0.5)'
      : avgEAR < 0.40
        ? 'rgba(255, 165, 2, 0.4)'
        : 'rgba(123, 237, 159, 0.35)';

  ctx.strokeStyle = eyeColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

function getEmotionEmoji(emotion: string): string {
  switch (emotion.toLowerCase()) {
    case 'happy':
      return '\u{1F60A}';
    case 'sad':
      return '\u{1F614}';
    case 'angry':
      return '\u{1F620}';
    case 'fearful':
      return '\u{1F628}';
    case 'disgusted':
      return '\u{1F922}';
    case 'surprised':
      return '\u{1F632}';
    case 'neutral':
      return '\u{1F610}';
    default:
      return '\u{1F914}';
  }
}
