import { memo, useEffect, useRef, useState } from 'react';
import type { PetHealthState, PetState } from '@renderer/lib/types';
import { AnimatedCat } from './CatSprite';
import { PixelSprite } from './PixelSprite';
import { PetHealthEffect } from './PetEffects';
import { eggGrid, eggPalette, eggCracks85, eggCracks95, crackPalette, crackGlowPalette, cushionGrid, cushionPalette } from './sprite-data';
import './pet-animations.css';

interface BioPetProps {
  pet: PetState;
  postureTilt?: number;
  postureScore: number;
  focusScore: number;
  stressScore: number;
}

const HEALTH_HYS = 3000;

export const BioPet = memo(function BioPet({ pet, postureScore, focusScore, stressScore }: BioPetProps): JSX.Element {
  const committedRef = useRef<PetHealthState>(pet.health);
  const pendingRef = useRef<PetHealthState>(pet.health);
  const pendingSinceRef = useRef(Date.now());
  const [committed, setCommitted] = useState<PetHealthState>(pet.health);

  // Health hysteresis - 3s delay before committing change
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

  // Egg wobble — fires periodically, more often as hatching approaches
  const [wobbling, setWobbling] = useState(false);
  const wobbleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isEgg) return;
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
  }, [isEgg, pet.eggCrackProgress]);

  // Egg overlay for cracks
  const eggOverlay = !isEgg ? null :
    pet.eggCrackProgress >= 95 ? { grid: eggCracks95, palette: crackGlowPalette } :
    pet.eggCrackProgress >= 85 ? { grid: eggCracks85, palette: crackPalette } : null;

  // Glow class for the shell when cracking
  const eggGlowClass = !isEgg ? '' :
    pet.eggCrackProgress >= 95 ? 'egg-shell-glow egg-shell-glow--hatching' :
    pet.eggCrackProgress >= 85 ? 'egg-shell-glow egg-shell-glow--cracking' : '';

  // Evolution progress
  const stages = [0, 10, 30, 120, 300, 600];
  const next = stages[Math.min(pet.stage + 1, stages.length - 1)];
  const curr = stages[pet.stage] ?? 0;
  const prog = pet.stage >= 5 ? 100 : Math.min(100, Math.round(((pet.totalLockedInMinutes - curr) / Math.max(1, next - curr)) * 100));

  return (
    <div className="card">
      <div className="pet-scene">
        <div className={`pet-glow pet-glow--${healthClass}`} />

        <div className={`pet-sprite-wrapper ${isEgg ? 'pet-sprite-wrapper--egg' : ''} ${wobbling ? 'pet-sprite-wrapper--egg-wobble' : ''}`}>
          {/* Cushion */}
          <div style={{ position: 'absolute', bottom: 5, zIndex: 0 }}>
            <PixelSprite grid={cushionGrid} palette={cushionPalette} scale={3} />
          </div>

          {/* Pet */}
          <div className={eggGlowClass} style={{ position: 'relative', zIndex: 1, marginBottom: 25 }}>
            {isEgg ? (
              <PixelSprite
                grid={eggGrid}
                palette={eggPalette}
                overlay={eggOverlay?.grid}
                overlayPalette={eggOverlay?.palette}
                scale={3}
              />
            ) : (
              <AnimatedCat health={committed} scale={4} />
            )}
          </div>
        </div>

        {!isEgg && <PetHealthEffect health={committed} />}
      </div>

      {/* Meta section */}
      <div className="pet-meta-section">
        <div className="pet-stage-row">
          <span className="pet-stage-label">Stage {pet.stage}</span>
          <span className="pet-stage-name">{pet.stageName}</span>
          <span className={`pet-health-pill pet-health-pill--${healthClass}`}>
            <span className={`pet-health-dot pet-health-dot--${healthClass}`} />
            {pet.health}
          </span>
        </div>

        {pet.stage < 5 && (
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
          <Chip label="Time" value={`${Math.round(pet.totalLockedInMinutes)}m`} />
        </div>
      </div>
    </div>
  );
});

function Chip({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="pet-chip">
      {label} <strong className="pet-chip-value">{typeof value === 'number' ? Math.round(value) : value}</strong>
    </span>
  );
}
