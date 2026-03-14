import { memo, useEffect, useRef, useState } from 'react';
import type { PetHealthState, PetState } from '@renderer/lib/types';
import { AnimatedCat } from './CatSprite';
import { PixelSprite } from './PixelSprite';
import { PetHealthEffect } from './PetEffects';
import { PET_EVOLUTION } from '@renderer/lib/constants';
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

  useEffect(() => {
    const prev = prevStageRef.current;
    const curr = pet.stage;
    prevStageRef.current = curr;

    // Ignore stage changes during initial state settling from store load
    if (Date.now() - mountTimeRef.current < SETTLE_WINDOW_MS) return;

    if (prev === 0 && curr >= 1) {
      setHatchPhase('crack');
      const t1 = setTimeout(() => setHatchPhase('burst'), 1000);
      const t2 = setTimeout(() => setHatchPhase('emerge'), 1800);
      const t3 = setTimeout(() => setHatchPhase('none'), 3200);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }

    if (curr > prev && prev >= 1) {
      setEvolving(true);
      const t = setTimeout(() => setEvolving(false), 2000);
      return () => clearTimeout(t);
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

  // ── Evolution progress ───────────────────────────────────────
  const next = PET_EVOLUTION[Math.min(pet.stage + 1, PET_EVOLUTION.length - 1)].minMinutes;
  const curr = PET_EVOLUTION[pet.stage]?.minMinutes ?? 0;
  const prog = pet.stage >= 5 ? 100 : Math.min(100, Math.round(((pet.totalLockedInMinutes - curr) / Math.max(1, next - curr)) * 100));
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

          {/* Cat sprite */}
          {showCat && (
            <div
              className={
                hatchPhase === 'emerge' ? 'hatch-emerge' :
                evolving ? 'evolution-glow-active' : ''
              }
              style={{ position: 'relative', zIndex: 1, marginBottom: 8 }}
            >
              <AnimatedCat health={committed} scale={3} />
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
