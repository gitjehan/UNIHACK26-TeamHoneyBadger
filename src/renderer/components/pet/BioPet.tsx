import { useEffect, useRef, useState } from 'react';
import type { PetHealthState, PetState } from '@renderer/lib/types';

interface BioPetProps {
  pet: PetState;
  postureTilt: number;
  postureScore: number;
  focusScore: number;
  stressScore: number;
}

const PX = 8;
const CH = 260;
const TICK = 150;

const BODY: Record<PetHealthState, { m: string; d: string; l: string; o: string }> = {
  Thriving: { m: '#78b888', d: '#58a068', l: '#a8d8b8', o: '#3a6840' },
  Fading:   { m: '#d8b858', d: '#b89838', l: '#e8d888', o: '#806820' },
  Wilting:  { m: '#c88070', d: '#a86050', l: '#e0a898', o: '#804030' },
};

const GLOW_RGB: Record<PetHealthState, string> = {
  Thriving: '74,124,89',
  Fading:   '184,134,11',
  Wilting:  '192,57,43',
};

const EC = { o: '#5a5040', b: '#faf5ed', s: '#e8dfd0', h: '#fffcf7', k: '#c89540' };

const EGG_P = [0, 1, 2, 3, 4, 5, 5, 6, 6, 6, 6, 6, 6, 6, 5, 5, 5, 4, 4, 3, 2, 1, 0];

function fp(ctx: CanvasRenderingContext2D, x: number, y: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(x * PX, y * PX, PX, PX);
}

// ── Background — plain white + pixel ground ────────────────

function drawBg(ctx: CanvasRenderingContext2D, w: number) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, CH);

  const gw = Math.ceil(w / PX);
  const gy = Math.ceil(CH / PX) - 5;

  for (let x = 0; x < gw; x++) {
    fp(ctx, x, gy, '#88c488');
    fp(ctx, x, gy + 1, '#78b478');
    fp(ctx, x, gy + 2, '#68a468');
  }

  for (let x = 2; x < gw; x += 4) fp(ctx, x, gy - 1, (x * 3) % 7 < 3 ? '#6aaa6a' : '#78b878');

  const fx = [5, gw - 6, Math.floor(gw / 2) + 7];
  const fc = ['#f0a0b0', '#ffe8e0', '#f5a8b8'];
  for (let i = 0; i < 3; i++) {
    fp(ctx, fx[i], gy - 1, fc[i]);
    fp(ctx, fx[i], gy - 2, '#f0c840');
  }
}

// ── Radial glow behind sprite ──────────────────────────────

function drawGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, health: PetHealthState) {
  const realX = cx * PX + PX / 2;
  const realY = cy * PX;
  const r = 11 * PX;
  const g = ctx.createRadialGradient(realX, realY, 0, realX, realY, r);
  const rgb = GLOW_RGB[health];
  g.addColorStop(0, `rgba(${rgb},0.10)`);
  g.addColorStop(0.5, `rgba(${rgb},0.04)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(realX - r, realY - r, r * 2, r * 2);
}

// ── Shadow ─────────────────────────────────────────────────

function drawShadow(ctx: CanvasRenderingContext2D, cx: number, gy: number, width: number) {
  for (let dx = -width; dx <= width; dx++) {
    fp(ctx, cx + dx, gy - 1, Math.abs(dx) < width ? 'rgba(40,60,40,0.10)' : 'rgba(40,60,40,0.05)');
  }
}

// ── Egg ────────────────────────────────────────────────────

function drawEgg(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  crack: number, frame: number,
  health: PetHealthState,
) {
  const rows = EGG_P.length;
  const half = Math.floor(rows / 2);

  // Wobble frequency tied to health
  const wobbleLen = health === 'Thriving' ? 8 : health === 'Fading' ? 14 : 24;
  const wIdx = frame % wobbleLen;
  const wobble = wIdx < 2 ? 0 : wIdx < 4 ? 1 : wIdx < 6 ? 0 : wIdx < 8 ? -1 : 0;
  const ox = cx + wobble;

  for (let r = 0; r < rows; r++) {
    const hw = EGG_P[r];
    const dy = r - half;
    for (let dx = -hw; dx <= hw; dx++) fp(ctx, ox + dx, cy + dy, EC.b);
  }

  fp(ctx, ox - 2, cy - half + 4, EC.h);
  fp(ctx, ox - 2, cy - half + 5, EC.h);
  fp(ctx, ox - 1, cy - half + 3, EC.h);

  for (let r = 0; r < rows; r++) {
    const hw = EGG_P[r];
    if (hw <= 0) continue;
    const dy = r - half;
    fp(ctx, ox - hw, cy + dy, EC.o);
    fp(ctx, ox + hw, cy + dy, EC.o);
    const prev = r > 0 ? EGG_P[r - 1] : 0;
    const next = r < rows - 1 ? EGG_P[r + 1] : 0;
    for (let dx = prev + 1; dx <= hw; dx++) { fp(ctx, ox + dx, cy + dy, EC.o); fp(ctx, ox - dx, cy + dy, EC.o); }
    for (let dx = next + 1; dx <= hw; dx++) { fp(ctx, ox + dx, cy + dy, EC.o); fp(ctx, ox - dx, cy + dy, EC.o); }
  }

  if (crack > 20) {
    [[-2, 0], [-1, 1], [0, 0], [1, 1], [2, 0]].forEach(([dx, dy]) => fp(ctx, ox + dx, cy + dy, EC.k));
  }
  if (crack > 50) {
    [[1, 4], [2, 3], [3, 4]].forEach(([dx, dy]) => fp(ctx, ox + dx, cy + dy, EC.k));
  }
  if (crack > 80) {
    [[-1, -4], [-2, -3], [-3, -4]].forEach(([dx, dy]) => fp(ctx, ox + dx, cy + dy, EC.k));
  }
}

// ── Pet ────────────────────────────────────────────────────

function drawPet(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  health: PetHealthState,
  stage: number,
  frame: number,
  blink: boolean,
) {
  const c = BODY[health];
  const R = Math.min(8 + Math.floor(stage * 0.5), 10);
  const bounceTable = [0, 0, -1, -1, -1, 0, 0, 0];
  const bounce = bounceTable[frame % bounceTable.length];
  const by = cy + bounce;

  for (let dy = -R; dy <= R; dy++) {
    const hw = Math.round(Math.sqrt(R * R - dy * dy));
    for (let dx = -hw; dx <= hw; dx++) {
      const nx = dx / (hw || 1);
      const ny = dy / R;
      fp(ctx, cx + dx, by + dy, nx < -0.4 && ny < -0.3 ? c.l : nx > 0.3 && ny > 0.25 ? c.d : c.m);
    }
  }
  for (let dy = -R; dy <= R; dy++) {
    const hw = Math.round(Math.sqrt(R * R - dy * dy));
    if (hw <= 0) { fp(ctx, cx, by + dy, c.o); continue; }
    fp(ctx, cx - hw, by + dy, c.o);
    fp(ctx, cx + hw, by + dy, c.o);
    if (dy > -R) { const p = Math.round(Math.sqrt(R * R - (dy - 1) * (dy - 1))); for (let dx = p + 1; dx <= hw; dx++) { fp(ctx, cx + dx, by + dy, c.o); fp(ctx, cx - dx, by + dy, c.o); } }
    if (dy < R) { const n = Math.round(Math.sqrt(R * R - (dy + 1) * (dy + 1))); for (let dx = n + 1; dx <= hw; dx++) { fp(ctx, cx + dx, by + dy, c.o); fp(ctx, cx - dx, by + dy, c.o); } }
  }

  if (stage < 3) {
    fp(ctx, cx, by - R - 1, '#4a8848'); fp(ctx, cx, by - R - 2, '#5aaa58');
    fp(ctx, cx + 1, by - R - 2, '#68bb68'); fp(ctx, cx + 1, by - R - 3, '#78cc78'); fp(ctx, cx + 2, by - R - 3, '#78cc78');
  } else {
    fp(ctx, cx - 2, by - R - 1, '#e8c840'); fp(ctx, cx - 1, by - R - 2, '#f0d848');
    fp(ctx, cx, by - R - 2, '#f0d848'); fp(ctx, cx + 1, by - R - 2, '#f0d848');
    fp(ctx, cx + 2, by - R - 1, '#e8c840'); fp(ctx, cx, by - R - 3, '#f8e868');
    fp(ctx, cx - 1, by - R - 1, '#e8c840'); fp(ctx, cx + 1, by - R - 1, '#e8c840');
  }

  const ey = by - Math.round(R * 0.25);
  const exL = cx - Math.round(R * 0.4);
  const exR = cx + Math.round(R * 0.4);

  if (blink) {
    for (let dx = -1; dx <= 1; dx++) { fp(ctx, exL + dx, ey + 1, '#3a3a3a'); fp(ctx, exR + dx, ey + 1, '#3a3a3a'); }
  } else {
    for (let dy2 = 0; dy2 < 4; dy2++) for (let dx2 = -1; dx2 <= 1; dx2++) { fp(ctx, exL + dx2, ey + dy2, '#ffffff'); fp(ctx, exR + dx2, ey + dy2, '#ffffff'); }
    fp(ctx, exL, ey + 1, '#1a1a2e'); fp(ctx, exL + 1, ey + 1, '#1a1a2e'); fp(ctx, exL, ey + 2, '#1a1a2e'); fp(ctx, exL + 1, ey + 2, '#1a1a2e');
    fp(ctx, exR, ey + 1, '#1a1a2e'); fp(ctx, exR - 1, ey + 1, '#1a1a2e'); fp(ctx, exR, ey + 2, '#1a1a2e'); fp(ctx, exR - 1, ey + 2, '#1a1a2e');
    fp(ctx, exL - 1, ey, '#ffffff'); fp(ctx, exR - 1, ey, '#ffffff');
  }

  const blY = ey + 3;
  fp(ctx, exL - 2, blY, 'rgba(240,160,160,0.45)'); fp(ctx, exL - 3, blY, 'rgba(240,160,160,0.3)');
  fp(ctx, exR + 2, blY, 'rgba(240,160,160,0.45)'); fp(ctx, exR + 3, blY, 'rgba(240,160,160,0.3)');

  const my = by + Math.round(R * 0.45);
  if (health === 'Thriving') {
    fp(ctx, cx - 2, my, '#4a4035'); fp(ctx, cx - 1, my + 1, '#4a4035'); fp(ctx, cx, my + 1, '#4a4035'); fp(ctx, cx + 1, my + 1, '#4a4035'); fp(ctx, cx + 2, my, '#4a4035');
  } else if (health === 'Wilting') {
    fp(ctx, cx - 2, my + 1, '#4a4035'); fp(ctx, cx - 1, my, '#4a4035'); fp(ctx, cx, my, '#4a4035'); fp(ctx, cx + 1, my, '#4a4035'); fp(ctx, cx + 2, my + 1, '#4a4035');
  } else {
    fp(ctx, cx - 1, my, '#4a4035'); fp(ctx, cx, my, '#4a4035'); fp(ctx, cx + 1, my, '#4a4035');
  }

  const fy = by + R;
  fp(ctx, cx - 3, fy, c.o); fp(ctx, cx - 2, fy, c.o); fp(ctx, cx + 2, fy, c.o); fp(ctx, cx + 3, fy, c.o);
  fp(ctx, cx - 3, fy + 1, c.d); fp(ctx, cx - 2, fy + 1, c.d); fp(ctx, cx + 2, fy + 1, c.d); fp(ctx, cx + 3, fy + 1, c.d);
  fp(ctx, cx - 4, fy + 1, c.o); fp(ctx, cx - 1, fy + 1, c.o); fp(ctx, cx + 1, fy + 1, c.o); fp(ctx, cx + 4, fy + 1, c.o);
}

// ── Effects ────────────────────────────────────────────────

function drawHearts(ctx: CanvasRenderingContext2D, cx: number, cy: number, frame: number) {
  for (const h of [{ x: 9, y: -5, p: 0 }, { x: -10, y: -3, p: 8 }, { x: 7, y: 3, p: 16 }]) {
    const t = (frame + h.p) % 30;
    if (t >= 15) continue;
    const rise = Math.floor(t * 0.4);
    const a = t < 10 ? 0.9 : 0.9 - (t - 10) * 0.18;
    const c = `rgba(240,120,140,${a})`;
    const hx = cx + h.x, hy = cy + h.y - rise;
    fp(ctx, hx, hy, c); fp(ctx, hx + 1, hy, c);
    fp(ctx, hx - 1, hy + 1, c); fp(ctx, hx, hy + 1, c); fp(ctx, hx + 1, hy + 1, c); fp(ctx, hx + 2, hy + 1, c);
    fp(ctx, hx, hy + 2, c); fp(ctx, hx + 1, hy + 2, c);
  }
}

function drawSweat(ctx: CanvasRenderingContext2D, cx: number, cy: number, frame: number) {
  const t = frame % 24;
  if (t >= 12) return;
  const d = Math.floor(t * 0.5);
  const a = t < 8 ? 0.7 : 0.7 - (t - 8) * 0.175;
  const c = `rgba(140,180,220,${a})`;
  fp(ctx, cx + 6, cy - 6 + d, c); fp(ctx, cx + 6, cy - 5 + d, c); fp(ctx, cx + 7, cy - 5 + d, c);
}

function drawSparkles(ctx: CanvasRenderingContext2D, cx: number, cy: number, frame: number) {
  for (let i = 0; i < 5; i++) {
    const spots = [[8, -7], [-9, -5], [9, 3], [-8, 5], [10, -1]];
    const ph = (frame + i * 5) % 24;
    if (ph >= 8) continue;
    const a = ph < 4 ? 1 : 1 - (ph - 4) * 0.25;
    fp(ctx, cx + spots[i][0], cy + spots[i][1], `rgba(255,235,150,${a})`);
  }
}

// ── Component ──────────────────────────────────────────────

const HEALTH_HYS = 3000;

export function BioPet({ pet, postureTilt: _tilt, postureScore, focusScore, stressScore }: BioPetProps): JSX.Element {
  void _tilt;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef(0);
  const committedRef = useRef<PetHealthState>(pet.health);
  const pendingRef = useRef<PetHealthState>(pet.health);
  const pendingSinceRef = useRef(Date.now());
  const [committed, setCommitted] = useState<PetHealthState>(pet.health);
  const stageRef = useRef(pet.stage);
  const crackRef = useRef(pet.eggCrackProgress);
  const healthRef = useRef<PetHealthState>(pet.health);

  useEffect(() => { stageRef.current = pet.stage; }, [pet.stage]);
  useEffect(() => { crackRef.current = pet.eggCrackProgress; }, [pet.eggCrackProgress]);
  useEffect(() => { healthRef.current = pet.health; }, [pet.health]);

  useEffect(() => {
    const h = pet.health;
    if (h !== pendingRef.current) { pendingRef.current = h; pendingSinceRef.current = Date.now(); }
    if (h !== committedRef.current && Date.now() - pendingSinceRef.current >= HEALTH_HYS) {
      committedRef.current = h; setCommitted(h);
    }
  }, [pet.health]);

  useEffect(() => {
    const iv = setInterval(() => {
      const p = pendingRef.current;
      if (p !== committedRef.current && Date.now() - pendingSinceRef.current >= HEALTH_HYS) {
        committedRef.current = p; setCommitted(p);
      }
    }, 500);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.parentElement?.clientWidth ?? 300;
    canvas.width = w;
    canvas.height = CH;
    ctx.imageSmoothingEnabled = false;

    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = w;
    bgCanvas.height = CH;
    drawBg(bgCanvas.getContext('2d')!, w);

    const gridW = Math.ceil(w / PX);
    const cx = Math.floor(gridW / 2);
    const gy = Math.ceil(CH / PX) - 5;
    const spriteY = gy - 14;

    let frame = 0;
    const tick = () => {
      timerRef.current = window.setTimeout(tick, TICK);
      ctx.drawImage(bgCanvas, 0, 0);

      const isEgg = stageRef.current === 0;
      const health = committedRef.current;
      const blink = frame % 36 > 33;

      drawGlow(ctx, cx, spriteY, health);
      drawShadow(ctx, cx, gy, isEgg ? 5 : 6);

      if (isEgg) {
        drawEgg(ctx, cx, spriteY, crackRef.current, frame, health);
      } else {
        drawPet(ctx, cx, spriteY, health, stageRef.current, frame, blink);
        if (health === 'Thriving') { drawHearts(ctx, cx, spriteY, frame); drawSparkles(ctx, cx, spriteY, frame); }
        if (health === 'Wilting') drawSweat(ctx, cx, spriteY, frame);
        if (health === 'Fading') drawSparkles(ctx, cx, spriteY, frame);
      }

      frame++;
    };
    tick();

    const onResize = () => {
      const nw = canvas.parentElement?.clientWidth ?? 300;
      canvas.width = nw;
      canvas.height = CH;
      ctx.imageSmoothingEnabled = false;
      bgCanvas.width = nw;
      drawBg(bgCanvas.getContext('2d')!, nw);
    };
    window.addEventListener('resize', onResize);
    return () => { clearTimeout(timerRef.current); window.removeEventListener('resize', onResize); };
    // eslint-disable-next-line
  }, []);

  const hc = pet.health === 'Thriving' ? 'var(--green-primary)' : pet.health === 'Fading' ? 'var(--amber-primary)' : 'var(--red-primary)';
  const hbg = pet.health === 'Thriving' ? 'var(--green-bg)' : pet.health === 'Fading' ? 'var(--amber-bg)' : 'var(--red-bg)';
  const SM = [0, 10, 30, 120, 300, 600];
  const nxt = SM[Math.min(pet.stage + 1, SM.length - 1)];
  const cur = SM[pet.stage] ?? 0;
  const prog = pet.stage >= 5 ? 100 : Math.min(100, Math.round(((pet.totalLockedInMinutes - cur) / Math.max(1, nxt - cur)) * 100));

  return (
    <div className="card">
      <div style={{ width: '100%', height: CH, borderRadius: 12, overflow: 'hidden', imageRendering: 'pixelated' as const }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' as const }} />
      </div>

      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        {/* Stage + health pill */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#A89B8C' }}>
            Stage {pet.stage}
          </span>
          <span style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--text-primary)' }}>
            {pet.stageName}
          </span>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: hbg, color: hc, borderRadius: 999,
              padding: '2px 10px', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginLeft: 'auto',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 3, background: hc }} />
            {pet.health}
          </span>
        </div>

        {/* Evolution bar */}
        {pet.stage < 5 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#A89B8C' }}>
                Evolution
              </span>
              <span style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 500, color: hc }}>
                {prog}%
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--bg-card-muted)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${prog}%`, borderRadius: 4, background: hc, transition: 'width 0.6s ease-out' }} />
            </div>
          </div>
        )}

        {/* Stat chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Chip label="Posture" value={postureScore} />
          <Chip label="Focus" value={focusScore} />
          <Chip label="Stress" value={stressScore} />
          <Chip label="Time" value={`${Math.round(pet.totalLockedInMinutes)}m`} />
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: number | string }) {
  return (
    <span style={{ background: 'var(--bg-card-muted)', border: '1px solid var(--border-card)', borderRadius: 6, padding: '2px 8px', fontSize: 10, color: '#A89B8C', fontWeight: 500, letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>
      {label} <strong style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{typeof value === 'number' ? Math.round(value) : value}</strong>
    </span>
  );
}
