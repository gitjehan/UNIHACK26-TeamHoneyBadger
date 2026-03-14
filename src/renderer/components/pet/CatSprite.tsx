import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import gingerCatSheet from '@renderer/assets/ginger-cat.png';
import './pet-animations.css';

const FRAME_W = 16;
const FRAME_H = 32;
const SHEET_W = 352;
const SHEET_H = 1696;

interface CatSpriteProps {
  row: number;
  col: number;
  scale?: number;
  flip?: boolean;
}

export function CatSprite({ row, col, scale = 4, flip = false }: CatSpriteProps): JSX.Element {
  const w = FRAME_W * scale;
  const h = FRAME_H * scale;
  const bgW = SHEET_W * scale;
  const bgH = SHEET_H * scale;
  const x = -col * FRAME_W * scale;
  const y = -row * FRAME_H * scale;

  return (
    <div
      style={{
        width: w,
        height: h,
        backgroundImage: `url(${gingerCatSheet})`,
        backgroundPosition: `${x}px ${y}px`,
        backgroundSize: `${bgW}px ${bgH}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        transform: flip ? 'scaleX(-1)' : undefined,
      }}
    />
  );
}

/*
 * Animation map for 352x1696 ginger cat sheet (16x32 frames, 22 cols x 53 rows)
 *
 * REST      0-5    idle sitting, standing, crouching, lying, back views
 * WALK      6-11   right, left, front, back, diag-left, diag-right
 * SLEEP     12-19  curled, compact, side, belly-up, stretched (2 frames each)
 * EAT       20-27  down, up, right, left, front, back, diag (5 frames each)
 * MEOW      28-31  sitting, standing, side, lying (3 frames each)
 * YAWN      32-35  sitting, standing, back, lying (5 frames each)
 * WASH      36-38  sitting, standing, lying (5 frames each)
 * SCRATCH   39-40  sitting, standing (5 frames each)
 * HISS      41-42  standing, crouching (2 frames each)
 * PAW ATK   44+    various directions
 */

const ANIMS = {
  idleSit:    { row: 0,  frames: 6, speed: 350 },
  idleStand:  { row: 1,  frames: 6, speed: 350 },
  restCrouch: { row: 2,  frames: 5, speed: 400 },
  restLie:    { row: 3,  frames: 5, speed: 400 },
  walkRight:  { row: 6,  frames: 5, speed: 150 },
  walkLeft:   { row: 7,  frames: 5, speed: 150 },
  walkFront:  { row: 8,  frames: 5, speed: 150 },
  walkBack:   { row: 9,  frames: 5, speed: 150 },
  sleepCurl1: { row: 12, frames: 2, speed: 800 },
  sleepCurl2: { row: 13, frames: 2, speed: 800 },
  sleepFlat:  { row: 16, frames: 2, speed: 800 },
  sleepBelly: { row: 17, frames: 2, speed: 800 },
  eatFront:   { row: 20, frames: 5, speed: 250 },
  meowSit:    { row: 28, frames: 3, speed: 300 },
  meowStand:  { row: 29, frames: 3, speed: 300 },
  yawnSit:    { row: 32, frames: 5, speed: 250 },
  washSit:    { row: 36, frames: 5, speed: 250 },
  scratchSit: { row: 39, frames: 5, speed: 200 },
  hiss:       { row: 41, frames: 2, speed: 400 },
} as const;

type AnimName = keyof typeof ANIMS;

interface AnimatedCatProps {
  health: 'Thriving' | 'Fading' | 'Wilting';
  scale?: number;
}

const THRIVING_ACTIONS: { anim: AnimName; duration: number; moving?: boolean }[] = [
  { anim: 'walkRight', duration: 2500, moving: true },
  { anim: 'walkLeft', duration: 2500, moving: true },
  { anim: 'yawnSit', duration: 1500 },
  { anim: 'washSit', duration: 2000 },
  { anim: 'scratchSit', duration: 1500 },
  { anim: 'meowSit', duration: 1200 },
  { anim: 'idleStand', duration: 2000 },
  { anim: 'restCrouch', duration: 2000 },
];

const FADING_ACTIONS: { anim: AnimName; duration: number; moving?: boolean }[] = [
  { anim: 'walkRight', duration: 2000, moving: true },
  { anim: 'yawnSit', duration: 1500 },
  { anim: 'restLie', duration: 2500 },
  { anim: 'restCrouch', duration: 2000 },
];

const SLEEP_ANIMS: AnimName[] = ['sleepCurl1', 'sleepCurl2', 'sleepFlat', 'sleepBelly'];

export function AnimatedCat({ health, scale = 4 }: AnimatedCatProps): JSX.Element {
  const [animation, setAnimation] = useState<AnimName>('idleSit');
  const [frame, setFrame] = useState(0);
  const [flip, setFlip] = useState(false);
  const [posX, setPosX] = useState(0);
  const actionRef = useRef<number>(0);
  const innerTimeoutRef = useRef<number>(0);

  const currentAnim = ANIMS[animation];

  // Frame loop
  useEffect(() => {
    const iv = setInterval(() => {
      setFrame(f => (f + 1) % currentAnim.frames);
    }, currentAnim.speed);
    return () => clearInterval(iv);
  }, [currentAnim]);

  // Movement during walk
  useEffect(() => {
    if (!animation.startsWith('walk')) return;

    const isRight = animation === 'walkRight';
    const speed = 1.2;
    const dir = isRight ? 1 : -1;

    const iv = setInterval(() => {
      setPosX(x => {
        const next = x + speed * dir;
        if (next > 35 || next < -35) {
          setFlip(f => !f);
          return x - speed * dir;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(iv);
  }, [animation]);

  // Pick a random sleep animation for wilting cats
  const sleepAnim = useMemo(() => {
    return SLEEP_ANIMS[Math.floor(Math.random() * SLEEP_ANIMS.length)];
  }, []);

  // Schedule random actions
  const scheduleAction = useCallback(() => {
    if (health === 'Wilting') {
      setAnimation(sleepAnim);
      return;
    }

    const delay = 2500 + Math.random() * 3500;
    actionRef.current = window.setTimeout(() => {
      const actions = health === 'Thriving' ? THRIVING_ACTIONS : FADING_ACTIONS;
      const pick = actions[Math.floor(Math.random() * actions.length)];

      setAnimation(pick.anim);
      setFrame(0);

      innerTimeoutRef.current = window.setTimeout(() => {
        setAnimation('idleSit');
        setFrame(0);
        scheduleAction();
      }, pick.duration);
    }, delay);
  }, [health, sleepAnim]);

  useEffect(() => {
    scheduleAction();
    return () => {
      clearTimeout(actionRef.current);
      clearTimeout(innerTimeoutRef.current);
    };
  }, [scheduleAction]);

  const breathe = animation.startsWith('sleep') ? 'none' : 'pet-breathe 2.5s ease-in-out infinite';

  return (
    <div
      style={{
        animation: breathe,
        transform: `translateX(${posX}px)`,
        transition: 'transform 0.05s linear',
      }}
    >
      <CatSprite row={currentAnim.row} col={frame} scale={scale} flip={flip} />
    </div>
  );
}
