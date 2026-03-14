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
const TICK = 150;

const BODY: Record<PetHealthState, { m: string; d: string; l: string; o: string }> = {
  Thriving: { m: '#78b888', d: '#58a068', l: '#a8d8b8', o: '#3a6840' },
  Fading:   { m: '#d8b858', d: '#b89838', l: '#e8d888', o: '#806820' },
  Wilting:  { m: '#c88070', d: '#a86050', l: '#e0a898', o: '#804030' },
};

const EC = { o: '#5a5040', b: '#faf5ed', s: '#e8dfd0', h: '#fffcf7', k: '#c89540', spot: '#f0e4d0' };

function fp(ctx: CanvasRenderingContext2D, x: number, y: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(x * PX, y * PX, PX, PX);
}

function eggHW(dy: number, H: number, W: number): number {
  const t = (dy + H) / (2 * H);
  return Math.round(Math.sin(t * Math.PI) * W * (1 + 0.22 * (1 - t)));
}

// ── Background ─────────────────────────────────────────────

function drawBg(ctx: CanvasRenderingContext2D, w: number) {
  const g = ctx.createLinearGradient(0, 0, 0, CH);
  g.addColorStop(0, '#b8d4e8');
  g.addColorStop(0.5, '#d0e0d8');
  g.addColorStop(1, '#c0d4b8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, CH);

  const gw = Math.ceil(w / PX);
  const gy = Math.ceil(CH / PX) - 4;

  // Pixel clouds
  const clouds = [
    { x: 4, y: 3 },
    { x: gw - 10, y: 2 },
    { x: Math.floor(gw / 2) - 6, y: 4 },
  ];
  for (const cl of clouds) {
    const cc = 'rgba(255,255,255,0.7)';
    const cs = 'rgba(235,240,245,0.5)';
    fp(ctx, cl.x + 1, cl.y, cc); fp(ctx, cl.x + 2, cl.y, cc); fp(ctx, cl.x + 3, cl.y, cc);
    fp(ctx, cl.x, cl.y + 1, cc); fp(ctx, cl.x + 1, cl.y + 1, cc); fp(ctx, cl.x + 2, cl.y + 1, cc);
    fp(ctx, cl.x + 3, cl.y + 1, cc); fp(ctx, cl.x + 4, cl.y + 1, cc);
    fp(ctx, cl.x + 1, cl.y + 2, cs); fp(ctx, cl.x + 2, cl.y + 2, cs); fp(ctx, cl.x + 3, cl.y + 2, cs);
  }

  // Ground layers
  for (let x = 0; x < gw; x++) {
    fp(ctx, x, gy, '#88c488');
    fp(ctx, x, gy + 1, '#78b478');
    fp(ctx, x, gy + 2, '#68a468');
    fp(ctx, x, gy + 3, '#589458');
  }

  // Grass tufts
  for (let x = 0; x < gw; x += 2) {
    const v = (x * 7 + 3) % 5;
    if (v < 2) fp(ctx, x, gy - 1, v === 0 ? '#6aaa6a' : '#78b878');
    if (v === 3) { fp(ctx, x, gy - 1, '#5a9858'); fp(ctx, x, gy - 2, '#6aaa6a'); }
  }

  // 5-petal pixel flowers
  const flowers = [
    { x: 4, c: '#f0a0b0' },
    { x: 10, c: '#fff0ee' },
    { x: gw - 7, c: '#f0b8c8' },
    { x: gw - 14, c: '#ffe0d0' },
    { x: Math.floor(gw / 2) + 6, c: '#f5a8b8' },
  ];
  for (const f of flowers) {
    const cx = f.x;
    const cy = gy - 2;
    fp(ctx, cx, cy - 1, f.c);
    fp(ctx, cx - 1, cy, f.c);
    fp(ctx, cx + 1, cy, f.c);
    fp(ctx, cx, cy + 1, f.c);
    fp(ctx, cx, cy, '#f0c840');
    fp(ctx, cx, cy + 2, '#5a8a50');
    fp(ctx, cx, cy + 3, '#5a8a50');
  }
}

// ── Shadow ─────────────────────────────────────────────────

function drawShadow(ctx: CanvasRenderingContext2D, cx: number, gy: number, width: number) {
  const c1 = 'rgba(40,60,40,0.12)';
  const c2 = 'rgba(40,60,40,0.06)';
  for (let dx = -width; dx <= width; dx++) {
    fp(ctx, cx + dx, gy - 1, Math.abs(dx) < width ? c1 : c2);
  }
}

// ── Egg ────────────────────────────────────────────────────

function drawEgg(ctx: CanvasRenderingContext2D, cx: number, cy: number, crack: number, frame: number) {
  const H = 10, W = 6;
  const wobbleTable = [0, 0, 0, 1, 1, 0, 0, 0, 0, -1, -1, 0];
  const ox = cx + wobbleTable[frame % wobbleTable.length];

  // Fill
  for (let dy = -H; dy <= H; dy++) {
    const hw = eggHW(dy, H, W);
    for (let dx = -hw; dx <= hw; dx++) fp(ctx, ox + dx, cy + dy, EC.b);
  }
  // Highlight (top-left inner area)
  for (let dy = -H + 2; dy < -H + 5; dy++) {
    const hw = eggHW(dy, H, W);
    for (let dx = -hw + 1; dx < -hw + 3 && dx < 0; dx++) fp(ctx, ox + dx, cy + dy, EC.h);
  }
  // Shadow (bottom-right inner area)
  for (let dy = 3; dy <= H - 2; dy++) {
    const hw = eggHW(dy, H, W);
    fp(ctx, ox + hw - 1, cy + dy, EC.s);
    if (hw > 2) fp(ctx, ox + hw - 2, cy + dy, EC.s);
  }
  // Speckles — cute spots
  const spots = [[-2, -4], [1, -6], [3, -2], [-3, 2], [1, 4], [-1, 0], [2, 6]];
  for (const [sx, sy] of spots) {
    const hw = eggHW(sy, H, W);
    if (Math.abs(sx) < hw - 1) fp(ctx, ox + sx, cy + sy, EC.spot);
  }
  // Outline
  for (let dy = -H; dy <= H; dy++) {
    const hw = eggHW(dy, H, W);
    if (hw <= 0) continue;
    fp(ctx, ox - hw, cy + dy, EC.o);
    fp(ctx, ox + hw, cy + dy, EC.o);
    if (dy > -H) {
      const phw = eggHW(dy - 1, H, W);
      for (let dx = phw + 1; dx <= hw; dx++) { fp(ctx, ox + dx, cy + dy, EC.o); fp(ctx, ox - dx, cy + dy, EC.o); }
    }
    if (dy < H) {
      const nhw = eggHW(dy + 1, H, W);
      for (let dx = nhw + 1; dx <= hw; dx++) { fp(ctx, ox + dx, cy + dy, EC.o); fp(ctx, ox - dx, cy + dy, EC.o); }
    }
  }

  // Cracks
  if (crack > 20) {
    const k = EC.k;
    [[-2, -1], [-1, 0], [0, -1], [1, 0], [2, -1], [3, 0]].forEach(([dx, dy]) => fp(ctx, ox + dx, cy + dy, k));
  }
  if (crack > 50) {
    [[-1, 3], [-2, 4], [-3, 3], [-2, 2]].forEach(([dx, dy]) => fp(ctx, ox + dx, cy + dy, EC.k));
  }
  if (crack > 80) {
    [[1, -5], [2, -4], [1, -3], [0, -4], [3, -5]].forEach(([dx, dy]) => fp(ctx, ox + dx, cy + dy, EC.k));
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

  // Body circle — fill with shading
  for (let dy = -R; dy <= R; dy++) {
    const hw = Math.round(Math.sqrt(R * R - dy * dy));
    for (let dx = -hw; dx <= hw; dx++) {
      const nx = dx / (hw || 1);
      const ny = dy / R;
      const isLight = nx < -0.4 && ny < -0.3;
      const isDark = nx > 0.3 && ny > 0.25;
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

  // Leaf sprout (stages 0-2) or crown (3+)
  if (stage < 3) {
    fp(ctx, cx, by - R - 1, '#4a8848');
    fp(ctx, cx, by - R - 2, '#5aaa58');
    fp(ctx, cx + 1, by - R - 2, '#68bb68');
    fp(ctx, cx + 1, by - R - 3, '#78cc78');
    fp(ctx, cx + 2, by - R - 3, '#78cc78');
  } else {
    fp(ctx, cx - 2, by - R - 1, '#e8c840');
    fp(ctx, cx - 1, by - R - 2, '#f0d848');
    fp(ctx, cx, by - R - 2, '#f0d848');
    fp(ctx, cx + 1, by - R - 2, '#f0d848');
    fp(ctx, cx + 2, by - R - 1, '#e8c840');
    fp(ctx, cx, by - R - 3, '#f8e868');
    fp(ctx, cx - 1, by - R - 1, '#e8c840');
    fp(ctx, cx + 1, by - R - 1, '#e8c840');
  }

  // Eyes — 3 wide x 4 tall for maximum cuteness
  const ey = by - Math.round(R * 0.25);
  const exL = cx - Math.round(R * 0.4);
  const exR = cx + Math.round(R * 0.4);

  if (blink) {
    for (let dx = -1; dx <= 1; dx++) {
      fp(ctx, exL + dx, ey + 1, '#3a3a3a');
      fp(ctx, exR + dx, ey + 1, '#3a3a3a');
    }
  } else {
    // White of eyes (3x4)
    for (let dy2 = 0; dy2 < 4; dy2++) {
      for (let dx2 = -1; dx2 <= 1; dx2++) {
        fp(ctx, exL + dx2, ey + dy2, '#ffffff');
        fp(ctx, exR + dx2, ey + dy2, '#ffffff');
      }
    }
    // Pupils (2x2 in lower half)
    fp(ctx, exL, ey + 1, '#1a1a2e');
    fp(ctx, exL + 1, ey + 1, '#1a1a2e');
    fp(ctx, exL, ey + 2, '#1a1a2e');
    fp(ctx, exL + 1, ey + 2, '#1a1a2e');
    fp(ctx, exR, ey + 1, '#1a1a2e');
    fp(ctx, exR - 1, ey + 1, '#1a1a2e');
    fp(ctx, exR, ey + 2, '#1a1a2e');
    fp(ctx, exR - 1, ey + 2, '#1a1a2e');
    // Catch-light highlights (1px, upper-left of each eye)
    fp(ctx, exL - 1, ey, '#ffffff');
    fp(ctx, exR - 1, ey, '#ffffff');
  }

  // Blush cheeks (pink ovals beside eyes)
  const blushY = ey + 3;
  fp(ctx, exL - 2, blushY, 'rgba(240,160,160,0.45)');
  fp(ctx, exL - 3, blushY, 'rgba(240,160,160,0.3)');
  fp(ctx, exL - 2, blushY + 1, 'rgba(240,160,160,0.25)');
  fp(ctx, exR + 2, blushY, 'rgba(240,160,160,0.45)');
  fp(ctx, exR + 3, blushY, 'rgba(240,160,160,0.3)');
  fp(ctx, exR + 2, blushY + 1, 'rgba(240,160,160,0.25)');

  // Mouth
  const my = by + Math.round(R * 0.45);
  if (health === 'Thriving') {
    fp(ctx, cx - 2, my, '#4a4035');
    fp(ctx, cx - 1, my + 1, '#4a4035');
    fp(ctx, cx, my + 1, '#4a4035');
    fp(ctx, cx + 1, my + 1, '#4a4035');
    fp(ctx, cx + 2, my, '#4a4035');
  } else if (health === 'Wilting') {
    fp(ctx, cx - 2, my + 1, '#4a4035');
    fp(ctx, cx - 1, my, '#4a4035');
    fp(ctx, cx, my, '#4a4035');
    fp(ctx, cx + 1, my, '#4a4035');
    fp(ctx, cx + 2, my + 1, '#4a4035');
  } else {
    fp(ctx, cx - 1, my, '#4a4035');
    fp(ctx, cx, my, '#4a4035');
    fp(ctx, cx + 1, my, '#4a4035');
  }

  // Feet (tucked under body)
  const fy = by + R;
  fp(ctx, cx - 3, fy, c.o); fp(ctx, cx - 2, fy, c.o);
  fp(ctx, cx + 2, fy, c.o); fp(ctx, cx + 3, fy, c.o);
  fp(ctx, cx - 3, fy + 1, c.d); fp(ctx, cx - 2, fy + 1, c.d);
  fp(ctx, cx + 2, fy + 1, c.d); fp(ctx, cx + 3, fy + 1, c.d);
  fp(ctx, cx - 4, fy + 1, c.o); fp(ctx, cx - 1, fy + 1, c.o);
  fp(ctx, cx + 1, fy + 1, c.o); fp(ctx, cx + 4, fy + 1, c.o);
}

// ── Effects ────────────────────────────────────────────────

function drawHearts(ctx: CanvasRenderingContext2D, cx: number, cy: number, frame: number) {
  const hearts = [
    { x: 9, y: -5, phase: 0 },
    { x: -10, y: -3, phase: 8 },
    { x: 7, y: 3, phase: 16 },
  ];
  for (const h of hearts) {
    const t = (frame + h.phase) % 30;
    if (t >= 15) continue;
    const rise = Math.floor(t * 0.4);
    const alpha = t < 10 ? 0.9 : 0.9 - (t - 10) * 0.18;
    const hx = cx + h.x;
    const hy = cy + h.y - rise;
    const c = `rgba(240,120,140,${alpha})`;
    fp(ctx, hx, hy, c);
    fp(ctx, hx + 1, hy, c);
    fp(ctx, hx - 1, hy + 1, c);
    fp(ctx, hx, hy + 1, c);
    fp(ctx, hx + 1, hy + 1, c);
    fp(ctx, hx + 2, hy + 1, c);
    fp(ctx, hx, hy + 2, c);
    fp(ctx, hx + 1, hy + 2, c);
  }
}

function drawSweat(ctx: CanvasRenderingContext2D, cx: number, cy: number, frame: number) {
  const t = frame % 24;
  if (t >= 12) return;
  const drop = Math.floor(t * 0.5);
  const alpha = t < 8 ? 0.7 : 0.7 - (t - 8) * 0.175;
  const c = `rgba(140,180,220,${alpha})`;
  fp(ctx, cx + 6, cy - 6 + drop, c);
  fp(ctx, cx + 6, cy - 5 + drop, c);
  fp(ctx, cx + 7, cy - 5 + drop, c);
}

function drawSparkles(ctx: CanvasRenderingContext2D, cx: number, cy: number, frame: number) {
  const spots = [[8, -7], [-9, -5], [9, 3], [-8, 5], [10, -1]];
  for (let i = 0; i < spots.length; i++) {
    const phase = (frame + i * 5) % 24;
    if (phase >= 8) continue;
    const a = phase < 4 ? 1 : 1 - (phase - 4) * 0.25;
    const c = `rgba(255,235,150,${a})`;
    const [sx, sy] = spots[i];
    fp(ctx, cx + sx, cy + sy, c);
    if (phase < 4) {
      fp(ctx, cx + sx + 1, cy + sy, `rgba(255,235,150,${a * 0.5})`);
      fp(ctx, cx + sx, cy + sy - 1, `rgba(255,235,150,${a * 0.5})`);
    }
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

  // Keep refs fresh
  useEffect(() => { stageRef.current = pet.stage; }, [pet.stage]);
  useEffect(() => { crackRef.current = pet.eggCrackProgress; }, [pet.eggCrackProgress]);

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

  // Canvas setup + animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.parentElement?.clientWidth ?? 300;
    canvas.width = w;
    canvas.height = CH;
    ctx.imageSmoothingEnabled = false;

    // Pre-render static background
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = w;
    bgCanvas.height = CH;
    const bgCtx = bgCanvas.getContext('2d')!;
    drawBg(bgCtx, w);

    const gridW = Math.ceil(w / PX);
    const cx = Math.floor(gridW / 2);
    const gy = Math.ceil(CH / PX) - 4;
    const spriteY = gy - 14;

    let frame = 0;
    const tick = () => {
      timerRef.current = window.setTimeout(tick, TICK);
      ctx.drawImage(bgCanvas, 0, 0);

      const isEgg = stageRef.current === 0;
      const health = committedRef.current;
      const blink = frame % 36 > 33;

      drawShadow(ctx, cx, gy, isEgg ? 5 : 6);

      if (isEgg) {
        drawEgg(ctx, cx, spriteY, crackRef.current, frame);
      } else {
        drawPet(ctx, cx, spriteY, health, stageRef.current, frame, blink);
        if (health === 'Thriving') {
          drawHearts(ctx, cx, spriteY, frame);
          drawSparkles(ctx, cx, spriteY, frame);
        }
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
