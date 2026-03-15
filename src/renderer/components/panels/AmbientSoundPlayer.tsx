import { memo, useRef, useState, useCallback, useEffect } from 'react';

import forestSrc from '@renderer/assets/audio/forest.mp3';
import rainSrc from '@renderer/assets/audio/rain.mp3';
import lofiSrc from '@renderer/assets/audio/lofi-1.mp3';

type SoundId = 'forest' | 'rain' | 'lofi';

interface SoundOption {
  id: SoundId;
  label: string;
  src: string;
  angle: number; // clockwise degrees from top (12 o'clock = 0)
}

// 3 evenly-spaced stops around the dial
const SOUNDS: SoundOption[] = [
  { id: 'forest', label: 'Forest', src: forestSrc, angle: 0   },
  { id: 'rain',   label: 'Rain',   src: rainSrc,   angle: 120 },
  { id: 'lofi',   label: 'Lofi',   src: lofiSrc,   angle: 240 },
];

function SoundIcon({ id, active }: { id: SoundId; active: boolean }): JSX.Element {
  const color = active ? 'var(--green-primary)' : '#9c9189';
  if (id === 'forest') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L6 10h3l-3 6h5v4h2v-4h5l-3-6h3z" />
      </svg>
    );
  }
  if (id === 'rain') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 17.58A5 5 0 0018 8h-1.26A8 8 0 104 15.25" />
        <line x1="8" y1="19" x2="8" y2="21" />
        <line x1="8" y1="13" x2="8" y2="15" />
        <line x1="16" y1="19" x2="16" y2="21" />
        <line x1="16" y1="13" x2="16" y2="15" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="12" y1="15" x2="12" y2="17" />
      </svg>
    );
  }
  // lofi — headphones
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0118 0v6" />
      <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
    </svg>
  );
}

const IDLE_ANGLE = 180; // pointer rests here (bottom) when nothing is playing
const ORBIT_R    = 76;  // px from dial center to icon center
const DIAL_CX    = 100; // center x within container
const DIAL_CY    = 100; // center y within container
const ICON_HALF  = 21;  // half of icon element size (42px)

function iconPos(angle: number) {
  const rad = (angle * Math.PI) / 180;
  return {
    left: DIAL_CX + ORBIT_R * Math.sin(rad) - ICON_HALF,
    top:  DIAL_CY - ORBIT_R * Math.cos(rad) - ICON_HALF,
  };
}

function nearestSound(angle: number): SoundOption {
  let best = SOUNDS[0];
  let bestDist = Infinity;
  for (const s of SOUNDS) {
    const diff = Math.abs(((angle - s.angle + 540) % 360) - 180);
    if (diff < bestDist) { bestDist = diff; best = s; }
  }
  return best;
}

function angleFromCenter(cx: number, cy: number, clientX: number, clientY: number): number {
  return (((Math.atan2(clientX - cx, -(clientY - cy)) * 180) / Math.PI) + 360) % 360;
}

export const AmbientSoundPlayer = memo(function AmbientSoundPlayer(): JSX.Element {
  const audioRef   = useRef<HTMLAudioElement | null>(null);
  const knobRef    = useRef<HTMLDivElement>(null);
  const dragging   = useRef(false);

  const [activeSound,   setActiveSound]   = useState<SoundId | null>(null);
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [volume,        setVolume]        = useState(0.5);
  const [pointerAngle,  setPointerAngle]  = useState(IDLE_ANGLE);
  const [isDragging,    setIsDragging]    = useState(false);

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setIsPlaying(false);
    setActiveSound(null);
    setPointerAngle(IDLE_ANGLE);
  }, []);

  const playSound = useCallback((sound: SoundOption) => {
    audioRef.current?.pause();
    const audio = new Audio(sound.src);
    audio.loop   = true;
    audio.volume = volume;
    audio.play();
    audioRef.current = audio;
    setActiveSound(sound.id);
    setIsPlaying(true);
    setPointerAngle(sound.angle);
  }, [volume]);

  const handleSelect = useCallback((sound: SoundOption) => {
    if (activeSound === sound.id && isPlaying) {
      stopAudio();
    } else {
      playSound(sound);
    }
  }, [activeSound, isPlaying, playSound, stopAudio]);

  const handlePause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const getKnobCenter = useCallback(() => {
    const rect = knobRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const c = getKnobCenter();
    setPointerAngle(angleFromCenter(c.x, c.y, e.clientX, e.clientY));
  }, [getKnobCenter]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    const c = getKnobCenter();
    const angle = angleFromCenter(c.x, c.y, e.clientX, e.clientY);
    handleSelect(nearestSound(angle));
  }, [getKnobCenter, handleSelect]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const activeLabel = SOUNDS.find(s => s.id === activeSound)?.label;

  return (
    <div className="card sound-player">
      <h3>Ambient Sounds</h3>

      <div className="sound-dial-wrapper">
      <div className="sound-dial-wrap">
        {/* Icons placed around the orbit */}
        {SOUNDS.map((s) => {
          const pos = iconPos(s.angle);
          const isActive = activeSound === s.id;
          return (
            <button
              key={s.id}
              type="button"
              className={`sound-dial-icon${isActive ? ' sound-dial-icon--active' : ''}`}
              style={{ left: pos.left, top: pos.top }}
              onClick={() => handleSelect(s)}
              title={s.label}
            >
              <SoundIcon id={s.id} active={isActive} />
            </button>
          );
        })}

        {/* Dial knob */}
        <div
          ref={knobRef}
          className="sound-dial-knob"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div
            className={`sound-dial-pointer${isDragging ? ' sound-dial-pointer--instant' : ''}`}
            style={{ transform: `rotate(${pointerAngle}deg)` }}
          />
          <div className="sound-dial-center-dot" />
        </div>
      </div>
      </div>

      {/* Status label (when no sound selected) */}
      {!activeSound && (
        <div className="sound-dial-status">
          <span>Turn to select</span>
        </div>
      )}

      {/* Label + volume controls (when sound selected) — single row to avoid overlap */}
      {activeSound && (
        <div className="sound-controls">
          <span className="sound-controls-label">
            {activeLabel}
            {isPlaying && (
              <span className="sound-option-eq" style={{ marginLeft: 6 }}>
                <span /><span /><span />
              </span>
            )}
          </span>
          <button
            type="button"
            className="sound-play-btn"
            onClick={handlePause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            )}
          </button>
          <div className="sound-volume">
            <svg className="sound-volume-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            </svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="sound-volume-slider"
            />
            <svg className="sound-volume-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
});
