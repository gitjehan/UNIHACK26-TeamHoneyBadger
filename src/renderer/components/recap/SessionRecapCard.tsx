import { useEffect, useMemo, useRef } from 'react';
import type { SessionRecap } from '@renderer/lib/types';

interface SessionRecapCardProps {
  recap: SessionRecap;
  onCopy: (dataUrl: string) => Promise<void>;
  onSave: (dataUrl: string) => Promise<void>;
  onClose: () => void;
}

function blinkRateLabel(rate: number): string {
  if (rate >= 12 && rate <= 22) return 'healthy';
  if (rate >= 8 && rate <= 28) return 'slightly strained';
  return 'fatigued';
}

export function SessionRecapCard({ recap, onCopy, onSave, onClose }: SessionRecapCardProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataUrlRef = useRef<string>('');
  const percentileLine = useMemo(
    () =>
      recap.percentileRank === null
        ? 'Percentile unavailable (not enough board data)'
        : `Neck angle better than ${recap.percentileRank}% of users`,
    [recap.percentileRank],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 480;
    canvas.height = 640;

    ctx.fillStyle = '#F8F4ED';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#2D2B28';
    ctx.font = '700 32px system-ui';
    ctx.fillText('KINETIC RECAP', 44, 70);
    ctx.font = '500 16px system-ui';
    ctx.fillStyle = '#5C5650';
    ctx.fillText(recap.date, 44, 100);

    ctx.fillStyle = '#EDE3D5';
    ctx.fillRect(44, 130, 392, 150);
    ctx.fillStyle = '#2D2B28';
    ctx.font = '600 22px system-ui';
    ctx.fillText(`Stage ${recap.petLevel} · ${recap.petTitle}`, 66, 196);
    ctx.font = '500 15px system-ui';
    ctx.fillText(`Accessories: ${recap.newAccessories.join(', ') || 'None this session'}`, 66, 228);

    ctx.fillStyle = '#2D2B28';
    ctx.font = '700 24px system-ui';
    ctx.fillText(`Upright: ${Math.round((recap.totalUprightMinutes / 60) * 10) / 10} hrs`, 44, 330);
    ctx.font = '500 18px system-ui';
    ctx.fillText(percentileLine, 44, 365);
    ctx.fillText(`Best streak: ${recap.bestStreak} min`, 44, 400);
    ctx.fillText(`Avg posture: ${recap.avgPosture} /100`, 44, 435);
    ctx.fillText(`Blink rate: ${recap.avgBlinkRate} bpm (${blinkRateLabel(recap.avgBlinkRate)})`, 44, 470);

    if (recap.evolved) {
      ctx.fillStyle = '#2A7A3F';
      ctx.font = '700 20px system-ui';
      ctx.fillText(`Pet evolved from Stage ${recap.previousLevel} to ${recap.petLevel}!`, 44, 515);
    }

    ctx.fillStyle = '#756B61';
    ctx.font = '500 14px system-ui';
    ctx.fillText('kinetic.app', 44, 600);
    ctx.fillText('Share or save this recap', 320, 600);

    dataUrlRef.current = canvas.toDataURL('image/png');
  }, [percentileLine, recap]);

  const dataUrl = () => dataUrlRef.current;

  return (
    <div className="card" style={{ width: 560, maxWidth: '95vw' }}>
      <h3>Session Recap</h3>
      <canvas
        ref={canvasRef}
        width={480}
        height={640}
        style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border-card)', background: '#f8f4ed' }}
      />
      <div className="actions">
        <button className="btn btn-primary" type="button" onClick={() => void onCopy(dataUrl())}>
          Copy
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => void onSave(dataUrl())}>
          Save PNG
        </button>
        <button className="btn btn-secondary" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
