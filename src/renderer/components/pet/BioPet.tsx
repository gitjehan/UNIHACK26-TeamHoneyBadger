import { memo, useEffect, useRef, useState } from 'react';
import type { PetHealthState, PetState } from '@renderer/lib/types';
import { AnimatedCat } from './CatSprite';
import { PixelSprite } from './PixelSprite';
import { PetHealthEffect } from './PetEffects';
import { getPetEvolution } from '@renderer/lib/constants';
import { eggGrid, eggPalette, eggCracks85, eggCracks95, crackPalette, crackGlowPalette, cushionGrid, cushionPalette } from './sprite-data';
import './pet-animations.css';

interface BioPetProps {
  pet: PetState;
  postureScore: number;
  focusScore: number;
  stressScore: number;
  breakReminderDue?: boolean;
}

const HEALTH_HYS = 3000;
const SETTLE_WINDOW_MS = 3000;

type HatchPhase = 'none' | 'crack' | 'burst' | 'emerge';

function playLevelUpSound(toStage: number): void {
  try {
    const ctx = new AudioContext();
    // C major arpeggio — slightly higher pitch at each stage
    const pitchMult = 1 + (toStage - 1) * 0.09;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq * pitchMult;
      const t = ctx.currentTime + i * 0.13;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.start(t);
      osc.stop(t + 0.6);
    });
    // Extra high note for Ascended (stage 5)
    if (toStage >= 5) {
      const osc5 = ctx.createOscillator();
      const gain5 = ctx.createGain();
      osc5.connect(gain5);
      gain5.connect(ctx.destination);
      osc5.type = 'sine';
      osc5.frequency.value = 1046.50 * pitchMult * 1.5;
      const t5 = ctx.currentTime + notes.length * 0.13;
      gain5.gain.setValueAtTime(0, t5);
      gain5.gain.linearRampToValueAtTime(0.28, t5 + 0.03);
      gain5.gain.exponentialRampToValueAtTime(0.001, t5 + 0.8);
      osc5.start(t5);
      osc5.stop(t5 + 0.85);
    }
  } catch (_) {
    // AudioContext unavailable — silent fallback
  }
}

export const BioPet = memo(function BioPet({ pet, postureScore, focusScore, stressScore, breakReminderDue = false }: BioPetProps): JSX.Element {
  const committedRef = useRef<PetHealthState>(pet.health);
  const pendingRef = useRef<PetHealthState>(pet.health);
  const pendingSinceRef = useRef(Date.now());
  const [committed, setCommitted] = useState<PetHealthState>(pet.health);

  useEffect(() => {
    const h = pet.health;
    if (h !== pendingRef.current) {
      pendingRef.current = h;
      pendingSinceRef.current = Date.now();
    }
    if (h !== committedRef.current && Date.now() - pendingSinceRef.current >= HEALTH_HYS) {
      committedRef.current = h;
      setCommitted(h);
    }
  }, [pet.health]);

  useEffect(() => {
    const iv = setInterval(() => {
      const p = pendingRef.current;
      if (p !== committedRef.current && Date.now() - pendingSinceRef.current >= HEALTH_HYS) {
        committedRef.current = p;
        setCommitted(p);
      }
    }, 500);
    return () => clearInterval(iv);
  }, []);

  const healthClass = committed.toLowerCase();
  const isEgg = pet.stage === 0;

  // ── Hatch + evolution animation ──────────────────────────────
  const mountTimeRef = useRef(Date.now());
  const prevStageRef = useRef(pet.stage);
  const [hatchPhase, setHatchPhase] = useState<HatchPhase>('none');
  const [evolving, setEvolving] = useState(false);
  const [showEvolveSparkles, setShowEvolveSparkles] = useState(false);

  useEffect(() => {
    const prev = prevStageRef.current;
    const curr = pet.stage;
    prevStageRef.current = curr;

    // Ignore stage changes during initial state settling from store load
    if (Date.now() - mountTimeRef.current < SETTLE_WINDOW_MS) return;

    if (prev === 0 && curr >= 1) {
      playLevelUpSound(curr);
      setHatchPhase('crack');
      const t1 = setTimeout(() => setHatchPhase('burst'), 1000);
      const t2 = setTimeout(() => setHatchPhase('emerge'), 1800);
      const t3 = setTimeout(() => setHatchPhase('none'), 3200);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }

    if (curr > prev && prev >= 1) {
      playLevelUpSound(curr);
      setEvolving(true);
      setShowEvolveSparkles(true);
      const t1 = setTimeout(() => setEvolving(false), 2000);
      const t2 = setTimeout(() => setShowEvolveSparkles(false), 1400);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [pet.stage]);

  const isHatching = hatchPhase !== 'none';
  const showEgg = isEgg || hatchPhase === 'crack' || hatchPhase === 'burst';
  const showCat = !isEgg && (hatchPhase === 'none' || hatchPhase === 'emerge');

  // ── Egg wobble ───────────────────────────────────────────────
  const [wobbling, setWobbling] = useState(false);
  const wobbleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isEgg || isHatching) return;
    const intervalMs =
      pet.eggCrackProgress >= 95 ? 800 :
      pet.eggCrackProgress >= 85 ? 1800 :
      pet.eggCrackProgress >= 50 ? 4500 : 10000;
    const schedule = () => {
      wobbleRef.current = setTimeout(() => {
        setWobbling(true);
        wobbleRef.current = setTimeout(() => {
          setWobbling(false);
          schedule();
        }, 450);
      }, intervalMs);
    };
    schedule();
    return () => { if (wobbleRef.current) clearTimeout(wobbleRef.current); };
  }, [isEgg, isHatching, pet.eggCrackProgress]);

  // During hatching always show full crack overlay
  const eggOverlay = !showEgg ? null :
    pet.eggCrackProgress >= 95 || isHatching ? { grid: eggCracks95, palette: crackGlowPalette } :
    pet.eggCrackProgress >= 85 ? { grid: eggCracks85, palette: crackPalette } : null;

  const eggGlowClass = !showEgg || isHatching ? '' :
    pet.eggCrackProgress >= 95 ? 'egg-shell-glow egg-shell-glow--hatching' :
    pet.eggCrackProgress >= 85 ? 'egg-shell-glow egg-shell-glow--cracking' : '';

  // ── Evolution progress (uses dev 10s-per-stage thresholds when USE_DEV_PET_EVOLUTION) ──
  const evolution = getPetEvolution();
  const next = evolution[Math.min(pet.stage + 1, evolution.length - 1)].minMinutes;
  const curr = evolution[pet.stage]?.minMinutes ?? 0;
  const prog = pet.stage >= 5 ? 100 : Math.min(100, Math.round(((pet.totalLockedInMinutes - curr) / Math.max(0.001, next - curr)) * 100));
  const showEvolution = pet.stage < 5;

  const spriteWrapperClasses = [
    'pet-sprite-wrapper',
    isEgg && !isHatching ? 'pet-sprite-wrapper--egg' : '',
    wobbling && !isHatching ? 'pet-sprite-wrapper--egg-wobble' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="card bio-pet-card">
      <div className={`pet-scene${breakReminderDue ? ' bio-pet--sleepy' : ''}`}>
        <div className={`pet-glow pet-glow--${healthClass}`} />

        {hatchPhase === 'burst' && <div className="hatch-flash-overlay" />}

        <div className={spriteWrapperClasses}>
          {/* Cushion */}
          <div style={{ position: 'absolute', bottom: 5, zIndex: 0 }}>
            <PixelSprite grid={cushionGrid} palette={cushionPalette} scale={3} />
          </div>

          {/* Shell fragments during burst/emerge */}
          {(hatchPhase === 'burst' || hatchPhase === 'emerge') && (
            <div className="hatch-fragments">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className={`hatch-fragment hatch-fragment--${i}`} />
              ))}
            </div>
          )}

          {/* Egg sprite */}
          {showEgg && (
            <div
              className={
                hatchPhase === 'crack' ? 'hatch-phase--crack' :
                hatchPhase === 'burst' ? 'hatch-phase--burst' :
                eggGlowClass
              }
              style={{ position: 'relative', zIndex: 1, marginBottom: 25 }}
            >
              <PixelSprite
                grid={eggGrid}
                palette={eggPalette}
                overlay={eggOverlay?.grid}
                overlayPalette={eggOverlay?.palette}
                scale={4}
              />
            </div>
          )}

          {/* Stage aura ring (stages 3+) */}
          {showCat && pet.stage >= 3 && (
            <div className={`pet-stage-aura pet-stage-aura--${pet.stage}`} />
          )}

          {/* Cat sprite */}
          {showCat && (
            <div
              className={
                hatchPhase === 'emerge' ? 'hatch-emerge' :
                evolving ? 'evolution-glow-active' : ''
              }
              style={{ position: 'relative', zIndex: 1, marginBottom: 8 }}
            >
              <AnimatedCat health={committed} stage={pet.stage} />
            </div>
          )}

          {/* Sparkles during evolution */}
          {showEvolveSparkles && (
            <div className="hatch-sparkles">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className={`hatch-sparkle hatch-sparkle--${i} evolve-sparkle--stage${pet.stage}`} />
              ))}
            </div>
          )}

          {/* Sparkles during cat emerge */}
          {hatchPhase === 'emerge' && (
            <div className="hatch-sparkles">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className={`hatch-sparkle hatch-sparkle--${i}`} />
              ))}
            </div>
          )}
        </div>

        {!isEgg && !isHatching && <PetHealthEffect health={committed} />}
      </div>

      {/* Meta section */}
      <div className="pet-meta-section">
        <div className="pet-stage-row">
          <div className="pet-stage-name-stack">
            <span className="pet-stage-name">{pet.stageName}</span>
            <span className="pet-stage-label">Stage {pet.stage}</span>
          </div>
          <span className={`pet-health-pill pet-health-pill--${healthClass}`}>
            <span className={`pet-health-dot pet-health-dot--${healthClass}`} />
            {pet.health}
          </span>
        </div>

        {showEvolution && (
          <div className="pet-evolution-section">
            <div className="pet-evolution-header">
              <span className="pet-evolution-label">Evolution</span>
              <span className="pet-evolution-percent" style={{
                color: committed === 'Thriving' ? 'var(--pet-green)' : committed === 'Fading' ? 'var(--pet-amber)' : 'var(--pet-red)'
              }}>{prog}%</span>
            </div>
            <div className="pet-evolution-bar">
              <div className={`pet-evolution-fill pet-evolution-fill--${healthClass}`} style={{ width: `${prog}%` }} />
            </div>
          </div>
        )}

        <div className="pet-stat-chips">
          <Chip label="Posture" value={postureScore} />
          <Chip label="Focus" value={focusScore} />
          <Chip label="Stress" value={stressScore} />
          <Chip label="Time" value={formatLockedTime(pet.totalLockedInMinutes)} />
        </div>
      </div>
    </div>
  );
});

function formatLockedTime(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function Chip({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="pet-chip">
      {label} <strong className="pet-chip-value">{typeof value === 'number' ? Math.round(value) : value}</strong>
    </span>
  );
}
