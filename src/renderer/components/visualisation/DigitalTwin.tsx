import { useEffect, useRef } from 'react';
import { POSE_CONNECTIONS } from '@renderer/lib/constants';
import type { Point } from '@renderer/lib/types';

interface DigitalTwinProps {
  landmarks: Point[];
  postureScore: number;
  shoulderSlant: number;
}

function scoreColor(score: number): string {
  if (score >= 70) return '#4A7C59';
  if (score >= 40) return '#C4962C';
  return '#C0392B';
}

export function DigitalTwin({ landmarks, postureScore, shoulderSlant }: DigitalTwinProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks.length) return;

    const color = scoreColor(postureScore);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    const mapPoint = (point: Point) => ({
      x: point.x * canvas.width,
      y: point.y * canvas.height,
    });

    for (const [a, b] of POSE_CONNECTIONS) {
      if (!landmarks[a] || !landmarks[b]) continue;
      const p1 = mapPoint(landmarks[a]);
      const p2 = mapPoint(landmarks[b]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    landmarks.forEach((point) => {
      const mapped = mapPoint(point);
      ctx.beginPath();
      ctx.arc(mapped.x, mapped.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [landmarks, postureScore]);

  return (
    <div className="card" style={{ display: 'grid', gap: 10 }}>
      <h3>Digital Twin</h3>
      <canvas ref={canvasRef} width={290} height={280} style={{ width: '100%', borderRadius: 10, background: '#101720' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: 13 }}>
        <span>{shoulderSlant.toFixed(1)}° tilt</span>
        <strong style={{ color: scoreColor(postureScore) }}>{postureScore} /100</strong>
      </div>
    </div>
  );
}
