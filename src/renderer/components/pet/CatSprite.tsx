import { useEffect, useState, useCallback, useRef } from 'react';
import gingerCatSheet from '@renderer/assets/ginger-cat.png';
import './pet-animations.css';

const FRAME_W = 32;
const FRAME_H = 32;
const SHEET_W = 352;
const SHEET_H = 1696;

interface CatSpriteProps {
  row: number;
  col: number;
  scale?: number;
  flip?: boolean;
  filter?: string;
}

export function CatSprite({ row, col, scale = 3, flip = false, filter }: CatSpriteProps): JSX.Element {
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
        filter,
      }}
    />
  );
}

/*
 * Animation map for 352x1696 ginger cat sheet (32x32 frames, 11 cols x 53 rows)
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
  idleSit:    { row: 0,  frames: 6, speed: 500 },
  idleStand:  { row: 1,  frames: 6, speed: 500 },
  restCrouch: { row: 2,  frames: 5, speed: 550 },
  restLie:    { row: 3,  frames: 5, speed: 550 },
  walkRight:  { row: 6,  frames: 5, speed: 230 },
  walkLeft:   { row: 7,  frames: 5, speed: 230 },
  walkFront:  { row: 8,  frames: 5, speed: 230 },
  walkBack:   { row: 9,  frames: 5, speed: 230 },
  sleepCurl1: { row: 12, frames: 2, speed: 1200 },
  sleepCurl2: { row: 13, frames: 2, speed: 1200 },
  sleepFlat:  { row: 16, frames: 2, speed: 1200 },
  sleepBelly: { row: 17, frames: 2, speed: 1200 },
  eatFront:   { row: 20, frames: 5, speed: 350 },
  meowSit:    { row: 28, frames: 3, speed: 420 },
  meowStand:  { row: 29, frames: 3, speed: 420 },
  yawnSit:    { row: 32, frames: 5, speed: 350 },
  washSit:    { row: 36, frames: 5, speed: 350 },
  scratchSit: { row: 39, frames: 5, speed: 300 },
  hiss:       { row: 41, frames: 2, speed: 600 },
} as const;

type AnimName = keyof typeof ANIMS;

interface CalmAction {
  anim: AnimName;
  duration: number;
}

interface AnimatedCatProps {
  health: 'Thriving' | 'Fading' | 'Wilting';
  scale?: number;
  filter?: string;
}

const THRIVING_ACTIONS: CalmAction[] = [
  { anim: 'yawnSit', duration: 1700 },
  { anim: 'washSit', duration: 2200 },
  { anim: 'scratchSit', duration: 1800 },
  { anim: 'meowSit', duration: 1400 },
  { anim: 'idleStand', duration: 2600 },
  { anim: 'restCrouch', duration: 2600 },
];

const FADING_ACTIONS: CalmAction[] = [
  { anim: 'yawnSit', duration: 1500 },
  { anim: 'restLie', duration: 2800 },
  { anim: 'restCrouch', duration: 2600 },
];

const SLEEP_ANIMS: AnimName[] = ['sleepCurl1', 'sleepCurl2', 'sleepFlat', 'sleepBelly'];
const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min);
const randomInt = (min: number, max: number): number => Math.round(randomBetween(min, max));
const pickRandom = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export function AnimatedCat({ health, scale = 3, filter }: AnimatedCatProps): JSX.Element {
  const [animation, setAnimation] = useState<AnimName>('idleSit');
  const [frame, setFrame] = useState(0);
  const [posX, setPosX] = useState(0);
  const [moveSpeed, setMoveSpeed] = useState(0);
  const [moveDir, setMoveDir] = useState<1 | -1>(1);
  const [frameDelayOverride, setFrameDelayOverride] = useState<number | null>(null);
  const decisionTimeoutRef = useRef<number>(0);
  const actionTimeoutRef = useRef<number>(0);

  const currentAnim = ANIMS[animation];
  const frameDelayMs = frameDelayOverride ?? currentAnim.speed;

  // Frame loop
  useEffect(() => {
    const iv = setInterval(() => {
      setFrame(f => (f + 1) % currentAnim.frames);
    }, frameDelayMs);
    return () => clearInterval(iv);
  }, [currentAnim.frames, frameDelayMs]);

  // Movement during walk
  useEffect(() => {
    if (!animation.startsWith('walk') || moveSpeed <= 0) return;

    const iv = setInterval(() => {
      setPosX(x => {
        const next = x + moveSpeed * moveDir;
        if (next > 35 || next < -35) {
          const reversed: 1 | -1 = moveDir === 1 ? -1 : 1;
          setMoveDir(reversed);
          setAnimation(reversed === 1 ? 'walkRight' : 'walkLeft');
          return Math.max(-35, Math.min(35, next));
        }
        return next;
      });
    }, 60);
    return () => clearInterval(iv);
  }, [animation, moveSpeed, moveDir]);

  // Schedule random actions
  const scheduleAction = useCallback(() => {
    clearTimeout(decisionTimeoutRef.current);
    clearTimeout(actionTimeoutRef.current);

    if (health === 'Wilting') {
      setMoveSpeed(0);
      setFrameDelayOverride(null);
      setAnimation(pickRandom(SLEEP_ANIMS));
      setFrame(0);
      // Keep sleep states much longer: 30s to 90s
      decisionTimeoutRef.current = window.setTimeout(scheduleAction, randomInt(30_000, 90_000));
      return;
    }

    const delay = randomInt(7_000, 14_000);
    decisionTimeoutRef.current = window.setTimeout(() => {
      const idleChance = health === 'Thriving' ? 0.62 : 0.78;
      if (Math.random() < idleChance) {
        setAnimation(Math.random() < 0.6 ? 'idleSit' : 'restLie');
        setMoveSpeed(0);
        setFrameDelayOverride(null);
        setFrame(0);
        scheduleAction();
        return;
      }

      // Rare "turn-around" style non-movement actions
      const turnChance = health === 'Thriving' ? 0.08 : 0.05;
      if (Math.random() < turnChance) {
        setMoveSpeed(0);
        setFrameDelayOverride(null);
        setAnimation(Math.random() < 0.5 ? 'idleStand' : 'restCrouch');
        setFrame(0);
        actionTimeoutRef.current = window.setTimeout(() => {
          setAnimation('idleSit');
          setFrame(0);
          scheduleAction();
        }, randomInt(1_800, 3_200));
        return;
      }

      // Rare naps: 30s to 90s sleep blocks
      const napChance = health === 'Thriving' ? 0.12 : 0.22;
      if (Math.random() < napChance) {
        setMoveSpeed(0);
        setFrameDelayOverride(null);
        setAnimation(pickRandom(SLEEP_ANIMS));
        setFrame(0);
        actionTimeoutRef.current = window.setTimeout(() => {
          setAnimation('idleSit');
          setFrame(0);
          scheduleAction();
        }, randomInt(30_000, 90_000));
        return;
      }

      // Variable chance "running around"
      const movementChance = health === 'Thriving' ? 0.65 : 0.35;
      if (Math.random() < movementChance) {
        const direction: 1 | -1 = Math.random() < 0.5 ? -1 : 1;
        const runChance = health === 'Thriving'
          ? randomBetween(0.22, 0.58)
          : randomBetween(0.06, 0.22);
        const running = Math.random() < runChance;

        setMoveDir(direction);
        setAnimation(direction === 1 ? 'walkRight' : 'walkLeft');
        setFrame(0);
        setMoveSpeed(running ? randomBetween(0.95, 1.45) : randomBetween(0.45, 0.82));
        setFrameDelayOverride(running ? randomInt(130, 190) : randomInt(230, 340));

        actionTimeoutRef.current = window.setTimeout(() => {
          setMoveSpeed(0);
          setFrameDelayOverride(null);
          setAnimation('idleSit');
          setFrame(0);
          scheduleAction();
        }, running ? randomInt(4_000, 11_000) : randomInt(5_000, 13_000));
        return;
      }

      const actions = health === 'Thriving' ? THRIVING_ACTIONS : FADING_ACTIONS;
      const pick = pickRandom(actions);
      setMoveSpeed(0);
      setFrameDelayOverride(null);
      setAnimation(pick.anim);
      setFrame(0);

      actionTimeoutRef.current = window.setTimeout(() => {
        setAnimation('idleSit');
        setFrame(0);
        scheduleAction();
      }, pick.duration);
    }, delay);
  }, [health]);

  useEffect(() => {
    scheduleAction();
    return () => {
      clearTimeout(decisionTimeoutRef.current);
      clearTimeout(actionTimeoutRef.current);
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
      <CatSprite row={currentAnim.row} col={frame} scale={scale} filter={filter} />
    </div>
  );
}
