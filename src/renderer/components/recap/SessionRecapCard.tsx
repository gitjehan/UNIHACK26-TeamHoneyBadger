import { useEffect, useRef, useState } from 'react';
import type { SessionRecap } from '@renderer/lib/types';

interface SessionRecapCardProps {
  recap: SessionRecap;
  onCopy: (dataUrl: string) => Promise<void>;
  onSave: (dataUrl: string) => Promise<void>;
  onClose: () => void;
  onRecalibrate: () => void;
}

/* ──────────────────────────────────────────────────────────
   Spotify Wrapped-style session recap card.
   Renders a beautiful 540×960 canvas (9:16 story ratio)
   with gradient background, score arc, stats, and branding.
   ────────────────────────────────────────────────────────── */

const W = 540;
const H = 960;

// ── Color palette ────────────────────────────────────────

function overallGrade(score: number): { label: string; color: string; bg1: string; bg2: string; accent: string } {
  if (score >= 80)
    return { label: 'Exceptional', color: '#2d5a3d', bg1: '#1a3a2a', bg2: '#2d5a3d', accent: '#7bed9f' };
  if (score >= 65)
    return { label: 'Strong', color: '#3d6b4f', bg1: '#1e3d2d', bg2: '#3d6b4f', accent: '#a8e6cf' };
  if (score >= 50)
    return { label: 'Steady', color: '#8a7730', bg1: '#3d3520', bg2: '#6b5c28', accent: '#ffd93d' };
  if (score >= 30)
    return { label: 'Needs Work', color: '#8a5a30', bg1: '#3d2a18', bg2: '#6b4422', accent: '#ffb347' };
  return { label: 'Rough Session', color: '#8a3d3d', bg1: '#3d1a1a', bg2: '#6b2d2d', accent: '#ff6b6b' };
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hrs = Math.floor(minutes);
  const mins = Math.round((minutes - hrs) * 60);
  if (mins === 0) return `${hrs}h`;
  return `${Math.floor(minutes / 60)}h ${mins}m`;
}

function scoreArcColor(score: number): string {
  if (score >= 70) return '#7bed9f';
  if (score >= 40) return '#ffd93d';
  return '#ff6b6b';
}

export function SessionRecapCard({
  recap,
  onCopy,
  onSave,
  onClose,
  onRecalibrate,
}: SessionRecapCardProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataUrlRef = useRef<string>('');
  const [copyLabel, setCopyLabel] = useState('Copy');
  const [saveLabel, setSaveLabel] = useState('Save');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!ctx) return;

    canvas.width = W;
    canvas.height = H;

    const grade = overallGrade(recap.avgOverall);

    // ── Background gradient ──────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, W * 0.3, H);
    bgGrad.addColorStop(0, grade.bg1);
    bgGrad.addColorStop(0.5, grade.bg2);
    bgGrad.addColorStop(1, '#0d1b12');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle noise texture via scattered dots
    ctx.globalAlpha = 0.03;
    for (let i = 0; i < 2000; i++) {
      const nx = Math.random() * W;
      const ny = Math.random() * H;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(nx, ny, 1, 1);
    }
    ctx.globalAlpha = 1;

    // Decorative large circle (top-right, subtle)
    ctx.globalAlpha = 0.06;
    ctx.beginPath();
    ctx.arc(W + 40, -60, 280, 0, Math.PI * 2);
    ctx.fillStyle = grade.accent;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Decorative small circle (bottom-left)
    ctx.globalAlpha = 0.04;
    ctx.beginPath();
    ctx.arc(-30, H - 100, 180, 0, Math.PI * 2);
    ctx.fillStyle = grade.accent;
    ctx.fill();
    ctx.globalAlpha = 1;

    // ── Top branding ─────────────────────────────────────

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '600 13px system-ui, -apple-system, sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillText('KINETIC', 40, 48);
    ctx.letterSpacing = '0px';

    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '400 13px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(recap.date, W - 40, 48);
    ctx.textAlign = 'left';

    // Thin separator
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 64);
    ctx.lineTo(W - 40, 64);
    ctx.stroke();

    // ── Session title ────────────────────────────────────

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 28px system-ui, -apple-system, sans-serif';
    ctx.fillText('Your Session Recap', 40, 104);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '400 15px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${formatDuration(recap.durationMinutes)} session`, 40, 130);

    // ── Overall score arc ────────────────────────────────

    const arcCx = W / 2;
    const arcCy = 258;
    const arcR = 85;
    const arcWidth = 10;
    const scoreAngle = (recap.avgOverall / 100) * Math.PI * 1.5;
    const startAngle = Math.PI * 0.75;

    // Track (dark)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = arcWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(arcCx, arcCy, arcR, startAngle, startAngle + Math.PI * 1.5);
    ctx.stroke();

    // Score arc (colored) with glow
    ctx.save();
    const arcGrad = ctx.createLinearGradient(arcCx - arcR, arcCy, arcCx + arcR, arcCy);
    arcGrad.addColorStop(0, scoreArcColor(recap.avgOverall));
    arcGrad.addColorStop(1, grade.accent);
    ctx.strokeStyle = arcGrad;
    ctx.lineWidth = arcWidth;
    ctx.lineCap = 'round';
    ctx.shadowColor = scoreArcColor(recap.avgOverall);
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(arcCx, arcCy, arcR, startAngle, startAngle + scoreAngle);
    ctx.stroke();
    ctx.restore();

    // Score number
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 52px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${recap.avgOverall}`, arcCx, arcCy + 16);

    // "overall" label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '500 14px system-ui, -apple-system, sans-serif';
    ctx.fillText('OVERALL', arcCx, arcCy + 38);

    // Grade label
    ctx.fillStyle = grade.accent;
    ctx.font = '700 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(grade.label, arcCx, arcCy + 60);

    // Percentile rank (if available)
    if (recap.percentileRank !== null && recap.percentileRank !== undefined) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '400 12px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Top ${100 - recap.percentileRank}% of sessions`, arcCx, arcCy + 80);
    }
    ctx.textAlign = 'left';

    // ── Stat cards grid (2×2) ────────────────────────────

    const cardY = 370;
    const cardW = 220;
    const cardH = 100;
    const gap = 20;
    const leftX = (W - cardW * 2 - gap) / 2;
    const rightX = leftX + cardW + gap;

    const stats = [
      {
        label: 'Posture',
        value: `${recap.avgPosture}`,
        sub: '/100',
        color: scoreArcColor(recap.avgPosture),
      },
      {
        label: 'Focus',
        value: `${recap.avgFocus}`,
        sub: '/100',
        color: scoreArcColor(recap.avgFocus),
      },
      {
        label: 'Best Streak',
        value: recap.bestStreak >= 60 ? `${Math.floor(recap.bestStreak / 60)}h ${recap.bestStreak % 60}m` : `${recap.bestStreak}`,
        sub: recap.bestStreak >= 60 ? '' : 'min',
        color: '#a8e6cf',
      },
      {
        label: 'Blink Rate',
        value: `${recap.avgBlinkRate}`,
        sub: `bpm · ${blinkLabel(recap.avgBlinkRate)}`,
        color: recap.avgBlinkRate >= 12 && recap.avgBlinkRate <= 22 ? '#7bed9f' : '#ffa502',
      },
    ];

    const positions = [
      [leftX, cardY],
      [rightX, cardY],
      [leftX, cardY + cardH + gap],
      [rightX, cardY + cardH + gap],
    ];

    for (let i = 0; i < stats.length; i++) {
      const [cx, cy] = positions[i];
      const s = stats[i];
      drawStatCard(ctx, cx, cy, cardW, cardH, s.label, s.value, s.sub, s.color);
    }

    // ── Upright time bar ─────────────────────────────────

    const barY = cardY + (cardH + gap) * 2 + 10;
    const barX = leftX;
    const barW = cardW * 2 + gap;
    const barH = 60;

    // Card background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    roundRect(ctx, barX, barY, barW, barH, 14);
    ctx.fill();

    // Progress bar track
    const trackX = barX + 16;
    const trackY = barY + 38;
    const trackW = barW - 32;
    const trackH = 6;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    roundRect(ctx, trackX, trackY, trackW, trackH, 3);
    ctx.fill();

    // Progress fill
    const fillRatio = Math.min(1, recap.totalUprightMinutes / Math.max(1, recap.durationMinutes));
    const fillW = Math.max(trackH, trackW * fillRatio);
    const barGrad = ctx.createLinearGradient(trackX, 0, trackX + fillW, 0);
    barGrad.addColorStop(0, grade.accent);
    barGrad.addColorStop(1, scoreArcColor(recap.avgPosture));
    ctx.fillStyle = barGrad;
    roundRect(ctx, trackX, trackY, fillW, trackH, 3);
    ctx.fill();

    // Label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '500 12px system-ui, -apple-system, sans-serif';
    ctx.fillText('TIME UPRIGHT', barX + 16, barY + 24);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      `${formatDuration(recap.totalUprightMinutes)} / ${formatDuration(recap.durationMinutes)}`,
      barX + barW - 16,
      barY + 24,
    );
    ctx.textAlign = 'left';

    // ── Pet evolution section ─────────────────────────────

    const petY = barY + barH + 24;
    const petBoxW = barW;
    const petBoxH = recap.evolved ? 90 : 70;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    roundRect(ctx, leftX, petY, petBoxW, petBoxH, 14);
    ctx.fill();

    // Pet emoji based on stage
    const petEmoji = petStageEmoji(recap.petLevel);
    ctx.font = '36px system-ui';
    ctx.fillText(petEmoji, leftX + 18, petY + 44);

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Stage ${recap.petLevel} · ${recap.petTitle}`, leftX + 68, petY + 30);

    if (recap.evolved) {
      ctx.fillStyle = grade.accent;
      ctx.font = '700 14px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Evolved from Stage ${recap.previousLevel}!`, leftX + 68, petY + 52);

      if (recap.newAccessories.length > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.font = '400 12px system-ui, -apple-system, sans-serif';
        ctx.fillText(`Unlocked: ${recap.newAccessories.join(', ')}`, leftX + 68, petY + 72);
      }
    } else {
      if (recap.newAccessories.length > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.font = '400 12px system-ui, -apple-system, sans-serif';
        ctx.fillText(`Unlocked: ${recap.newAccessories.join(', ')}`, leftX + 68, petY + 52);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = '400 12px system-ui, -apple-system, sans-serif';
        ctx.fillText('Keep going to evolve your pet!', leftX + 68, petY + 52);
      }
    }

    // ── Stress score (bottom stat) ───────────────────────

    const stressY = petY + petBoxH + 20;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    roundRect(ctx, leftX, stressY, petBoxW, 50, 14);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '500 12px system-ui, -apple-system, sans-serif';
    ctx.fillText('AVG STRESS', leftX + 16, stressY + 30);

    const stressColor = recap.avgStress <= 30 ? '#7bed9f' : recap.avgStress <= 60 ? '#ffd93d' : '#ff6b6b';
    ctx.fillStyle = stressColor;
    ctx.font = '700 18px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${recap.avgStress}/100`, leftX + petBoxW - 16, stressY + 32);
    ctx.textAlign = 'left';

    // ── Bottom branding ──────────────────────────────────

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(40, H - 56);
    ctx.lineTo(W - 40, H - 56);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '500 12px system-ui, -apple-system, sans-serif';
    ctx.fillText('KINETIC', 40, H - 30);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '400 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Bio-responsive workspace', W - 40, H - 30);
    ctx.textAlign = 'left';

    dataUrlRef.current = canvas.toDataURL('image/png');
  }, [recap]);

  const dataUrl = () => dataUrlRef.current;

  return (
    <div
      style={{
        width: 420,
        maxWidth: '95vw',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: 18,
        padding: 24,
        boxShadow: '0 24px 48px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>
          Session Recap
        </h3>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 18,
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            padding: '4px 8px',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        aria-label="Session recap card with score breakdown"
        role="img"
        style={{
          width: '100%',
          borderRadius: 14,
          display: 'block',
        }}
      />

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => {
            void onCopy(dataUrl()).then(() => {
              setCopyLabel('Copied!');
              setTimeout(() => setCopyLabel('Copy'), 2000);
            });
          }}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          {copyLabel}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            void onSave(dataUrl()).then(() => {
              setSaveLabel('Saved!');
              setTimeout(() => setSaveLabel('Save'), 2000);
            });
          }}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          {saveLabel}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={onRecalibrate}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          Recalibrate
        </button>
      </div>
    </div>
  );
}

// ── Canvas helpers ───────────────────────────────────────

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

function drawStatCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  sub: string,
  color: string,
): void {
  // Glass card
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();

  // Accent dot
  ctx.beginPath();
  ctx.arc(x + 18, y + 24, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Label
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '500 12px system-ui, -apple-system, sans-serif';
  ctx.fillText(label.toUpperCase(), x + 30, y + 28);

  // Value
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 32px system-ui, -apple-system, sans-serif';
  ctx.fillText(value, x + 18, y + 72);

  // Sub
  if (sub) {
    const vw = ctx.measureText(value).width;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '400 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(sub, x + 22 + vw, y + 72);
  }
}

function blinkLabel(rate: number): string {
  if (rate >= 12 && rate <= 22) return 'healthy';
  if (rate >= 8 && rate <= 28) return 'strained';
  return 'fatigued';
}

function petStageEmoji(stage: number): string {
  switch (stage) {
    case 0: return '\u{1F95A}'; // egg
    case 1: return '\u{1F423}'; // hatching chick
    case 2: return '\u{1F424}'; // baby chick
    case 3: return '\u{1F426}'; // bird
    case 4: return '\u{1F985}'; // eagle
    case 5: return '\u{2B50}';  // star
    default: return '\u{1F331}'; // seedling
  }
}
