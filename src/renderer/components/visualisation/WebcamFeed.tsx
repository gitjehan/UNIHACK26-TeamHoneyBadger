import { useEffect, useRef, type RefObject } from 'react';
import type { Point } from '@renderer/lib/types';

interface WebcamFeedProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  landmarks: Point[];
  postureScore: number;
  poseFps: number;
  faceFps: number;
}

function scoreColor(score: number): string {
  if (score >= 70) return '#4A7C59';
  if (score >= 40) return '#C4962C';
  return '#C0392B';
}

export function WebcamFeed({
  videoRef,
  landmarks,
  postureScore,
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

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = scoreColor(postureScore);
    landmarks.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x * canvas.width, point.y * canvas.height, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [videoRef, landmarks, postureScore]);

  const points = landmarks.length;

  return (
    <div className="card" style={{ display: 'grid', gap: 10 }}>
      <h3>Webcam Feed</h3>
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#0d1117' }}>
        <video
          ref={videoRef}
          style={{ width: '100%', transform: 'scaleX(-1)', display: 'block' }}
          muted
          playsInline
          autoPlay
        />
        <canvas
          ref={overlayRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        />
      </div>
      <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        {poseFps} fps pose · {faceFps} fps face · {points} pts
      </div>
    </div>
  );
}
