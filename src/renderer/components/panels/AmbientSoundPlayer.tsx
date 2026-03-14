import { memo, useRef, useState, useCallback, useEffect } from 'react';

import forestSrc from '@renderer/assets/audio/forest.mp3';
import rainSrc from '@renderer/assets/audio/rain.mp3';
import lofiSrc from '@renderer/assets/audio/lofi-1.mp3';

type SoundId = 'forest' | 'rain' | 'lofi';

interface SoundOption {
  id: SoundId;
  label: string;
  icon: string;
  src: string;
}

const SOUNDS: SoundOption[] = [
  { id: 'forest', label: 'Forest & Birds', icon: '🌲', src: forestSrc },
  { id: 'rain', label: 'Rain on Window', icon: '🌧', src: rainSrc },
  { id: 'lofi', label: 'Lofi Chill', icon: '🎵', src: lofiSrc },
];

export const AmbientSoundPlayer = memo(function AmbientSoundPlayer(): JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeSound, setActiveSound] = useState<SoundId | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setActiveSound(null);
  }, []);

  const play = useCallback(
    (sound: SoundOption) => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(sound.src);
      audio.loop = true;
      audio.volume = volume;
      audio.play();
      audioRef.current = audio;
      setActiveSound(sound.id);
      setIsPlaying(true);
    },
    [volume],
  );

  const handleSelect = useCallback(
    (sound: SoundOption) => {
      if (activeSound === sound.id && isPlaying) {
        stop();
        return;
      }
      play(sound);
    },
    [activeSound, isPlaying, play, stop],
  );

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
    if (audioRef.current) {
      audioRef.current.volume = v;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div className="card sound-player">
      <h3>Ambient Sounds</h3>

      <div className="sound-options">
        {SOUNDS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`sound-option${activeSound === s.id ? ' sound-option--active' : ''}`}
            onClick={() => handleSelect(s)}
            aria-pressed={activeSound === s.id}
          >
            <span className="sound-option-icon">{s.icon}</span>
            <span className="sound-option-label">{s.label}</span>
            {activeSound === s.id && isPlaying && (
              <span className="sound-option-eq">
                <span /><span /><span />
              </span>
            )}
          </button>
        ))}
      </div>

      {activeSound && (
        <div className="sound-controls">
          <button
            type="button"
            className="sound-play-btn"
            onClick={handlePause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>
          <div className="sound-volume">
            <span className="sound-volume-icon">🔈</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="sound-volume-slider"
            />
            <span className="sound-volume-icon">🔊</span>
          </div>
        </div>
      )}
    </div>
  );
});
