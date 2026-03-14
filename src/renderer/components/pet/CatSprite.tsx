import { useEffect, useState, useCallback, useRef } from 'react';
import catSpriteSheet from '@renderer/assets/cat-sprites.png';
import './cat-sprite.css';

// Sprite sheet layout (32x32 per frame, 5 cols x 8 rows)
const FRAME_SIZE = 32;
const COLS = 5;

// Frame positions [row, col] - 0-indexed
const FRAMES = {
  // Sitting front view
  sitFront1: [0, 0],
  sitFront2: [0, 1],
  sitFront3: [0, 2],
  sitFront4: [0, 3],
  sitFront5: [1, 0],
  sitFront6: [1, 1],
  
  // Side sitting
  sitSide1: [2, 0],
  sitSide2: [2, 1],
  sitSide3: [2, 2],
  sitSide4: [3, 0],
  sitSide5: [3, 1],
  sitSide6: [3, 2],
  
  // Walking
  walk1: [4, 0],
  walk2: [4, 1],
  walk3: [4, 2],
  walk4: [4, 3],
  walk5: [4, 4],
  
  // Sleeping/lying
  sleep1: [5, 0],
  sleep2: [5, 1],
  sleep3: [5, 2],
  sleep4: [5, 3],
  
  // More walking
  run1: [6, 0],
  run2: [6, 1],
  run3: [6, 2],
  run4: [6, 3],
  run5: [7, 0],
  run6: [7, 1],
  run7: [7, 2],
  run8: [7, 3],
} as const;

type FrameName = keyof typeof FRAMES;

interface CatSpriteProps {
  frame: FrameName;
  scale?: number;
  className?: string;
  flip?: boolean;
}

export function CatSprite({ frame, scale = 3, className = '', flip = false }: CatSpriteProps): JSX.Element {
  const [row, col] = FRAMES[frame];
  const x = -col * FRAME_SIZE * scale;
  const y = -row * FRAME_SIZE * scale;
  
  return (
    <div
      className={`cat-sprite ${className} ${flip ? 'cat-sprite--flip' : ''}`}
      style={{
        width: FRAME_SIZE * scale,
        height: FRAME_SIZE * scale,
        backgroundImage: `url(${catSpriteSheet})`,
        backgroundPosition: `${x}px ${y}px`,
        backgroundSize: `${COLS * FRAME_SIZE * scale}px auto`,
      }}
    />
  );
}

// Animated cat component
interface AnimatedCatProps {
  state: 'idle' | 'happy' | 'sleep' | 'worried';
  scale?: number;
}

export function AnimatedCat({ state, scale = 3 }: AnimatedCatProps): JSX.Element {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);
  const blinkTimeoutRef = useRef<number>(0);

  // Idle animation frames
  const idleFrames: FrameName[] = ['sitFront1', 'sitFront2'];
  const sleepFrames: FrameName[] = ['sleep1', 'sleep2', 'sleep3'];
  const happyFrames: FrameName[] = ['sitFront1', 'sitFront3', 'sitFront4'];

  // Get current frames based on state
  const getFrames = (): FrameName[] => {
    switch (state) {
      case 'sleep': return sleepFrames;
      case 'happy': return happyFrames;
      case 'worried': return idleFrames;
      default: return idleFrames;
    }
  };

  const frames = getFrames();

  // Frame animation
  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex(i => (i + 1) % frames.length);
    }, state === 'sleep' ? 1000 : 600);
    return () => clearInterval(interval);
  }, [frames.length, state]);

  // Blink timer (only when not sleeping)
  const scheduleBlink = useCallback(() => {
    if (state === 'sleep') return;
    const delay = 4000 + Math.random() * 2000;
    blinkTimeoutRef.current = window.setTimeout(() => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
        scheduleBlink();
      }, 120);
    }, delay);
  }, [state]);

  useEffect(() => {
    if (state !== 'sleep') {
      scheduleBlink();
    }
    return () => {
      if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
    };
  }, [scheduleBlink, state]);

  // Use blink frame when blinking
  const currentFrame = isBlinking ? 'sitFront2' : frames[frameIndex];

  return (
    <div className={`animated-cat animated-cat--${state}`}>
      <CatSprite frame={currentFrame} scale={scale} />
    </div>
  );
}
