import { memo, useState, useEffect, useRef, useCallback } from 'react';

function playTimerCompleteSound() {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();

  // Play 3 descending bell chimes over ~5 seconds
  const chimes = [
    { freq: 880, time: 0 },
    { freq: 660, time: 1.5 },
    { freq: 440, time: 3.0 },
  ];

  chimes.forEach(({ freq, time }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + time);

    gain.gain.setValueAtTime(0, ctx.currentTime + time);
    gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + 1.4);

    osc.start(ctx.currentTime + time);
    osc.stop(ctx.currentTime + time + 1.5);
  });

  // Close context after all chimes finish
  setTimeout(() => ctx.close(), 5500);
}

type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

const MODE_DURATIONS: Record<TimerMode, number> = {
  focus: 1500,
  shortBreak: 300,
  longBreak: 900,
};

const MODE_LABELS: Record<TimerMode, string> = {
  focus: 'Focus',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

const MODE_COLORS: Record<TimerMode, string> = {
  focus: '#D4908A',
  shortBreak: '#7BA68A',
  longBreak: '#8A9EB5',
};

interface PomodoroTimerProps {
  postureScore: number;
}

const initialTimeByMode: Record<TimerMode, number> = {
  focus: MODE_DURATIONS.focus,
  shortBreak: MODE_DURATIONS.shortBreak,
  longBreak: MODE_DURATIONS.longBreak,
};

const POMODORO_STORAGE_KEY = 'kinetic-pomodoro-state';

function loadPomodoroState(): {
  mode: TimerMode;
  timeByMode: Record<TimerMode, number>;
  completedRounds: number;
} | null {
  try {
    const raw = localStorage.getItem(POMODORO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { mode?: string; timeByMode?: Record<string, number>; completedRounds?: number };
    if (!parsed || typeof parsed.mode !== 'string' || !parsed.timeByMode || typeof parsed.completedRounds !== 'number')
      return null;
    const mode = ['focus', 'shortBreak', 'longBreak'].includes(parsed.mode) ? (parsed.mode as TimerMode) : 'focus';
    const clamp = (val: unknown, max: number): number => {
      const n = Number(val);
      return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : max;
    };
    const timeByMode = {
      focus: clamp(parsed.timeByMode.focus, MODE_DURATIONS.focus),
      shortBreak: clamp(parsed.timeByMode.shortBreak, MODE_DURATIONS.shortBreak),
      longBreak: clamp(parsed.timeByMode.longBreak, MODE_DURATIONS.longBreak),
    };
    return { mode, timeByMode, completedRounds: Math.max(0, Math.min(4, parsed.completedRounds)) };
  } catch {
    return null;
  }
}

function savePomodoroState(mode: TimerMode, timeByMode: Record<TimerMode, number>, completedRounds: number) {
  try {
    localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify({ mode, timeByMode, completedRounds }));
  } catch {
    /* ignore */
  }
}

export const PomodoroTimer = memo(function PomodoroTimer({ postureScore }: PomodoroTimerProps) {
  const [saved] = useState(loadPomodoroState);
  const [mode, setMode] = useState<TimerMode>(() => saved?.mode ?? 'focus');
  const [timeByMode, setTimeByMode] = useState<Record<TimerMode, number>>(
    () => saved?.timeByMode ?? { ...initialTimeByMode },
  );
  const [isRunning, setIsRunning] = useState(false);
  const [completedRounds, setCompletedRounds] = useState(() => saved?.completedRounds ?? 0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const timeRemaining = timeByMode[mode];

  // Persist state so switching views / remounts don't lose progress
  useEffect(() => {
    savePomodoroState(mode, timeByMode, completedRounds);
  }, [mode, timeByMode, completedRounds]);

  // Clear interval helper
  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Switch mode only — preserve each mode's time when switching tabs
  const switchMode = useCallback(
    (newMode: TimerMode) => {
      clearTimer();
      setIsRunning(false);
      setTimeByMode((prev) => ({ ...prev, [mode]: timeRemaining }));
      setMode(newMode);
    },
    [clearTimer, mode, timeRemaining],
  );

  // Timer tick effect
  useEffect(() => {
    if (!isRunning) {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeByMode(prev => {
        const current = prev[mode];
        if (current <= 1) {
          // Timer finished
          clearTimer();
          setIsRunning(false);
          playTimerCompleteSound();

          setCompletedRounds(rounds => {
            const newRounds = mode === 'focus' ? rounds + 1 : rounds;

            if (mode === 'focus') {
              const nextBreak = newRounds >= 4 ? 'longBreak' : 'shortBreak';
              setMode(nextBreak);
              setTimeByMode(t => ({ ...t, [nextBreak]: MODE_DURATIONS[nextBreak] }));
              return newRounds;
            } else {
              setMode('focus');
              setTimeByMode(t => ({ ...t, focus: MODE_DURATIONS.focus }));
              return mode === 'longBreak' ? 0 : rounds;
            }
          });

          return { ...prev, [mode]: 0 };
        }
        return { ...prev, [mode]: current - 1 };
      });
    }, 1000);

    return clearTimer;
  }, [isRunning, mode, clearTimer]);

  // Reset to current mode duration
  const handleReset = useCallback(() => {
    clearTimer();
    setIsRunning(false);
    setTimeByMode(t => ({ ...t, [mode]: MODE_DURATIONS[mode] }));
  }, [mode, clearTimer]);

  const handleToggle = useCallback(() => {
    setIsRunning(r => !r);
  }, []);

  // Computed values
  const totalDuration = MODE_DURATIONS[mode];
  const progress = timeRemaining / totalDuration;
  const cx = 100;
  const cy = 100;
  const radius = 86;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  // Dot position at arc endpoint
  const angle = -Math.PI / 2 + 2 * Math.PI * progress;
  const dotX = cx + radius * Math.cos(angle);
  const dotY = cy + radius * Math.sin(angle);

  // Formatted time
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const showNudge = postureScore < 40 && mode === 'focus' && isRunning;
  const modeColor = MODE_COLORS[mode];

  return (
    <div className="card pomodoro-card">
      {/* Mode tabs */}
      <div className="pomodoro-tabs">
        {(['focus', 'shortBreak', 'longBreak'] as TimerMode[]).map(m => (
          <button
            key={m}
            className={`pomodoro-tab${mode === m ? ' active' : ''}`}
            style={mode === m ? { color: MODE_COLORS[m], borderColor: MODE_COLORS[m] } : undefined}
            onClick={() => {
              if (isRunning) return;
              switchMode(m);
            }}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* SVG arc + countdown */}
      <div className="pomodoro-ring-wrapper">
      <div className="pomodoro-ring-container">
        <svg viewBox="0 0 200 200">
          {/* Track ring */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="#E8E4DC"
            strokeWidth={4}
          />
          {/* Progress arc */}
          <circle
            className="pomodoro-arc"
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={modeColor}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 100 100)"
          />
          {/* Endpoint dot */}
          {progress > 0 && (
            <circle cx={dotX} cy={dotY} r={4} fill={modeColor} />
          )}
        </svg>
        <div className="pomodoro-time">{formattedTime}</div>
      </div>
      </div>

      {/* Controls */}
      <div className="pomodoro-controls">
        <button className="pomodoro-btn" style={{ borderColor: modeColor, color: modeColor }} onClick={handleToggle}>
          {isRunning ? (
            <><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 5, verticalAlign: 'middle' }}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Pause</>
          ) : (
            <><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 5, verticalAlign: 'middle' }}><polygon points="5 3 19 12 5 21 5 3"/></svg>Start</>
          )}
        </button>
        <button className="pomodoro-btn pomodoro-btn-reset" style={{ color: modeColor }} onClick={handleReset}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
        </button>
      </div>

      {/* Round dots */}
      <div className="pomodoro-rounds">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="pomodoro-round-dot"
            style={i < completedRounds ? { background: modeColor, borderColor: modeColor } : undefined}
          />
        ))}
      </div>

      {/* Posture nudge */}
      {showNudge && (
        <div className="pomodoro-nudge">Sit up — your posture is slipping</div>
      )}
    </div>
  );
});
