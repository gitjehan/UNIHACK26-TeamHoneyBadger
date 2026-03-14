import { useEffect, useRef, useState, useCallback } from 'react';
import type { PetHealthState, PetState } from '@renderer/lib/types';
import { AnimatedCat } from './CatSprite';
import { PixelSprite } from './PixelSprite';
import { PetHealthEffect } from './PetEffects';
import {
  eggGrid,
  eggPalette,
  eggCracks85,
  eggCracks95,
  crackPalette,
  crackGlowPalette,
  cushionGrid,
  cushionPalette,
} from './sprite-data';
import './pet-animations.css';

interface BioPetProps {
  pet: PetState;
  postureTilt: number;
  postureScore: number;
  focusScore: number;
  stressScore: number;
}

const HEALTH_HYS = 3000;

export function BioPet({
  pet,
  postureTilt: _tilt,
  postureScore,
  focusScore,
  stressScore,
}: BioPetProps): JSX.Element {
  void _tilt;

  // Health hysteresis
  const committedRef = useRef<PetHealthState>(pet.health);
  const pendingRef = useRef<PetHealthState>(pet.health);
  const pendingSinceRef = useRef(Date.now());
  const [committed, setCommitted] = useState<PetHealthState>(pet.health);

  // Health hysteresis
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

  // Map health to cat state
  const getCatState = (): 'idle' | 'happy' | 'sleep' | 'worried' => {
    switch (committed) {
      case 'Thriving': return 'happy';
      case 'Fading': return 'worried';
      case 'Wilting': return 'sleep';
      default: return 'idle';
    }
  };

  // Egg crack overlay
  const getEggOverlay = () => {
    if (pet.stage !== 0) return null;
    if (pet.eggCrackProgress >= 95) return { grid: eggCracks95, palette: crackGlowPalette };
    if (pet.eggCrackProgress >= 85) return { grid: eggCracks85, palette: crackPalette };
    return null;
  };

  const healthClass = committed.toLowerCase();
  const isEgg = pet.stage === 0;
  const eggOverlay = getEggOverlay();

  // Evolution progress
  const SM = [0, 10, 30, 120, 300, 600];
  const nxt = SM[Math.min(pet.stage + 1, SM.length - 1)];
  const cur = SM[pet.stage] ?? 0;
  const prog = pet.stage >= 5 ? 100 : Math.min(100, Math.round(((pet.totalLockedInMinutes - cur) / Math.max(1, nxt - cur)) * 100));

  return (
    <div className="card">
      <div className="pet-scene">
        <div className={`pet-glow pet-glow--${healthClass}`} />
        
        <div className={`pet-sprite-wrapper ${isEgg ? 'pet-sprite-wrapper--egg' : 'pet-sprite-wrapper--cat'}`}>
          {/* Cushion */}
          <div style={{ position: 'absolute', bottom: 10, zIndex: 0 }}>
            <PixelSprite grid={cushionGrid} palette={cushionPalette} scale={3} />
          </div>
          
          {/* Cat or Egg */}
          <div style={{ position: 'relative', zIndex: 1, marginBottom: 30 }}>
            {isEgg ? (
              <PixelSprite
                grid={eggGrid}
                palette={eggPalette}
                overlay={eggOverlay?.grid}
                overlayPalette={eggOverlay?.palette}
                scale={3}
              />
            ) : (
              <AnimatedCat state={getCatState()} scale={3} />
            )}
          </div>
        </div>

        {!isEgg && <PetHealthEffect health={committed} />}
      </div>

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
              }}>
                {prog}%
              </span>
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
}

function Chip({ label, value }: { label: string; value: number | string }): JSX.Element {
  return (
    <span className="pet-chip">
      {label} <strong className="pet-chip-value">{typeof value === 'number' ? Math.round(value) : value}</strong>
    </span>
  );
}
