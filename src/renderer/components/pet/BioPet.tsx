import { useEffect, useRef, useState } from 'react';
import type { PetHealthState, PetState } from '@renderer/lib/types';

interface BioPetProps {
  pet: PetState;
  postureTilt: number;
  postureScore: number;
  focusScore: number;
  stressScore: number;
}

const PX = 7;
const CH = 240;
const ANIM_INTERVAL = 150;

const BODY: Record<PetHealthState, { m: string; d: string; l: string; o: string }> = {
  Thriving: { m: '#78b888', d: '#58a068', l: '#a0d8b0', o: '#3a6840' },
  Fading:   { m: '#d8b858', d: '#b89838', l: '#e8d888', o: '#806820' },
  Wilting:  { m: '#c88070', d: '#a86050', l: '#e0a898', o: '#804030' },
};

const EGG_C = { o: '#5a5040', b: '#faf5ed', s: '#e8dfd0', h: '#fffcf7', k: '#c89540' };

// ── Pixel helpers ──────────────────────────────────────────

function fp(ctx: CanvasRenderingContext2D, x: number, y: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(x * PX, y * PX, PX, PX);
}

function eggHW(dy: number, H: number, W: number): number {
  const t = (dy + H) / (2 * H);
  return Math.round(Math.sin(t * Math.PI) * W * (1 + 0.2 * (1 - t)));
}

// ── Drawing functions ──────────────────────────────────────

function drawBg(ctx: CanvasRenderingContext2D, w: number) {
  const g = ctx.createLinearGradient(0, 0, 0, CH);
  g.addColorStop(0, '#c5dae8');
  g.addColorStop(0.55, '#d8e4dc');
  g.addColorStop(1, '#c8d8c0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, CH);

  const gw = Math.ceil(w / PX);
  const gy = Math.ceil(CH / PX) - 4;

  for (let x = 0; x < gw; x++) {
    fp(ctx, x, gy, '#88c488');
    fp(ctx, x, gy + 1, '#78b478');
    fp(ctx, x, gy + 2, '#68a468');
    fp(ctx, x, gy + 3, '#589458');
  }

  // Grass tufts (deterministic)
  for (let x = 1; x < gw; x += 3) {
    fp(ctx, x, gy - 1, x % 5 < 2 ? '#6aaa6a' : '#78b878');
  }

  // Tiny flowers
  const fc = ['#f0a0b0', '#ffe8e0', '#f0b8c8', '#fff0ee'];
  const fx = [3, 9, gw - 6, gw - 12, Math.floor(gw / 2) + 5];
  for (let i = 0; i < fx.length; i++) {
    const xx = fx[i];
    fp(ctx, xx, gy - 1, fc[i % fc.length]);
    fp(ctx, xx, gy - 2, '#f0c040');
    fp(ctx, xx - 1, gy - 1, fc[(i + 1) % fc.length]);
  }
}

function drawEgg(ctx: CanvasRenderingContext2D, cx: number, cy: number, crack: number, frame: number) {
  const H = 10, W = 6;
  const wobble = [0, 0, 1, 0, 0, -1][frame % 6];
  const ox = cx + wobble;

  // Fill
  for (let dy = -H; dy <= H; dy++) {
    const hw = eggHW(dy, H, W);
    for (let dx = -hw; dx <= hw; dx++) fp(ctx, ox + dx, cy + dy, EGG_C.b);
  }
  // Shading
  for (let dy = -H + 1; dy < 0; dy++) {
    const hw = eggHW(dy, H, W);
    for (let dx = -hw + 1; dx < -hw + 3 && dx < hw; dx++) fp(ctx, ox + dx, cy + dy, EGG_C.h);
  }
  for (let dy = 2; dy <= H - 1; dy++) {
    const hw = eggHW(dy, H, W);
    for (let dx = hw - 2; dx <= hw - 1; dx++) fp(ctx, ox + dx, cy + dy, EGG_C.s);
  }
  // Outline
  for (let dy = -H; dy <= H; dy++) {
    const hw = eggHW(dy, H, W);
    if (hw <= 0) continue;
    fp(ctx, ox - hw, cy + dy, EGG_C.o);
    fp(ctx, ox + hw, cy + dy, EGG_C.o);
    if (dy > -H) {
      const phw = eggHW(dy - 1, H, W);
      for (let dx = phw + 1; dx <= hw; dx++) { fp(ctx, ox + dx, cy + dy, EGG_C.o); fp(ctx, ox - dx, cy + dy, EGG_C.o); }
    }
    if (dy < H) {
      const nhw = eggHW(dy + 1, H, W);
      for (let dx = nhw + 1; dx <= hw; dx++) { fp(ctx, ox + dx, cy + dy, EGG_C.o); fp(ctx, ox - dx, cy + dy, EGG_C.o); }
    }
  }

  // Cracks
  if (crack > 20) {
    [[-2, -1], [-1, 0], [0, -1], [1, 0], [2, -1]].forEach(([dx, dy]) => fp(ctx, ox + dx, cy + dy, EGG_C.k));
  }
  if (crack > 50) {
    [[1, 3], [2, 2], [3, 3], [2, 4]].forEach(([dx, dy]) => fp(ctx, ox + dx, cy + dy, EGG_C.k));
  }
  if (crack > 80) {
    [[-3, -4], [-2, -3], [-1, -4], [0, -5]].forEach(([dx, dy]) => fp(ctx, ox + dx, cy + dy, EGG_C.k));
  }
}

function drawPet(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  health: PetHealthState,
  frame: number,
  blink: boolean,
) {
  const c = BODY[health];
  const R = 8;
  const bounce = frame % 4 < 2 ? 0 : -1;
  const by = cy + bounce;

  // Body circle — fill
  for (let dy = -R; dy <= R; dy++) {
    const hw = Math.round(Math.sqrt(R * R - dy * dy));
    for (let dx = -hw; dx <= hw; dx++) {
      const isLight = dx < -hw * 0.35 && dy < -R * 0.3;
      const isDark = dx > hw * 0.35 && dy > R * 0.3;
      fp(ctx, cx + dx, by + dy, isLight ? c.l : isDark ? c.d : c.m);
    }
  }
  // Body outline
  for (let dy = -R; dy <= R; dy++) {
    const hw = Math.round(Math.sqrt(R * R - dy * dy));
    if (hw <= 0) { fp(ctx, cx, by + dy, c.o); continue; }
    fp(ctx, cx - hw, by + dy, c.o);
    fp(ctx, cx + hw, by + dy, c.o);
    if (dy > -R) {
      const phw = Math.round(Math.sqrt(R * R - (dy - 1) * (dy - 1)));
      for (let dx = phw + 1; dx <= hw; dx++) { fp(ctx, cx + dx, by + dy, c.o); fp(ctx, cx - dx, by + dy, c.o); }
    }
    if (dy < R) {
      const nhw = Math.round(Math.sqrt(R * R - (dy + 1) * (dy + 1)));
      for (let dx = nhw + 1; dx <= hw; dx++) { fp(ctx, cx + dx, by + dy, c.o); fp(ctx, cx - dx, by + dy, c.o); }
    }
  }

  // Leaf / sprout on top
  fp(ctx, cx, by - R - 2, '#5a9a58');
  fp(ctx, cx, by - R - 1, '#5a9a58');
  fp(ctx, cx + 1, by - R - 3, '#78c878');
  fp(ctx, cx + 2, by - R - 3, '#78c878');
  fp(ctx, cx + 1, by - R - 2, '#78c878');

  // Eyes
  const ey = by - 2;
  if (blink) {
    // Closed eyes — horizontal line
    for (let dx = -1; dx <= 1; dx++) { fp(ctx, cx - 3 + dx, ey, '#3a3a3a'); fp(ctx, cx + 3 + dx, ey, '#3a3a3a'); }
  } else {
    // Open eyes — 3x3 white with 1x2 pupil
    for (let dy2 = -1; dy2 <= 1; dy2++) {
      for (let dx2 = -1; dx2 <= 1; dx2++) {
        fp(ctx, cx - 3 + dx2, ey + dy2, '#ffffff');
        fp(ctx, cx + 3 + dx2, ey + dy2, '#ffffff');
      }
    }
    // Pupils
    fp(ctx, cx - 3, ey, '#1a1a1a');
    fp(ctx, cx - 3, ey + 1, '#1a1a1a');
    fp(ctx, cx + 3, ey, '#1a1a1a');
    fp(ctx, cx + 3, ey + 1, '#1a1a1a');
    // Highlights
    fp(ctx, cx - 4, ey - 1, '#ffffff');
    fp(ctx, cx + 2, ey - 1, '#ffffff');
  }

  // Blush
  fp(ctx, cx - 5, ey + 2, '#e8989880');
  fp(ctx, cx - 6, ey + 2, '#e8989860');
  fp(ctx, cx + 5, ey + 2, '#e8989880');
  fp(ctx, cx + 6, ey + 2, '#e8989860');

  // Mouth
  if (health === 'Thriving') {
    fp(ctx, cx - 1, by + 3, '#4a4035');
    fp(ctx, cx, by + 4, '#4a4035');
    fp(ctx, cx + 1, by + 3, '#4a4035');
  } else if (health === 'Wilting') {
    fp(ctx, cx - 1, by + 4, '#4a4035');
    fp(ctx, cx, by + 3, '#4a4035');
    fp(ctx, cx + 1, by + 4, '#4a4035');
  } else {
    fp(ctx, cx - 1, by + 3, '#4a4035');
    fp(ctx, cx, by + 3, '#4a4035');
    fp(ctx, cx + 1, by + 3, '#4a4035');
  }

  // Feet
  fp(ctx, cx - 3, by + R + 1, c.d);
  fp(ctx, cx - 2, by + R + 1, c.d);
  fp(ctx, cx + 2, by + R + 1, c.d);
  fp(ctx, cx + 3, by + R + 1, c.d);
  fp(ctx, cx - 3, by + R, c.o);
  fp(ctx, cx - 2, by + R, c.o);
  fp(ctx, cx + 2, by + R, c.o);
  fp(ctx, cx + 3, by + R, c.o);
}

function drawSparkles(ctx: CanvasRenderingContext2D, cx: number, cy: number, frame: number) {
  const t = frame % 20;
  const sparkles = [[8, -6], [-9, -4], [7, 4], [-8, 6], [10, 0]];
  for (let i = 0; i < sparkles.length; i++) {
    const [sx, sy] = sparkles[i];
    const phase = (t + i * 4) % 20;
    if (phase < 6) {
      const alpha = phase < 3 ? 1 : 0.5;
      ctx.fillStyle = `rgba(255,230,140,${alpha})`;
      ctx.fillRect((cx + sx) * PX, (cy + sy) * PX, PX, PX);
    }
  }
}

// ── Component ──────────────────────────────────────────────

const HEALTH_HYS = 3000;

export function BioPet({ pet, postureTilt, postureScore, focusScore, stressScore }: BioPetProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef(0);
  const timerRef = useRef(0);

  const committedRef = useRef<PetHealthState>(pet.health);
  const pendingRef = useRef<PetHealthState>(pet.health);
  const pendingSinceRef = useRef(Date.now());
  const [committed, setCommitted] = useState<PetHealthState>(pet.health);
  const stageRef = useRef(pet.stage);

  // Health hysteresis
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

  // Canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.parentElement?.clientWidth ?? 300;
    canvas.width = w;
    canvas.height = CH;
    ctx.imageSmoothingEnabled = false;

    // Pre-render background
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = w;
    bgCanvas.height = CH;
    const bgCtx = bgCanvas.getContext('2d')!;
    drawBg(bgCtx, w);
    bgRef.current = bgCanvas;

    const gridW = Math.ceil(w / PX);
    const centerX = Math.floor(gridW / 2);
    const groundY = Math.ceil(CH / PX) - 4;
    const spriteY = groundY - 13;

    let frame = 0;
    const tick = () => {
      timerRef.current = window.setTimeout(tick, ANIM_INTERVAL);

      // Blit background
      ctx.drawImage(bgCanvas, 0, 0);

      const isEgg = stageRef.current === 0;
      const blink = frame % 30 > 27;

      if (isEgg) {
        drawEgg(ctx, centerX, spriteY, pet.eggCrackProgress, frame);
      } else {
        drawPet(ctx, centerX, spriteY, committedRef.current, frame, blink);
        if (committedRef.current === 'Thriving') drawSparkles(ctx, centerX, spriteY, frame);
      }

      frame++;
      frameRef.current = frame;
    };
    tick();

    const onResize = () => {
      const nw = canvas.parentElement?.clientWidth ?? 300;
      canvas.width = nw;
      canvas.height = CH;
      ctx.imageSmoothingEnabled = false;
      bgCanvas.width = nw;
      const bc = bgCanvas.getContext('2d')!;
      drawBg(bc, nw);
    };
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(timerRef.current);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line
  }, []);

  // Update stage ref
  useEffect(() => { stageRef.current = pet.stage; }, [pet.stage]);

  const hc = pet.health === 'Thriving' ? 'var(--green-primary)' : pet.health === 'Fading' ? 'var(--amber-primary)' : 'var(--red-primary)';
  const hbg = pet.health === 'Thriving' ? 'var(--green-bg)' : pet.health === 'Fading' ? 'var(--amber-bg)' : 'var(--red-bg)';
  const STAGE_MINS = [0, 10, 30, 120, 300, 600];
  const nxt = STAGE_MINS[Math.min(pet.stage + 1, STAGE_MINS.length - 1)];
  const cur = STAGE_MINS[pet.stage] ?? 0;
  const prog = pet.stage >= 5 ? 100 : Math.min(100, Math.round(((pet.totalLockedInMinutes - cur) / Math.max(1, nxt - cur)) * 100));

  return (
    <div className="card">
      <h3>Bio-Pet</h3>
      <div style={{ width: '100%', height: CH, borderRadius: 12, overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)', imageRendering: 'pixelated' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
      </div>
      <div className="pet-meta" style={{ marginTop: 12, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 14 }}>Stage {pet.stage} · {pet.stageName}</strong>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: hbg, color: hc, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: hc }} />{pet.health}
          </span>
        </div>
        {pet.stage < 5 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3 }}>
              <span>Evolution</span><span>{prog}%</span>
            </div>
            <div style={{ height: 5, background: 'var(--bg-card-muted)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${prog}%`, borderRadius: 999, background: hc, transition: 'width 0.6s ease-out' }} />
            </div>
          </div>
        )}
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
    <span style={{ background: 'var(--bg-card-muted)', border: '1px solid var(--border-card)', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
      {label} <strong style={{ color: 'var(--text-primary)' }}>{typeof value === 'number' ? Math.round(value) : value}</strong>
    </span>
  );
}
