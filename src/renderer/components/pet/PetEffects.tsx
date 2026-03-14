import React from 'react';
import { PixelHeart } from './PixelSprite';
import './pet-animations.css';

/**
 * Floating pixel hearts for happy/thriving state
 * 2-3 hearts with staggered animations
 */
export function FloatingHearts(): JSX.Element {
  return (
    <div className="pet-floating-hearts">
      <div className="pet-heart pet-heart-1">
        <PixelHeart color="#E88B8B" size={6} />
      </div>
      <div className="pet-heart pet-heart-2">
        <PixelHeart color="#F0A0A0" size={5} />
      </div>
      <div className="pet-heart pet-heart-3">
        <PixelHeart color="#E88B8B" size={4} />
      </div>
    </div>
  );
}

/**
 * Sleep Z's for sleepy/wilting state
 * 3 "z" characters stacked diagonally
 */
export function SleepZzz(): JSX.Element {
  return (
    <div className="pet-sleep-zzz">
      <span className="pet-z pet-z-1">z</span>
      <span className="pet-z pet-z-2">z</span>
      <span className="pet-z pet-z-3">z</span>
    </div>
  );
}

/**
 * Component that renders the appropriate effect based on health state
 */
export function PetHealthEffect({
  health,
}: {
  health: 'Thriving' | 'Fading' | 'Wilting';
}): JSX.Element | null {
  switch (health) {
    case 'Thriving':
      return <FloatingHearts />;
    case 'Fading':
      return null;
    case 'Wilting':
      return <SleepZzz />;
    default:
      return null;
  }
}
